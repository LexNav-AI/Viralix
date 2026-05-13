"""
CogVideoX inference worker.

Loads THUDM/CogVideoX-5b via diffusers and generates MP4 video clips from
text prompts. A thumbnail PNG is extracted from the first frame. All outputs
are saved to /outputs/.
"""

from __future__ import annotations

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
log = logging.getLogger("cogvideo-worker")

# ---------------------------------------------------------------------------
# Config from env
# ---------------------------------------------------------------------------
COGVIDEO_MODEL = os.getenv("COGVIDEO_MODEL", "THUDM/CogVideoX-5b")
OUTPUTS_DIR = Path(os.getenv("OUTPUTS_DIR", "/outputs"))
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE = torch.bfloat16 if DEVICE == "cuda" else torch.float32  # CogVideoX recommends bfloat16

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------
_pipeline: Any = None
_model_loaded = False

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class GenerateRequest(BaseModel):
    prompt: str = Field(description="Descriptive text prompt for the video")
    duration_seconds: float = Field(default=5.0, ge=1.0, le=10.0)
    width: int = Field(default=720, ge=256, le=1280)
    height: int = Field(default=480, ge=256, le=720)
    fps: int = Field(default=8, ge=4, le=24)
    seed: int = Field(default=-1, description="-1 for random")
    num_inference_steps: int = Field(default=50, ge=10, le=100)
    guidance_scale: float = Field(default=6.0, ge=1.0, le=20.0)


class GenerateResponse(BaseModel):
    video_path: str
    thumbnail_path: str
    duration_ms: float
    seed: int


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_generator(seed: int) -> tuple[torch.Generator, int]:
    import random
    if seed == -1:
        seed = random.randint(0, 2**32 - 1)
    gen = torch.Generator(device=DEVICE).manual_seed(seed)
    return gen, seed


def _save_thumbnail(frames: list, output_stem: str) -> str:
    """Save the first frame as a PNG thumbnail and return its path."""
    from PIL import Image  # noqa: PLC0415
    frame = frames[0]
    if not isinstance(frame, Image.Image):
        # frames may be numpy arrays depending on diffusers version
        import numpy as np
        frame = Image.fromarray((frame * 255).astype("uint8") if frame.max() <= 1.0 else frame)
    thumb_path = str(OUTPUTS_DIR / f"{output_stem}_thumb.png")
    frame.save(thumb_path, format="PNG")
    return thumb_path


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pipeline, _model_loaded

    log.info("Loading CogVideoX pipeline: %s …", COGVIDEO_MODEL)
    try:
        from diffusers import CogVideoXPipeline  # noqa: PLC0415

        _pipeline = CogVideoXPipeline.from_pretrained(
            COGVIDEO_MODEL,
            torch_dtype=DTYPE,
        )
        _pipeline.enable_model_cpu_offload()
        _pipeline.vae.enable_slicing()
        _pipeline.vae.enable_tiling()

        _model_loaded = True
        log.info("CogVideoX pipeline loaded on %s.", DEVICE)
    except Exception:
        log.error("Failed to load CogVideoX:\n%s", traceback.format_exc())

    yield

    _pipeline = None
    _model_loaded = False
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    log.info("CogVideoX pipeline unloaded.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Viralix CogVideoX Worker", version="1.0.0", lifespan=lifespan)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok" if _model_loaded else "degraded",
        model_loaded=_model_loaded,
    )


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    if not _model_loaded or _pipeline is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    import imageio  # noqa: PLC0415

    generator, seed = _get_generator(req.seed)
    num_frames = max(1, int(req.duration_seconds * req.fps))

    t0 = time.perf_counter()
    try:
        output = _pipeline(
            prompt=req.prompt,
            num_frames=num_frames,
            num_inference_steps=req.num_inference_steps,
            guidance_scale=req.guidance_scale,
            width=req.width,
            height=req.height,
            generator=generator,
        )
        frames = output.frames[0]  # list of PIL Images
    except Exception as exc:
        log.error("CogVideoX generation error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    duration_ms = (time.perf_counter() - t0) * 1000

    stem = uuid.uuid4().hex
    video_path = str(OUTPUTS_DIR / f"{stem}.mp4")
    thumbnail_path = _save_thumbnail(frames, stem)

    # Export frames to MP4
    try:
        from diffusers.utils import export_to_video  # noqa: PLC0415
        export_to_video(frames, video_path, fps=req.fps)
    except Exception:
        # Fallback: write with imageio directly
        import numpy as np
        np_frames = [
            (f if isinstance(f, type(frames[0])) else f)
            for f in frames
        ]
        imageio.mimwrite(video_path, np_frames, fps=req.fps, codec="libx264")

    log.info(
        "Generated video: %s (%d frames, %.1f s, seed=%d)",
        video_path,
        num_frames,
        req.duration_seconds,
        seed,
    )

    return GenerateResponse(
        video_path=video_path,
        thumbnail_path=thumbnail_path,
        duration_ms=duration_ms,
        seed=seed,
    )
