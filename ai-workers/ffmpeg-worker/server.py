"""
FFmpeg assembly worker.

Wraps the system ffmpeg binary via subprocess to assemble slide shows,
mix voiceovers, burn subtitles, and transcode/resize video for social-media
ad formats. Remote URLs (http/https) are downloaded to a temporary directory
before processing and cleaned up afterwards.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("ffmpeg-worker")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
OUTPUTS_DIR = Path(os.getenv("OUTPUTS_DIR", "/outputs"))
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
FFMPEG_BIN = os.getenv("FFMPEG_BIN", "ffmpeg")
FFPROBE_BIN = os.getenv("FFPROBE_BIN", "ffprobe")
DOWNLOAD_TIMEOUT = float(os.getenv("DOWNLOAD_TIMEOUT", "60"))

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class AssembleRequest(BaseModel):
    image_urls: list[str] | None = None
    video_url: str | None = None
    audio_url: str | None = None
    subtitle_text: str | None = None
    output_format: str = Field(default="mp4", description="mp4 or webm")
    watermark_text: str | None = None
    transition_type: str = Field(
        default="fade", description="fade, slide, none"
    )
    duration_per_slide: float = Field(default=3.0, ge=0.5, le=30.0)


class AssembleResponse(BaseModel):
    video_path: str
    thumbnail_path: str


class AddVoiceoverRequest(BaseModel):
    video_url: str
    audio_url: str


class AddVoiceoverResponse(BaseModel):
    video_path: str


class AddSubtitlesRequest(BaseModel):
    video_url: str
    subtitle_text: str
    font_size: int = Field(default=24, ge=8, le=72)
    color: str = Field(default="white", description="Color name or hex #RRGGBB")


class AddSubtitlesResponse(BaseModel):
    video_path: str


class ResizeRequest(BaseModel):
    input_url: str
    width: int = Field(ge=16, le=7680)
    height: int = Field(ge=16, le=4320)


class ResizeResponse(BaseModel):
    video_path: str


class HealthResponse(BaseModel):
    status: str
    ffmpeg_version: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@contextmanager
def _tmpdir() -> Generator[Path, None, None]:
    d = Path(tempfile.mkdtemp(prefix="ffmpeg_work_"))
    try:
        yield d
    finally:
        shutil.rmtree(d, ignore_errors=True)


def _download(url: str, dest: Path) -> Path:
    """Download a remote URL to dest directory and return the local path."""
    if url.startswith(("http://", "https://")):
        fname = dest / (uuid.uuid4().hex + "_" + Path(url.split("?")[0]).name[-64:])
        with httpx.Client(timeout=DOWNLOAD_TIMEOUT, follow_redirects=True) as client:
            with client.stream("GET", url) as resp:
                resp.raise_for_status()
                with open(fname, "wb") as fh:
                    for chunk in resp.iter_bytes(chunk_size=65536):
                        fh.write(chunk)
        return fname
    # Local path passed directly
    return Path(url)


def _output_path(ext: str = "mp4") -> str:
    return str(OUTPUTS_DIR / f"{uuid.uuid4().hex}.{ext}")


def _run_ffmpeg(args: list[str], timeout: int = 300) -> None:
    """Run ffmpeg with the given argument list. Raises RuntimeError on failure."""
    cmd = [FFMPEG_BIN, "-hide_banner", "-loglevel", "warning", "-y"] + args
    log.info("FFmpeg: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        log.error("FFmpeg stderr: %s", result.stderr)
        raise RuntimeError(f"ffmpeg exited {result.returncode}: {result.stderr[-800:]}")


def _extract_thumbnail(video_path: str) -> str:
    """Extract the first frame of video_path as a PNG thumbnail."""
    thumb = video_path.rsplit(".", 1)[0] + "_thumb.png"
    _run_ffmpeg(["-i", video_path, "-frames:v", "1", "-q:v", "2", thumb])
    return thumb


def _ffmpeg_version() -> str:
    try:
        r = subprocess.run(
            [FFMPEG_BIN, "-version"],
            capture_output=True, text=True, timeout=5,
        )
        return r.stdout.splitlines()[0] if r.stdout else "unknown"
    except Exception:
        return "unavailable"


# ---------------------------------------------------------------------------
# Slideshow assembly from images
# ---------------------------------------------------------------------------


def _assemble_from_images(
    image_paths: list[Path],
    audio_path: Path | None,
    subtitle_text: str | None,
    watermark_text: str | None,
    transition_type: str,
    duration_per_slide: float,
    output_format: str,
    work_dir: Path,
) -> str:
    output = _output_path(output_format)
    n = len(image_paths)

    # --- Build concat input list with durations ---
    concat_file = work_dir / "concat.txt"
    with open(concat_file, "w") as fh:
        for img in image_paths:
            fh.write(f"file '{img}'\n")
            fh.write(f"duration {duration_per_slide}\n")
        # ffmpeg concat demuxer needs last entry repeated
        fh.write(f"file '{image_paths[-1]}'\n")

    # Base video from images
    raw_video = str(work_dir / "raw.mp4")
    vf_filters: list[str] = [
        "scale=1920:1080:force_original_aspect_ratio=decrease",
        "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black",
        "format=yuv420p",
    ]

    if transition_type == "fade":
        # Apply fade-in/out per slide
        total_duration = n * duration_per_slide
        fade_dur = min(0.5, duration_per_slide / 4)
        fade_filters = []
        for i in range(n):
            start = i * duration_per_slide
            fade_filters.append(f"fade=t=in:st={start}:d={fade_dur}")
            fade_filters.append(f"fade=t=out:st={start + duration_per_slide - fade_dur}:d={fade_dur}")
        vf_filters.extend(fade_filters)

    if watermark_text:
        safe_text = watermark_text.replace("'", "\\'").replace(":", "\\:")
        vf_filters.append(
            f"drawtext=text='{safe_text}':fontcolor=white@0.5:fontsize=28"
            f":x=w-tw-10:y=h-th-10:shadowcolor=black@0.5:shadowx=1:shadowy=1"
        )

    if subtitle_text:
        # Burn subtitles as centred drawtext (simple single-block text)
        safe_sub = subtitle_text.replace("'", "\\'").replace(":", "\\:")
        vf_filters.append(
            f"drawtext=text='{safe_sub}':fontcolor=white:fontsize=32"
            f":x=(w-tw)/2:y=h-th-40:box=1:boxcolor=black@0.6:boxborderw=6"
        )

    _run_ffmpeg([
        "-f", "concat", "-safe", "0", "-i", str(concat_file),
        "-vf", ",".join(vf_filters),
        "-c:v", "libx264", "-preset", "fast", "-crf", "22",
        raw_video,
    ])

    if audio_path:
        # Mix in audio, trimming/padding to match video length
        _run_ffmpeg([
            "-i", raw_video,
            "-i", str(audio_path),
            "-map", "0:v", "-map", "1:a",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            output,
        ])
    else:
        shutil.copy2(raw_video, output)

    return output


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Viralix FFmpeg Worker", version="1.0.0")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", ffmpeg_version=_ffmpeg_version())


@app.post("/assemble", response_model=AssembleResponse)
def assemble(req: AssembleRequest) -> AssembleResponse:
    if not req.image_urls and not req.video_url:
        raise HTTPException(
            status_code=400, detail="Provide at least image_urls or video_url"
        )

    with _tmpdir() as work_dir:
        t0 = time.perf_counter()

        audio_path: Path | None = None
        if req.audio_url:
            try:
                audio_path = _download(req.audio_url, work_dir)
            except Exception as exc:
                raise HTTPException(status_code=400, detail=f"Audio download failed: {exc}") from exc

        if req.image_urls:
            image_paths: list[Path] = []
            for idx, url in enumerate(req.image_urls):
                try:
                    p = _download(url, work_dir)
                    # Normalise extension so ffmpeg recognises the image
                    normalised = work_dir / f"slide_{idx:04d}.jpg"
                    _run_ffmpeg(["-i", str(p), "-frames:v", "1", str(normalised)])
                    image_paths.append(normalised)
                except Exception as exc:
                    raise HTTPException(
                        status_code=400, detail=f"Image download/normalise failed ({url}): {exc}"
                    ) from exc

            video_path = _assemble_from_images(
                image_paths=image_paths,
                audio_path=audio_path,
                subtitle_text=req.subtitle_text,
                watermark_text=req.watermark_text,
                transition_type=req.transition_type,
                duration_per_slide=req.duration_per_slide,
                output_format=req.output_format,
                work_dir=work_dir,
            )
        else:
            # video_url provided — just add audio / subtitles / watermark
            try:
                src_video = _download(req.video_url, work_dir)  # type: ignore[arg-type]
            except Exception as exc:
                raise HTTPException(status_code=400, detail=f"Video download failed: {exc}") from exc

            vf_parts: list[str] = []
            if req.watermark_text:
                safe = req.watermark_text.replace("'", "\\'").replace(":", "\\:")
                vf_parts.append(
                    f"drawtext=text='{safe}':fontcolor=white@0.5:fontsize=28"
                    f":x=w-tw-10:y=h-th-10:shadowcolor=black@0.5:shadowx=1:shadowy=1"
                )
            if req.subtitle_text:
                safe = req.subtitle_text.replace("'", "\\'").replace(":", "\\:")
                vf_parts.append(
                    f"drawtext=text='{safe}':fontcolor=white:fontsize=32"
                    f":x=(w-tw)/2:y=h-th-40:box=1:boxcolor=black@0.6:boxborderw=6"
                )

            output = _output_path(req.output_format)
            ffargs: list[str] = ["-i", str(src_video)]
            if audio_path:
                ffargs += ["-i", str(audio_path), "-map", "0:v", "-map", "1:a",
                           "-c:a", "aac", "-b:a", "192k", "-shortest"]
            if vf_parts:
                ffargs += ["-vf", ",".join(vf_parts)]
            ffargs += ["-c:v", "libx264", "-preset", "fast", "-crf", "22", output]
            _run_ffmpeg(ffargs)
            video_path = output

        thumbnail_path = _extract_thumbnail(video_path)
        elapsed = (time.perf_counter() - t0) * 1000
        log.info("Assemble complete: %s in %.0f ms", video_path, elapsed)

    return AssembleResponse(video_path=video_path, thumbnail_path=thumbnail_path)


@app.post("/add-voiceover", response_model=AddVoiceoverResponse)
def add_voiceover(req: AddVoiceoverRequest) -> AddVoiceoverResponse:
    with _tmpdir() as work_dir:
        try:
            video = _download(req.video_url, work_dir)
            audio = _download(req.audio_url, work_dir)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        output = _output_path("mp4")
        try:
            _run_ffmpeg([
                "-i", str(video),
                "-i", str(audio),
                "-map", "0:v",
                "-map", "1:a",
                "-c:v", "copy",
                "-c:a", "aac", "-b:a", "192k",
                "-shortest",
                output,
            ])
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    return AddVoiceoverResponse(video_path=output)


@app.post("/add-subtitles", response_model=AddSubtitlesResponse)
def add_subtitles(req: AddSubtitlesRequest) -> AddSubtitlesResponse:
    # Validate color: allow named colors and #RRGGBB
    import re  # noqa: PLC0415
    color = req.color
    if re.match(r'^#[0-9a-fA-F]{6}$', color):
        color = color[1:]  # ffmpeg drawtext uses RRGGBB without #

    with _tmpdir() as work_dir:
        try:
            video = _download(req.video_url, work_dir)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        safe_text = req.subtitle_text.replace("'", "\\'").replace(":", "\\:")
        vf = (
            f"drawtext=text='{safe_text}'"
            f":fontcolor={color}:fontsize={req.font_size}"
            f":x=(w-tw)/2:y=h-th-40"
            f":box=1:boxcolor=black@0.6:boxborderw=6"
        )
        output = _output_path("mp4")
        try:
            _run_ffmpeg([
                "-i", str(video),
                "-vf", vf,
                "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                "-c:a", "copy",
                output,
            ])
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    return AddSubtitlesResponse(video_path=output)


@app.post("/resize", response_model=ResizeResponse)
def resize(req: ResizeRequest) -> ResizeResponse:
    with _tmpdir() as work_dir:
        try:
            src = _download(req.input_url, work_dir)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        output = _output_path("mp4")
        vf = (
            f"scale={req.width}:{req.height}:force_original_aspect_ratio=decrease,"
            f"pad={req.width}:{req.height}:(ow-iw)/2:(oh-ih)/2:black,"
            f"format=yuv420p"
        )
        try:
            _run_ffmpeg([
                "-i", str(src),
                "-vf", vf,
                "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                "-c:a", "copy",
                output,
            ])
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    return ResizeResponse(video_path=output)
