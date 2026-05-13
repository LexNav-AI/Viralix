"""
Stable Diffusion XL inference worker.

Loads SDXL base + refiner + ControlNet (canny) and exposes FastAPI endpoints
for image generation, batch generation, and inpainting.
"""

from __future__ import annotations

import base64
import io
import logging
import os
import time
import traceback
import uuid
from contextlib import asynccontextmanager
from typing import Any

import torch
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("sdxl-worker")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

OUTPUTS_DIR = os.getenv("OUTPUTS_DIR", "/outputs")
os.makedirs(OUTPUTS_DIR, exist_ok=True)

SDXL_BASE_MODEL = os.getenv("SDXL_BASE_MODEL", "stabilityai/stable-diffusion-xl-base-1.0")
SDXL_REFINER_MODEL = os.getenv("SDXL_REFINER_MODEL", "stabilityai/stable-diffusion-xl-refiner-1.0")
CONTROLNET_MODEL = os.getenv("CONTROLNET_MODEL", "lllyasviel/controlnet-canny-sdxl-1.0")
USE_REFINER = os.getenv("USE_REFINER", "true").lower() == "true"
USE_CONTROLNET = os.getenv("USE_CONTROLNET", "true").lower() == "true"

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

FORMAT_DIMENSIONS: dict[str, tuple[int, int]] = {
    "static_image": (1024, 1024),
    "story": (1080, 1920),
    "banner_300x250": (300, 250),
    "banner_728x90": (728, 90),
    "banner_160x600": (160, 600),
    "carousel": (1080, 1080),
    "reel": (1080, 1920),
}

DEFAULT_NEGATIVE_PROMPT = (
    "nsfw, nude, explicit, violence, gore, low quality, blurry, pixelated, "
    "watermark, text, logo, bad anatomy, extra limbs, deformed, disfigured, "
    "ugly, poor composition, oversaturated, washed out, noise, grain, "
    "jpeg artifacts, cropped, out of frame"
)

STYLE_PROMPTS: dict[str, str] = {
    "photorealistic": "photorealistic, 8k uhd, dslr, high quality, film grain, Fujifilm XT3",
    "illustration": "digital illustration, vibrant colors, sharp lines, artstation trending",
    "minimalist": "minimalist design, clean, simple, white background, flat design",
    "cinematic": "cinematic lighting, dramatic shadows, movie still, anamorphic lens",
    "product": "product photography, studio lighting, white background, commercial ad",
    "lifestyle": "lifestyle photography, natural light, candid, authentic, warm tones",
}

# ---------------------------------------------------------------------------
# Global model state
# ---------------------------------------------------------------------------

_base_pipe: Any = None
_refiner_pipe: Any = None
_controlnet_pipe: Any = None
_model_loaded = False


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str = ""
    width: int = Field(default=1024, ge=64, le=2048)
    height: int = Field(default=1024, ge=64, le=2048)
    steps: int = Field(default=30, ge=1, le=150)
    guidance_scale: float = Field(default=7.5, ge=1.0, le=20.0)
    seed: int = Field(default=-1, description="-1 for random")
    controlnet_image_b64: str | None = None
    style: str | None = None
    format: str | None = Field(
        default=None, description="Overrides width/height from FORMAT_DIMENSIONS"
    )
    refiner_strength: float = Field(default=0.3, ge=0.0, le=1.0)


class GenerateResponse(BaseModel):
    image_b64: str
    image_path: str
    seed: int
    duration_ms: float


class BatchRequest(BaseModel):
    requests: list[GenerateRequest]


class BatchResponse(BaseModel):
    results: list[GenerateResponse | dict]


class InpaintRequest(BaseModel):
    image_b64: str
    mask_b64: str
    prompt: str
    negative_prompt: str = ""
    steps: int = Field(default=30, ge=1, le=150)
    guidance_scale: float = Field(default=7.5, ge=1.0, le=20.0)
    seed: int = Field(default=-1)
    strength: float = Field(default=0.8, ge=0.0, le=1.0)


class InpaintResponse(BaseModel):
    image_b64: str
    image_path: str
    seed: int
    duration_ms: float


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    vram_used_gb: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _b64_to_pil(b64: str) -> Image.Image:
    data = base64.b64decode(b64)
    return Image.open(io.BytesIO(data)).convert("RGB")


def _pil_to_b64(img: Image.Image, fmt: str = "PNG") -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode()


def _save_image(img: Image.Image) -> str:
    fname = f"{uuid.uuid4().hex}.png"
    path = os.path.join(OUTPUTS_DIR, fname)
    img.save(path, format="PNG")
    return path


def _resolve_dimensions(req_width: int, req_height: int, fmt: str | None) -> tuple[int, int]:
    if fmt and fmt in FORMAT_DIMENSIONS:
        return FORMAT_DIMENSIONS[fmt]
    return req_width, req_height


def _build_prompt(prompt: str, style: str | None) -> str:
    if style and style in STYLE_PROMPTS:
        return f"{prompt}, {STYLE_PROMPTS[style]}"
    return prompt


def _get_generator(seed: int) -> tuple[torch.Generator, int]:
    if seed == -1:
        import random
        seed = random.randint(0, 2**32 - 1)
    gen = torch.Generator(device=DEVICE).manual_seed(seed)
    return gen, seed


def _get_vram_used_gb() -> float:
    if DEVICE == "cuda":
        try:
            return round(torch.cuda.memory_allocated() / 1e9, 2)
        except Exception:
            pass
    return 0.0


def _apply_canny(image: Image.Image) -> Image.Image:
    """Apply Canny edge detection for ControlNet conditioning."""
    import numpy as np
    from controlnet_aux import CannyDetector
    detector = CannyDetector()
    return detector(image)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _base_pipe, _refiner_pipe, _controlnet_pipe, _model_loaded

    from diffusers import (
        ControlNetModel,
        StableDiffusionXLControlNetPipeline,
        StableDiffusionXLImg2ImgPipeline,
        StableDiffusionXLPipeline,
    )

    log.info("Loading SDXL base model: %s …", SDXL_BASE_MODEL)
    try:
        if USE_CONTROLNET:
            log.info("Loading ControlNet: %s …", CONTROLNET_MODEL)
            controlnet = ControlNetModel.from_pretrained(
                CONTROLNET_MODEL,
                torch_dtype=DTYPE,
                use_safetensors=True,
            )
            _controlnet_pipe = StableDiffusionXLControlNetPipeline.from_pretrained(
                SDXL_BASE_MODEL,
                controlnet=controlnet,
                torch_dtype=DTYPE,
                use_safetensors=True,
                variant="fp16" if DTYPE == torch.float16 else None,
            ).to(DEVICE)
            _base_pipe = StableDiffusionXLPipeline.from_pretrained(
                SDXL_BASE_MODEL,
                torch_dtype=DTYPE,
                use_safetensors=True,
                variant="fp16" if DTYPE == torch.float16 else None,
            ).to(DEVICE)
        else:
            _base_pipe = StableDiffusionXLPipeline.from_pretrained(
                SDXL_BASE_MODEL,
                torch_dtype=DTYPE,
                use_safetensors=True,
                variant="fp16" if DTYPE == torch.float16 else None,
            ).to(DEVICE)

        if USE_REFINER:
            log.info("Loading SDXL refiner: %s …", SDXL_REFINER_MODEL)
            _refiner_pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
                SDXL_REFINER_MODEL,
                torch_dtype=DTYPE,
                use_safetensors=True,
                variant="fp16" if DTYPE == torch.float16 else None,
            ).to(DEVICE)

        _model_loaded = True
        log.info("SDXL models loaded on %s.", DEVICE)
    except Exception:
        log.error("Failed to load SDXL models:\n%s", traceback.format_exc())

    yield

    _base_pipe = None
    _refiner_pipe = None
    _controlnet_pipe = None
    _model_loaded = False
    if DEVICE == "cuda":
        torch.cuda.empty_cache()
    log.info("SDXL models unloaded.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Viralix SDXL Worker", version="1.0.0", lifespan=lifespan)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok" if _model_loaded else "degraded",
        model_loaded=_model_loaded,
        vram_used_gb=_get_vram_used_gb(),
    )


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    if not _model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")

    width, height = _resolve_dimensions(req.width, req.height, req.format)
    prompt = _build_prompt(req.prompt, req.style)
    negative_prompt = req.negative_prompt or DEFAULT_NEGATIVE_PROMPT
    generator, seed = _get_generator(req.seed)

    t0 = time.perf_counter()
    try:
        if req.controlnet_image_b64 and _controlnet_pipe is not None:
            ctrl_image = _b64_to_pil(req.controlnet_image_b64).resize((width, height))
            canny_image = _apply_canny(ctrl_image)
            latents = _controlnet_pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                image=canny_image,
                num_inference_steps=req.steps,
                guidance_scale=req.guidance_scale,
                width=width,
                height=height,
                generator=generator,
                output_type="latent",
            ).images
        else:
            latents = _base_pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                num_inference_steps=req.steps,
                guidance_scale=req.guidance_scale,
                width=width,
                height=height,
                generator=generator,
                output_type="latent",
                denoising_end=1.0 - req.refiner_strength if USE_REFINER else 1.0,
            ).images

        if USE_REFINER and _refiner_pipe is not None and req.refiner_strength > 0:
            images = _refiner_pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                image=latents,
                num_inference_steps=req.steps,
                strength=req.refiner_strength,
                generator=generator,
            ).images
        else:
            # Decode latents directly if no refiner
            from diffusers.image_processor import VaeImageProcessor
            vae = _base_pipe.vae
            latents_decoded = latents / vae.config.scaling_factor
            with torch.no_grad():
                decoded = vae.decode(latents_decoded.to(dtype=DTYPE)).sample
            processor = VaeImageProcessor()
            images = processor.postprocess(decoded, output_type="pil")

        image = images[0]
    except Exception as exc:
        log.error("SDXL generation error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    duration_ms = (time.perf_counter() - t0) * 1000
    image_path = _save_image(image)
    image_b64 = _pil_to_b64(image)

    return GenerateResponse(
        image_b64=image_b64,
        image_path=image_path,
        seed=seed,
        duration_ms=duration_ms,
    )


@app.post("/generate-batch", response_model=BatchResponse)
def generate_batch(req: BatchRequest) -> BatchResponse:
    if not _model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")
    results: list[GenerateResponse | dict] = []
    for item in req.requests:
        try:
            results.append(generate(item))
        except HTTPException as exc:
            results.append({"error": exc.detail})
        except Exception as exc:
            results.append({"error": str(exc)})
    return BatchResponse(results=results)


@app.post("/inpaint", response_model=InpaintResponse)
def inpaint(req: InpaintRequest) -> InpaintResponse:
    if not _model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")

    from diffusers import StableDiffusionXLInpaintPipeline

    image = _b64_to_pil(req.image_b64)
    mask = _b64_to_pil(req.mask_b64).convert("L")
    negative_prompt = req.negative_prompt or DEFAULT_NEGATIVE_PROMPT
    generator, seed = _get_generator(req.seed)

    t0 = time.perf_counter()
    try:
        inpaint_pipe = StableDiffusionXLInpaintPipeline.from_pretrained(
            SDXL_BASE_MODEL,
            torch_dtype=DTYPE,
            use_safetensors=True,
            variant="fp16" if DTYPE == torch.float16 else None,
        ).to(DEVICE)
        result = inpaint_pipe(
            prompt=req.prompt,
            negative_prompt=negative_prompt,
            image=image,
            mask_image=mask,
            num_inference_steps=req.steps,
            guidance_scale=req.guidance_scale,
            strength=req.strength,
            generator=generator,
        ).images[0]
        del inpaint_pipe
        if DEVICE == "cuda":
            torch.cuda.empty_cache()
    except Exception as exc:
        log.error("Inpaint error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    duration_ms = (time.perf_counter() - t0) * 1000
    image_path = _save_image(result)
    image_b64 = _pil_to_b64(result)

    return InpaintResponse(
        image_b64=image_b64,
        image_path=image_path,
        seed=seed,
        duration_ms=duration_ms,
    )
