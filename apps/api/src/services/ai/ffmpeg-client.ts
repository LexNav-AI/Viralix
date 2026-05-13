import axios from 'axios'
import { config } from '../../config'

export interface VideoAssemblyRequest {
  videoUrl?: string
  imageUrls?: string[]
  audioUrl?: string
  subtitleText?: string
  outputFormat: 'mp4' | 'webm'
  watermarkText?: string
  transitionType?: 'fade' | 'slide' | 'zoom'
  durationPerSlide?: number
}

interface AssemblyResponse {
  videoUrl: string
  thumbnailUrl: string
}

interface VoiceoverResponse {
  videoUrl: string
}

const TIMEOUT_MS = 300_000
const MAX_RETRIES = 3

async function withRetry<T>(fn: () => Promise<T>, retries: number = MAX_RETRIES): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 3000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

export async function assembleVideo(
  req: VideoAssemblyRequest,
): Promise<{ videoUrl: string; thumbnailUrl: string }> {
  return withRetry(async () => {
    const response = await axios.post<AssemblyResponse>(
      `${config.ffmpegWorkerUrl}/assemble`,
      {
        video_url: req.videoUrl ?? null,
        image_urls: req.imageUrls ?? [],
        audio_url: req.audioUrl ?? null,
        subtitle_text: req.subtitleText ?? null,
        output_format: req.outputFormat,
        watermark_text: req.watermarkText ?? null,
        transition_type: req.transitionType ?? 'fade',
        duration_per_slide: req.durationPerSlide ?? 3,
      },
      { timeout: TIMEOUT_MS },
    )
    return response.data
  })
}

export async function addVoiceover(
  videoUrl: string,
  audioUrl: string,
): Promise<{ videoUrl: string }> {
  return withRetry(async () => {
    const response = await axios.post<VoiceoverResponse>(
      `${config.ffmpegWorkerUrl}/add-voiceover`,
      { video_url: videoUrl, audio_url: audioUrl },
      { timeout: TIMEOUT_MS },
    )
    return response.data
  })
}
