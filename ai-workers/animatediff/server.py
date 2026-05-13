"""
AnimateDiff image-to-video worker.

Uses AnimateDiffImg2VideoPipeline from diffusers with the
guoyww/animatediff-motion-adapter-v1-5-2 motion adapter to animate
a static input image into a short GIF + MP4.
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
from pathlib import Path
from typing import Any

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("animatediff-worker")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MOTION_ADAPTER_ID = os.getenv(
    "MOTION_ADAPTER_ID", "guoyww/animatediff-motion-adapter-v1-5-2"
)
BASE_MODEL_ID = os.getenv("BASE_MODEL_ID", "SG161222/Realistic_Vision_V5.1_noVAE")
OUTPUTS_DIR = Path(os.getenv("OUTPUTS_DIR", "/outputs"))
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------
_pipeline: Any = None
_model_loaded = False

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ImageToVideoRequest(BaseModel):
    image_b64: str = Field(description="Base64-encoded source image (PNG or JPEG)")
    prompt: str = Field(default="", description="Optional motion prompt")
    negative_prompt: str = Field(default="nsfw, blurry, low quality, watermark")
    motion_strength: float = Field(
        default=1.0,
        ge=0.1,
        le=2.0,
        description="Multiplier applied to motion module attention",
    )
    num_frames: int = Field(default=16, ge=8, le=32)
    fps: int = Field(default=8, ge=4, le=24)
    num_inference_steps: int = Field(default=25, ge=10, le=100)
    guidance_scale: float = Field(default=7.5, ge=1.0, le=20.0)
    seed: int = Field(default=-1)


class ImageToVideoResponse(BaseModel):
    video_path: str
    gif_path: str
    duration_ms: float
    seed: int


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _b64_to_pil(b64: str):
    from PIL import Image  # noqa: PLC0415
    data = base64.b64decode(b64)
    return Image.open(io.BytesIO(data)).convert("RGB")


def _get_generator(seed: int) -> tuple[torch.Generator, int]:
    import random
    if seed == -1:
        seed = random.randint(0, 2**32 - 1)
    gen = torch.Generator(device=DEVICE).manual_seed(seed)
    return gen, seed


def _frames_to_gif(frames: list, path: str, fps: int) -> None:
    """Save a list of PIL frames as an animated GIF."""
    from PIL import Image  # noqa: PLC0415
    first, *rest = [
        f if isinstance(f, Image.Image) else Image.fromarray(f)
        for f in frames
    ]
    first.save(
        path,
        save_all=True,
        append_images=rest,
        loop=0,
        duration=int(1000 / fps),
        optimize=False,
    )


def _frames_to_mp4(frames: list, path: str, fps: int) -> None:
    """Save a list of PIL frames as an MP4 using imageio."""
    import numpy as np
    import imageio  # noqa: PLC0415
    from PIL import Image  # noqa: PLC0415

    np_frames = [
        np.array(f if isinstance(f, Image.Image) else Image.fromarray(f))
        for f in frames
    ]
    imageio.mimwrite(path, np_frames, fps=fps, codec="libx264", quality=8)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pipeline, _model_loaded

    log.info(
        "Loading AnimateDiff motion adapter: %s with base model: %s …",
        MOTION_ADAPTER_ID,
        BASE_MODEL_ID,
    )
    try:
        from diffusers import AnimateDiffImg2VideoPipeline, MotionAdapter  # noqa: PLC0415
        from diffusers.utils import load_image  # noqa: PLC0415

        adapter = MotionAdapter.from_pretrained(
            MOTION_ADAPTER_ID,
            torch_dtype=DTYPE,
        )
        _pipeline = AnimateDiffImg2VideoPipeline.from_pretrained(
            BASE_MODEL_ID,
            motion_adapter=adapter,
            torch_dtype=DTYPE,
        ).to(DEVICE)
        _pipeline.enable_attention_slicing()

        _model_loaded = True
        log.info("AnimateDiff pipeline loaded on %s.", DEVICE)
    except Exception:
        log.error("Failed to load AnimateDiff:\n%s", traceback.format_exc())

    yield

    _pipeline = None
    _model_loaded = False
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    log.info("AnimateDiff pipeline unloaded.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Viralix AnimateDiff Worker",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok" if _model_loaded else "degraded",
        model_loaded=_model_loaded,
    )


@app.post("/image-to-video", response_model=ImageToVideoResponse)
def image_to_video(req: ImageToVideoRequest) -> ImageToVideoResponse:
    if not _model_loaded or _pipeline is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    source_image = _b64_to_pil(req.image_b64)
    generator, seed = _get_generator(req.seed)

    t0 = time.perf_counter()
    try:
        output = _pipeline(
            image=source_image,
            prompt=req.prompt or None,
            negative_prompt=req.negative_prompt,
            num_frames=req.num_frames,
            num_inference_steps=req.num_inference_steps,
            guidance_scale=req.guidance_scale,
            generator=generator,
        )
        frames = output.frames[0]
    except Exception as exc:
        log.error("AnimateDiff generation error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    duration_ms = (time.perf_counter() - t0) * 1000
    stem = uuid.uuid4().hex

    gif_path = str(OUTPUTS_DIR / f"{stem}.gif")
    video_path = str(OUTPUTS_DIR / f"{stem}.mp4")

    _frames_to_gif(frames, gif_path, req.fps)
    _frames_to_mp4(frames, video_path, req.fps)

    log.info(
        "AnimateDiff: generated %d frames → %s (%.0f ms, seed=%d)",
        len(frames),
        video_path,
        duration_ms,
        seed,
    )

    return ImageToVideoResponse(
        video_path=video_path,
        gif_path=gif_path,
        duration_ms=duration_ms,
        seed=seed,
    )
