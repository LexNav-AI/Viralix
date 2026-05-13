"""
Data pipeline for Viralix fine-tuning.

Converts performance data (top-performing ads) into training datasets:
  - Llama: prompt/completion pairs in JSONL format consumable by SFTTrainer
  - SDXL DreamBooth: image/prompt pairs in the HuggingFace datasets format

Usage:
    from data_pipeline import build_llama_dataset, build_sdxl_dataset
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

log = logging.getLogger("finetuning.data_pipeline")


# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

LlamaTrainingSample = dict  # {"prompt": str, "completion": str}
SDXLTrainingSample = dict   # {"image_path": str, "prompt": str}


# ---------------------------------------------------------------------------
# Llama dataset builder
# ---------------------------------------------------------------------------

# Chat-template wrapper for instruction fine-tuning
_LLAMA_TEMPLATE = (
    "<|begin_of_text|>"
    "<|start_header_id|>system<|end_header_id|>\n\n"
    "You are an elite performance marketing copywriter. "
    "Write high-converting ad copy exactly as instructed."
    "<|eot_id|>"
    "<|start_header_id|>user<|end_header_id|>\n\n"
    "{prompt}"
    "<|eot_id|>"
    "<|start_header_id|>assistant<|end_header_id|>\n\n"
    "{completion}"
    "<|eot_id|>"
)


def _build_llama_instruction(sample: LlamaTrainingSample) -> str:
    """Wrap a prompt/completion pair into the Llama 3 chat template."""
    return _LLAMA_TEMPLATE.format(
        prompt=sample["prompt"].strip(),
        completion=sample["completion"].strip(),
    )


def build_llama_dataset(
    samples: list[LlamaTrainingSample],
    output_path: str | Path,
) -> Path:
    """
    Convert a list of {prompt, completion} dicts into a JSONL file
    ready for SFTTrainer with `dataset_text_field="text"`.

    Args:
        samples: Raw training samples from the performance database.
        output_path: Where to write the JSONL file.

    Returns:
        Path to the written JSONL file.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    records: list[dict] = []
    for s in samples:
        if not s.get("prompt") or not s.get("completion"):
            log.warning("Skipping malformed sample: %s", s)
            continue
        records.append({"text": _build_llama_instruction(s)})

    with open(output_path, "w", encoding="utf-8") as fh:
        for rec in records:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

    log.info("Llama dataset: %d samples → %s", len(records), output_path)
    return output_path


def performance_data_to_llama_samples(
    ads: list[dict[str, Any]],
    min_ctr: float = 0.02,
) -> list[LlamaTrainingSample]:
    """
    Convert top-performing ad records (from the Viralix DB) into
    prompt/completion pairs.

    Expected ad dict keys:
        platform, format, product_name, product_description,
        tone, keywords, cta, target_audience,
        headline, body_text, cta_text,
        ctr, conversions   (performance metrics for filtering)
    """
    samples: list[LlamaTrainingSample] = []
    for ad in ads:
        ctr = float(ad.get("ctr", 0))
        if ctr < min_ctr:
            continue

        prompt = (
            f"Platform: {ad.get('platform', 'instagram')}\n"
            f"Format: {ad.get('format', 'static_image')}\n"
            f"Product: {ad.get('product_name', '')}\n"
            f"Description: {ad.get('product_description', '')}\n"
            f"Tone: {ad.get('tone', 'professional')}\n"
            f"Target audience: {ad.get('target_audience', 'general consumers')}\n"
            f"Keywords: {', '.join(ad.get('keywords', []))}\n"
            f"CTA: {ad.get('cta', 'Shop Now')}\n\n"
            "Write high-converting ad copy as a JSON object with keys: "
            "headline, body_text, cta_text, alternative_headlines."
        )

        completion = json.dumps(
            {
                "headline": ad.get("headline", ""),
                "body_text": ad.get("body_text", ""),
                "cta_text": ad.get("cta_text", ad.get("cta", "")),
                "alternative_headlines": ad.get("alternative_headlines", []),
            },
            ensure_ascii=False,
        )

        samples.append({"prompt": prompt, "completion": completion})

    log.info(
        "Filtered %d / %d ads (min CTR %.1f%%)",
        len(samples),
        len(ads),
        min_ctr * 100,
    )
    return samples


# ---------------------------------------------------------------------------
# SDXL DreamBooth dataset builder
# ---------------------------------------------------------------------------


def build_sdxl_dataset(
    samples: list[SDXLTrainingSample],
    output_dir: str | Path,
) -> Path:
    """
    Prepare image/prompt pairs for SDXL DreamBooth fine-tuning.

    Each sample must have:
        image_path: absolute path to the source image
        prompt: detailed text description of the image

    Writes a metadata.jsonl file in output_dir pointing to copied images.
    Returns path to the dataset directory.
    """
    import shutil  # noqa: PLC0415

    output_dir = Path(output_dir)
    images_dir = output_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    metadata_path = output_dir / "metadata.jsonl"
    with open(metadata_path, "w", encoding="utf-8") as fh:
        for idx, s in enumerate(samples):
            src = Path(s["image_path"])
            if not src.exists():
                log.warning("Image not found, skipping: %s", src)
                continue
            dest = images_dir / f"{idx:05d}{src.suffix}"
            shutil.copy2(src, dest)
            fh.write(
                json.dumps(
                    {"file_name": f"images/{dest.name}", "text": s["prompt"]},
                    ensure_ascii=False,
                )
                + "\n"
            )

    log.info("SDXL dataset: %d images → %s", len(samples), output_dir)
    return output_dir


def performance_data_to_sdxl_samples(
    ad_creatives: list[dict[str, Any]],
    min_roas: float = 2.0,
) -> list[SDXLTrainingSample]:
    """
    Convert top-performing creative records into image/prompt pairs for SDXL.

    Expected keys:
        local_image_path, prompt_used, roas
    """
    samples: list[SDXLTrainingSample] = []
    for creative in ad_creatives:
        if float(creative.get("roas", 0)) < min_roas:
            continue
        if not creative.get("local_image_path"):
            continue
        samples.append(
            {
                "image_path": creative["local_image_path"],
                "prompt": creative.get("prompt_used", ""),
            }
        )
    log.info(
        "Filtered %d / %d creatives (min ROAS %.1f)",
        len(samples),
        len(ad_creatives),
        min_roas,
    )
    return samples
