"""
Kokoro TTS worker.

Uses the kokoro Python package (KPipeline) to synthesise speech from text.
Supports multiple voice presets, speed control, and MP3/WAV output.
Long texts are chunked at sentence boundaries before synthesis and the
resulting audio segments are concatenated.
"""

from __future__ import annotations

import logging
import os
import re
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("kokoro-tts-worker")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
OUTPUTS_DIR = Path(os.getenv("OUTPUTS_DIR", "/outputs"))
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_RATE = int(os.getenv("SAMPLE_RATE", "24000"))
MAX_CHUNK_CHARS = int(os.getenv("MAX_CHUNK_CHARS", "500"))

# ---------------------------------------------------------------------------
# Voice registry
# ---------------------------------------------------------------------------
VOICE_REGISTRY: list[dict] = [
    {"id": "af_heart",   "name": "Heart",   "gender": "female", "accent": "american"},
    {"id": "af_sky",     "name": "Sky",     "gender": "female", "accent": "american"},
    {"id": "af_bella",   "name": "Bella",   "gender": "female", "accent": "american"},
    {"id": "am_michael", "name": "Michael", "gender": "male",   "accent": "american"},
    {"id": "am_adam",    "name": "Adam",    "gender": "male",   "accent": "american"},
    {"id": "bf_emma",    "name": "Emma",    "gender": "female", "accent": "british"},
    {"id": "bm_george",  "name": "George",  "gender": "male",   "accent": "british"},
]
VALID_VOICE_IDS = {v["id"] for v in VOICE_REGISTRY}
DEFAULT_VOICE = "af_heart"

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------
_kpipeline: Any = None
_model_loaded = False

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class GenerateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50_000)
    voice: str = Field(default=DEFAULT_VOICE)
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    format: str = Field(default="mp3", description="mp3 or wav")


class GenerateResponse(BaseModel):
    audio_path: str
    duration_seconds: float


class VoiceInfo(BaseModel):
    id: str
    name: str
    gender: str
    accent: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool


# ---------------------------------------------------------------------------
# Text chunking
# ---------------------------------------------------------------------------

_SENTENCE_END = re.compile(r'(?<=[.!?])\s+')


def _chunk_text(text: str, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    """
    Split text into chunks ≤ max_chars at sentence boundaries.
    Falls back to word-boundary splits when a single sentence exceeds max_chars.
    """
    sentences = _SENTENCE_END.split(text.strip())
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        # If the sentence itself is too long, split at word boundaries
        if len(sentence) > max_chars:
            words = sentence.split()
            for word in words:
                if len(current) + len(word) + 1 > max_chars:
                    if current:
                        chunks.append(current.strip())
                    current = word
                else:
                    current = (current + " " + word).strip()
            continue

        if len(current) + len(sentence) + 1 > max_chars:
            if current:
                chunks.append(current.strip())
            current = sentence
        else:
            current = (current + " " + sentence).strip()

    if current:
        chunks.append(current.strip())

    return chunks or [text[:max_chars]]


# ---------------------------------------------------------------------------
# Audio helpers
# ---------------------------------------------------------------------------


def _audio_duration(audio: np.ndarray, sample_rate: int) -> float:
    return len(audio) / sample_rate


def _save_audio(audio: np.ndarray, fmt: str) -> str:
    stem = uuid.uuid4().hex
    if fmt == "wav":
        path = str(OUTPUTS_DIR / f"{stem}.wav")
        sf.write(path, audio, SAMPLE_RATE, subtype="PCM_16")
    else:
        # Save as WAV then convert to MP3 using ffmpeg subprocess
        import subprocess  # noqa: PLC0415
        wav_path = str(OUTPUTS_DIR / f"{stem}.wav")
        mp3_path = str(OUTPUTS_DIR / f"{stem}.mp3")
        sf.write(wav_path, audio, SAMPLE_RATE, subtype="PCM_16")
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", wav_path,
                "-codec:a", "libmp3lame", "-q:a", "2",
                mp3_path,
            ],
            check=True,
            capture_output=True,
        )
        os.unlink(wav_path)
        path = mp3_path
    return path


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _kpipeline, _model_loaded

    log.info("Initialising Kokoro KPipeline …")
    try:
        from kokoro import KPipeline  # noqa: PLC0415

        # lang_code "a" = American English (covers all af_* and am_* voices)
        # We instantiate one pipeline; British voices also work via voice ID.
        _kpipeline = KPipeline(lang_code="a")
        _model_loaded = True
        log.info("Kokoro KPipeline ready.")
    except Exception as exc:
        log.error("Failed to load Kokoro: %s", exc)

    yield

    _kpipeline = None
    _model_loaded = False
    log.info("Kokoro pipeline unloaded.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Viralix Kokoro TTS Worker", version="1.0.0", lifespan=lifespan)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok" if _model_loaded else "degraded",
        model_loaded=_model_loaded,
    )


@app.get("/voices", response_model=list[VoiceInfo])
def voices() -> list[VoiceInfo]:
    return [VoiceInfo(**v) for v in VOICE_REGISTRY]


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    if not _model_loaded or _kpipeline is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    voice_id = req.voice if req.voice in VALID_VOICE_IDS else DEFAULT_VOICE
    fmt = req.format.lower() if req.format.lower() in ("mp3", "wav") else "mp3"

    chunks = _chunk_text(req.text)
    log.info("TTS: %d chunk(s) for voice=%s speed=%.1f", len(chunks), voice_id, req.speed)

    audio_segments: list[np.ndarray] = []
    t0 = time.perf_counter()

    try:
        for chunk in chunks:
            # KPipeline.__call__ is a generator yielding (graphemes, phonemes, audio_np)
            for _, _, audio in _kpipeline(chunk, voice=voice_id, speed=req.speed):
                if audio is not None and len(audio) > 0:
                    audio_segments.append(audio)
    except Exception as exc:
        log.error("TTS synthesis error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not audio_segments:
        raise HTTPException(status_code=500, detail="No audio generated")

    combined = np.concatenate(audio_segments, axis=0)
    duration_seconds = _audio_duration(combined, SAMPLE_RATE)
    audio_path = _save_audio(combined, fmt)

    elapsed_ms = (time.perf_counter() - t0) * 1000
    log.info(
        "TTS complete: %.2fs audio in %.0f ms → %s",
        duration_seconds,
        elapsed_ms,
        audio_path,
    )

    return GenerateResponse(audio_path=audio_path, duration_seconds=duration_seconds)
