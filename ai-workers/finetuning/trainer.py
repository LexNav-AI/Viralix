"""
Viralix Fine-tuning Worker.

Exposes a FastAPI server that accepts fine-tuning job requests and runs
them in background threads:

  - Llama 3 (text): LoRA via peft + SFTTrainer (trl)
  - SDXL (image): DreamBooth via diffusers

Job state is tracked in-process; for production, replace _JOBS dict with
a Redis or DB-backed store.
"""

from __future__ import annotations

import logging
import os
import threading
import time
import traceback
import uuid
from contextlib import asynccontextmanager
from enum import Enum
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("finetuning-worker")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MODELS_DIR = Path(os.getenv("MODELS_DIR", "/models"))
DATASETS_DIR = Path(os.getenv("DATASETS_DIR", "/datasets"))
MODELS_DIR.mkdir(parents=True, exist_ok=True)
DATASETS_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_LLAMA_BASE = os.getenv(
    "DEFAULT_LLAMA_BASE", "meta-llama/Meta-Llama-3-8B-Instruct"
)
DEFAULT_SDXL_BASE = os.getenv(
    "DEFAULT_SDXL_BASE", "stabilityai/stable-diffusion-xl-base-1.0"
)

# ---------------------------------------------------------------------------
# Job state
# ---------------------------------------------------------------------------


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobState:
    def __init__(self, job_id: str):
        self.job_id = job_id
        self.status = JobStatus.QUEUED
        self.progress: float = 0.0           # 0.0 – 100.0
        self.metrics: dict[str, Any] = {}
        self.output_path: str = ""
        self.error: str = ""
        self._cancel_event = threading.Event()


# Global job registry
_JOBS: dict[str, JobState] = {}
_JOBS_LOCK = threading.Lock()


def _register_job(job_id: str) -> JobState:
    state = JobState(job_id)
    with _JOBS_LOCK:
        _JOBS[job_id] = state
    return state


def _get_job(job_id: str) -> JobState:
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
    if job is None:
        raise KeyError(job_id)
    return job


# ---------------------------------------------------------------------------
# Pydantic request/response models
# ---------------------------------------------------------------------------


class TrainingSample(BaseModel):
    prompt: str
    completion: str


class StartFinetuneRequest(BaseModel):
    workspace_id: str
    model_type: str = Field(
        description="'llama' for text LoRA, 'sdxl' for DreamBooth image"
    )
    training_samples: list[TrainingSample]
    base_model: str = Field(default="")
    epochs: int = Field(default=3, ge=1, le=20)
    lr: float = Field(default=2e-4, gt=0.0)


class StartFinetuneResponse(BaseModel):
    job_id: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: float
    metrics: dict[str, Any]
    output_path: str
    error: str


# ---------------------------------------------------------------------------
# LoRA / Llama fine-tuning
# ---------------------------------------------------------------------------

LORA_CONFIG = dict(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)


def _run_llama_finetune(
    job: JobState,
    workspace_id: str,
    training_samples: list[TrainingSample],
    base_model: str,
    epochs: int,
    lr: float,
) -> None:
    import torch  # noqa: PLC0415
    from datasets import Dataset  # noqa: PLC0415
    from peft import LoraConfig, get_peft_model  # noqa: PLC0415
    from transformers import (  # noqa: PLC0415
        AutoModelForCausalLM,
        AutoTokenizer,
        TrainingArguments,
    )
    from trl import SFTConfig, SFTTrainer  # noqa: PLC0415

    from data_pipeline import _build_llama_instruction  # noqa: PLC0415

    output_dir = MODELS_DIR / "finetunes" / workspace_id / "llama"
    output_dir.mkdir(parents=True, exist_ok=True)

    job.status = JobStatus.RUNNING
    job.progress = 2.0

    # ---- Tokenizer ----
    log.info("[%s] Loading tokenizer: %s", job.job_id, base_model)
    tokenizer = AutoTokenizer.from_pretrained(base_model, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    job.progress = 5.0

    # ---- Model (4-bit via bitsandbytes) ----
    log.info("[%s] Loading base model (4-bit bnb): %s", job.job_id, base_model)
    from transformers import BitsAndBytesConfig  # noqa: PLC0415

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        quantization_config=bnb_config,
        device_map="auto",
    )
    model.config.use_cache = False

    # ---- Apply LoRA ----
    lora_cfg = LoraConfig(**LORA_CONFIG)
    model = get_peft_model(model, lora_cfg)
    model.print_trainable_parameters()
    job.progress = 10.0

    # ---- Dataset ----
    texts = [
        _build_llama_instruction({"prompt": s.prompt, "completion": s.completion})
        for s in training_samples
    ]
    hf_dataset = Dataset.from_dict({"text": texts})
    job.progress = 12.0

    # ---- Training ----
    sft_config = SFTConfig(
        output_dir=str(output_dir / "checkpoints"),
        num_train_epochs=epochs,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        learning_rate=lr,
        fp16=torch.cuda.is_available(),
        logging_steps=5,
        save_steps=50,
        save_total_limit=2,
        dataloader_pin_memory=False,
        report_to="none",
        dataset_text_field="text",
        max_seq_length=2048,
    )

    class _ProgressCallback:
        def on_log(self, args, state, control, logs=None, **kwargs):
            if logs and state.max_steps > 0:
                pct = 12.0 + (state.global_step / state.max_steps) * 80.0
                job.progress = min(pct, 92.0)
                job.metrics = {k: v for k, v in logs.items() if isinstance(v, (int, float))}

    trainer = SFTTrainer(
        model=model,
        train_dataset=hf_dataset,
        args=sft_config,
        callbacks=[_ProgressCallback()],
    )

    log.info("[%s] Starting LoRA training (%d samples, %d epochs)", job.job_id, len(texts), epochs)
    trainer.train()
    job.progress = 93.0

    # ---- Save adapter ----
    adapter_path = str(output_dir / "adapter")
    model.save_pretrained(adapter_path)
    tokenizer.save_pretrained(adapter_path)
    log.info("[%s] LoRA adapter saved to %s", job.job_id, adapter_path)

    job.output_path = adapter_path
    job.progress = 100.0
    job.status = JobStatus.COMPLETED


# ---------------------------------------------------------------------------
# SDXL DreamBooth fine-tuning
# ---------------------------------------------------------------------------


def _run_sdxl_finetune(
    job: JobState,
    workspace_id: str,
    training_samples: list[TrainingSample],
    base_model: str,
    epochs: int,
    lr: float,
) -> None:
    """
    DreamBooth fine-tuning for SDXL.

    training_samples here repurposes the prompt/completion fields as:
        prompt    → the text prompt describing the image
        completion → absolute local path to the image file
    """
    import torch  # noqa: PLC0415
    from diffusers import AutoencoderKL, StableDiffusionXLPipeline  # noqa: PLC0415
    from diffusers.training_utils import unet_lora_state_dict  # noqa: PLC0415
    from peft import LoraConfig  # noqa: PLC0415
    from transformers import CLIPTextModel, CLIPTokenizer  # noqa: PLC0415

    output_dir = MODELS_DIR / "finetunes" / workspace_id / "sdxl"
    output_dir.mkdir(parents=True, exist_ok=True)

    job.status = JobStatus.RUNNING
    job.progress = 2.0

    # Build a minimal HuggingFace dataset from the samples
    from datasets import Dataset  # noqa: PLC0415
    from PIL import Image  # noqa: PLC0415

    image_list, prompt_list = [], []
    for s in training_samples:
        img_path = Path(s.completion)
        if not img_path.exists():
            log.warning("[%s] Image not found, skipping: %s", job.job_id, img_path)
            continue
        img = Image.open(img_path).convert("RGB").resize((1024, 1024))
        image_list.append(img)
        prompt_list.append(s.prompt)

    if not image_list:
        raise ValueError("No valid training images found")

    hf_dataset = Dataset.from_dict({"image": image_list, "text": prompt_list})
    job.progress = 8.0

    # Load pipeline components
    log.info("[%s] Loading SDXL pipeline: %s", job.job_id, base_model)
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    pipeline = StableDiffusionXLPipeline.from_pretrained(
        base_model,
        torch_dtype=dtype,
        use_safetensors=True,
    )
    unet = pipeline.unet
    vae = pipeline.vae
    text_encoder = pipeline.text_encoder
    text_encoder_2 = pipeline.text_encoder_2
    tokenizer = pipeline.tokenizer
    tokenizer_2 = pipeline.tokenizer_2

    job.progress = 15.0

    # Apply LoRA to UNet
    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["to_q", "to_v"],
        lora_dropout=0.05,
        bias="none",
    )
    from peft import get_peft_model  # noqa: PLC0415
    unet = get_peft_model(unet, lora_config)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    unet = unet.to(device, dtype=dtype)
    vae = vae.to(device, dtype=dtype)
    text_encoder = text_encoder.to(device, dtype=dtype)
    text_encoder_2 = text_encoder_2.to(device, dtype=dtype)

    optimizer = torch.optim.AdamW(unet.parameters(), lr=lr)
    import torch.nn.functional as F  # noqa: PLC0415

    total_steps = len(hf_dataset) * epochs
    step = 0

    for epoch in range(epochs):
        if job._cancel_event.is_set():
            job.status = JobStatus.CANCELLED
            return

        for sample in hf_dataset:
            if job._cancel_event.is_set():
                job.status = JobStatus.CANCELLED
                return

            img = sample["image"]
            import numpy as np  # noqa: PLC0415
            img_tensor = torch.from_numpy(np.array(img)).permute(2, 0, 1).float() / 127.5 - 1.0
            img_tensor = img_tensor.unsqueeze(0).to(device, dtype=dtype)

            # Encode image through VAE
            with torch.no_grad():
                latents = vae.encode(img_tensor).latent_dist.sample()
                latents = latents * vae.config.scaling_factor

            # Random noise + timestep
            noise = torch.randn_like(latents)
            bsz = latents.shape[0]
            timesteps = torch.randint(
                0, pipeline.scheduler.config.num_train_timesteps,
                (bsz,), device=device,
            ).long()
            noisy_latents = pipeline.scheduler.add_noise(latents, noise, timesteps)

            # Encode text
            text = sample["text"]
            t_ids = tokenizer(
                text, padding="max_length", truncation=True,
                max_length=tokenizer.model_max_length, return_tensors="pt",
            ).input_ids.to(device)
            t2_ids = tokenizer_2(
                text, padding="max_length", truncation=True,
                max_length=tokenizer_2.model_max_length, return_tensors="pt",
            ).input_ids.to(device)

            with torch.no_grad():
                enc1 = text_encoder(t_ids, output_hidden_states=True)
                enc2 = text_encoder_2(t2_ids, output_hidden_states=True)
                prompt_embeds = torch.cat(
                    [enc1.hidden_states[-2], enc2.hidden_states[-2]], dim=-1
                )
                pooled_embeds = enc2[0]

            # UNet forward
            added_cond = {
                "time_ids": torch.tensor(
                    [[1024, 1024, 0, 0, 1024, 1024]], device=device, dtype=dtype
                ),
                "text_embeds": pooled_embeds,
            }
            noise_pred = unet(
                noisy_latents,
                timesteps,
                encoder_hidden_states=prompt_embeds,
                added_cond_kwargs=added_cond,
            ).sample

            loss = F.mse_loss(noise_pred.float(), noise.float(), reduction="mean")
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            step += 1
            pct = 15.0 + (step / max(total_steps, 1)) * 80.0
            job.progress = min(pct, 95.0)
            job.metrics = {"loss": round(loss.item(), 6), "step": step, "epoch": epoch + 1}

    # Save LoRA weights
    adapter_path = str(output_dir / "unet_lora")
    unet.save_pretrained(adapter_path)
    log.info("[%s] SDXL LoRA adapter saved to %s", job.job_id, adapter_path)

    job.output_path = adapter_path
    job.progress = 100.0
    job.status = JobStatus.COMPLETED


# ---------------------------------------------------------------------------
# Background training dispatcher
# ---------------------------------------------------------------------------


def _training_thread(
    job: JobState,
    req: "StartFinetuneRequest",
) -> None:
    try:
        base_model = req.base_model or (
            DEFAULT_LLAMA_BASE if req.model_type == "llama" else DEFAULT_SDXL_BASE
        )

        if req.model_type == "llama":
            _run_llama_finetune(
                job=job,
                workspace_id=req.workspace_id,
                training_samples=req.training_samples,
                base_model=base_model,
                epochs=req.epochs,
                lr=req.lr,
            )
        elif req.model_type == "sdxl":
            _run_sdxl_finetune(
                job=job,
                workspace_id=req.workspace_id,
                training_samples=req.training_samples,
                base_model=base_model,
                epochs=req.epochs,
                lr=req.lr,
            )
        else:
            raise ValueError(f"Unknown model_type: {req.model_type!r}")

        if job.status not in (JobStatus.CANCELLED,):
            job.status = JobStatus.COMPLETED
            job.progress = 100.0

    except Exception:
        tb = traceback.format_exc()
        log.error("[%s] Training failed:\n%s", job.job_id, tb)
        job.status = JobStatus.FAILED
        job.error = tb[-2000:]


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # Nothing to teardown at the server level; individual jobs manage resources


app = FastAPI(
    title="Viralix Fine-tuning Worker",
    version="1.0.0",
    lifespan=lifespan,
)


@app.post("/start-finetune", response_model=StartFinetuneResponse)
def start_finetune(req: StartFinetuneRequest) -> StartFinetuneResponse:
    if req.model_type not in ("llama", "sdxl"):
        raise HTTPException(
            status_code=400, detail="model_type must be 'llama' or 'sdxl'"
        )
    if not req.training_samples:
        raise HTTPException(status_code=400, detail="training_samples is empty")

    job_id = uuid.uuid4().hex
    job = _register_job(job_id)

    t = threading.Thread(
        target=_training_thread,
        args=(job, req),
        daemon=True,
        name=f"finetune-{job_id[:8]}",
    )
    t.start()
    log.info(
        "Job %s started: model_type=%s workspace=%s samples=%d",
        job_id,
        req.model_type,
        req.workspace_id,
        len(req.training_samples),
    )
    return StartFinetuneResponse(job_id=job_id)


@app.get("/status/{job_id}", response_model=JobStatusResponse)
def get_status(job_id: str) -> JobStatusResponse:
    try:
        job = _get_job(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found")
    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status.value,
        progress=round(job.progress, 1),
        metrics=job.metrics,
        output_path=job.output_path,
        error=job.error,
    )


@app.post("/cancel/{job_id}")
def cancel_job(job_id: str) -> dict:
    try:
        job = _get_job(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found")
    if job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED):
        return {"message": f"Job already in terminal state: {job.status.value}"}
    job._cancel_event.set()
    log.info("Cancel requested for job %s", job_id)
    return {"message": "Cancellation requested"}
