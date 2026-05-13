"""
Llama 3 70B inference worker.

Loads a 4-bit GGUF model via llama-cpp-python and exposes FastAPI endpoints
for general generation, ad-copy generation, batch generation, and health checks.
A threading lock serialises inference so the model is never called concurrently.
"""

from __future__ import annotations

import logging
import os
import threading
import time
import traceback
from contextlib import asynccontextmanager
from typing import Any

import psutil
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

import config
from llama_cpp import Llama

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("llama-worker")

# ---------------------------------------------------------------------------
# Global model state
# ---------------------------------------------------------------------------
_model: Llama | None = None
_model_lock = threading.Lock()
_model_loaded = False

# ---------------------------------------------------------------------------
# Pydantic request / response models
# ---------------------------------------------------------------------------


class GenerateRequest(BaseModel):
    prompt: str
    system_prompt: str = "You are a helpful assistant."
    max_tokens: int = Field(default=config.DEFAULT_MAX_TOKENS, ge=1, le=8192)
    temperature: float = Field(default=config.DEFAULT_TEMPERATURE, ge=0.0, le=2.0)
    top_p: float = Field(default=config.DEFAULT_TOP_P, ge=0.0, le=1.0)
    top_k: int = Field(default=config.DEFAULT_TOP_K, ge=0, le=200)
    repeat_penalty: float = Field(default=config.DEFAULT_REPEAT_PENALTY, ge=1.0, le=2.0)
    stop: list[str] = Field(default_factory=list)


class GenerateResponse(BaseModel):
    text: str
    tokens_used: int
    duration_ms: float


class AdCopyRequest(BaseModel):
    format: str = Field(
        description="One of: static_image, story, banner, carousel, reel, video_ad"
    )
    platform: str = Field(
        description="One of: instagram, facebook, tiktok, youtube, google, linkedin"
    )
    product_name: str
    product_description: str
    tone: str = Field(
        default="professional",
        description="e.g. professional, casual, humorous, urgent, inspirational",
    )
    keywords: list[str] = Field(default_factory=list)
    forbidden_words: list[str] = Field(default_factory=list)
    cta: str = Field(default="Shop Now")
    target_audience: str = Field(default="general consumers")
    examples: list[str] = Field(
        default_factory=list,
        description="Up to 3 example ads in the desired style",
    )
    max_tokens: int = Field(default=512, ge=64, le=2048)
    temperature: float = Field(default=0.85, ge=0.0, le=2.0)


class AdCopyResponse(BaseModel):
    headline: str
    body_text: str
    cta_text: str
    alternative_headlines: list[str]
    tokens_used: int
    duration_ms: float


class BatchRequest(BaseModel):
    requests: list[GenerateRequest]


class BatchResponse(BaseModel):
    results: list[GenerateResponse | dict]


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    vram_used_gb: float


# ---------------------------------------------------------------------------
# Model helpers
# ---------------------------------------------------------------------------

AD_COPY_SYSTEM_PROMPT = """You are an elite performance marketing copywriter with 15 years of
experience crafting high-converting ad copy for direct-response campaigns.

Your copy always:
- Leads with the customer's pain point or desire
- Uses power words that trigger emotion and urgency
- Has a crystal-clear value proposition in the headline
- Stays platform-native (length, tone, emoji usage for the target platform)
- Avoids hype or unsubstantiated claims
- Ends with a compelling, action-oriented CTA
- Obeys all brand-voice constraints and forbidden-word lists provided

Output ONLY a JSON object with keys: headline, body_text, cta_text, alternative_headlines (array of 3 strings).
No markdown fences, no extra commentary."""


def _build_ad_copy_prompt(req: AdCopyRequest) -> str:
    examples_block = ""
    if req.examples:
        examples_block = "\n\nSTYLE EXAMPLES (match this voice):\n" + "\n---\n".join(
            req.examples[: 3]
        )

    forbidden_block = ""
    if req.forbidden_words:
        forbidden_block = (
            f"\n\nFORBIDDEN WORDS / PHRASES (never use): {', '.join(req.forbidden_words)}"
        )

    keywords_block = ""
    if req.keywords:
        keywords_block = (
            f"\n\nKEYWORDS TO INCORPORATE: {', '.join(req.keywords)}"
        )

    return f"""Create high-converting ad copy for the following campaign:

PLATFORM: {req.platform}
FORMAT: {req.format}
PRODUCT: {req.product_name}
PRODUCT DESCRIPTION: {req.product_description}
TONE: {req.tone}
TARGET AUDIENCE: {req.target_audience}
PRIMARY CTA: {req.cta}{keywords_block}{forbidden_block}{examples_block}

Platform-specific guidelines:
- instagram/tiktok: Max 125 chars headline, 2200 chars body, emoji-friendly, hashtag-ready
- facebook: Max 40 chars headline (primary text up to 500 chars), focus on value prop
- youtube: Hook within first 5 words (non-skippable window)
- google: Max 30 chars headline, 90 chars description, include keyword naturally
- linkedin: Professional tone, B2B framing, lead with business outcome

Respond with ONLY the JSON object."""


def _format_messages(system_prompt: str, user_prompt: str) -> str:
    """Format messages in Llama 3 chat template."""
    return (
        "<|begin_of_text|>"
        "<|start_header_id|>system<|end_header_id|>\n\n"
        f"{system_prompt.strip()}"
        "<|eot_id|>"
        "<|start_header_id|>user<|end_header_id|>\n\n"
        f"{user_prompt.strip()}"
        "<|eot_id|>"
        "<|start_header_id|>assistant<|end_header_id|>\n\n"
    )


def _run_inference(
    prompt_text: str,
    max_tokens: int,
    temperature: float,
    top_p: float,
    top_k: int,
    repeat_penalty: float,
    stop: list[str] | None = None,
) -> tuple[str, int, float]:
    """Run inference under the global lock. Returns (text, tokens_used, duration_ms)."""
    global _model
    if _model is None:
        raise RuntimeError("Model not loaded")

    stop_sequences = (stop or []) + ["<|eot_id|>", "<|end_of_text|>"]

    t0 = time.perf_counter()
    with _model_lock:
        output = _model(
            prompt_text,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            repeat_penalty=repeat_penalty,
            stop=stop_sequences,
            echo=False,
        )
    duration_ms = (time.perf_counter() - t0) * 1000

    text: str = output["choices"][0]["text"].strip()
    tokens_used: int = (
        output.get("usage", {}).get("completion_tokens", 0)
        + output.get("usage", {}).get("prompt_tokens", 0)
    )
    return text, tokens_used, duration_ms


def _get_vram_used_gb() -> float:
    """Return GPU VRAM used in GB (best-effort; returns 0.0 if unavailable)."""
    try:
        import subprocess
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if result.returncode == 0:
            mb = float(result.stdout.strip().split("\n")[0])
            return round(mb / 1024, 2)
    except Exception:
        pass
    return 0.0


# ---------------------------------------------------------------------------
# Lifespan — load model on startup
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model, _model_loaded
    log.info("Loading Llama model from %s …", config.MODEL_PATH)
    if not os.path.exists(config.MODEL_PATH):
        log.error("Model file not found at %s — continuing without model", config.MODEL_PATH)
    else:
        try:
            _model = Llama(
                model_path=config.MODEL_PATH,
                n_ctx=config.N_CTX,
                n_batch=config.N_BATCH,
                n_threads=config.N_THREADS,
                n_gpu_layers=config.N_GPU_LAYERS,
                verbose=False,
                use_mmap=True,
                use_mlock=False,
            )
            _model_loaded = True
            log.info("Model loaded successfully.")
        except Exception:
            log.error("Failed to load model:\n%s", traceback.format_exc())
    yield
    # Teardown
    _model = None
    _model_loaded = False
    log.info("Model unloaded.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Viralix Llama 3 70B Worker",
    version="1.0.0",
    lifespan=lifespan,
)


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
    try:
        prompt_text = _format_messages(req.system_prompt, req.prompt)
        text, tokens_used, duration_ms = _run_inference(
            prompt_text=prompt_text,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
            top_p=req.top_p,
            top_k=req.top_k,
            repeat_penalty=req.repeat_penalty,
            stop=req.stop,
        )
        return GenerateResponse(text=text, tokens_used=tokens_used, duration_ms=duration_ms)
    except Exception as exc:
        log.error("Inference error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/generate-ad-copy", response_model=AdCopyResponse)
def generate_ad_copy(req: AdCopyRequest) -> AdCopyResponse:
    if not _model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")
    import json
    import re

    prompt_text = _format_messages(AD_COPY_SYSTEM_PROMPT, _build_ad_copy_prompt(req))
    try:
        text, tokens_used, duration_ms = _run_inference(
            prompt_text=prompt_text,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
            top_p=0.92,
            top_k=50,
            repeat_penalty=1.05,
            stop=["```"],
        )
    except Exception as exc:
        log.error("Ad copy inference error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Strip potential markdown fences the model may emit despite instructions
    clean = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
    clean = re.sub(r"\s*```$", "", clean)

    try:
        data: dict[str, Any] = json.loads(clean)
    except json.JSONDecodeError:
        # Attempt partial extraction using regex
        headline_match = re.search(r'"headline"\s*:\s*"([^"]+)"', clean)
        body_match = re.search(r'"body_text"\s*:\s*"([^"]+)"', clean, re.DOTALL)
        cta_match = re.search(r'"cta_text"\s*:\s*"([^"]+)"', clean)
        alts_match = re.findall(r'"([^"]{10,80})"', clean)
        data = {
            "headline": headline_match.group(1) if headline_match else text[:60],
            "body_text": body_match.group(1) if body_match else text,
            "cta_text": cta_match.group(1) if cta_match else req.cta,
            "alternative_headlines": alts_match[:3] if alts_match else [],
        }

    return AdCopyResponse(
        headline=data.get("headline", "")[:255],
        body_text=data.get("body_text", ""),
        cta_text=data.get("cta_text", req.cta),
        alternative_headlines=data.get("alternative_headlines", [])[:3],
        tokens_used=tokens_used,
        duration_ms=duration_ms,
    )


@app.post("/generate-batch", response_model=BatchResponse)
def generate_batch(req: BatchRequest) -> BatchResponse:
    if not _model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")
    results: list[GenerateResponse | dict] = []
    for item in req.requests:
        try:
            prompt_text = _format_messages(item.system_prompt, item.prompt)
            text, tokens_used, duration_ms = _run_inference(
                prompt_text=prompt_text,
                max_tokens=item.max_tokens,
                temperature=item.temperature,
                top_p=item.top_p,
                top_k=item.top_k,
                repeat_penalty=item.repeat_penalty,
                stop=item.stop,
            )
            results.append(GenerateResponse(text=text, tokens_used=tokens_used, duration_ms=duration_ms))
        except Exception as exc:
            results.append({"error": str(exc)})
    return BatchResponse(results=results)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host=config.HOST, port=config.PORT, workers=1)
