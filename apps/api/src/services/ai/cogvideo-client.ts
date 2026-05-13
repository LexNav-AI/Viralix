import axios from 'axios'
import { config } from '../../config'

export interface VideoGenRequest {
  prompt: string
  duration: number
  width: number
  height: number
  fps: number
  seed?: number
}

export interface VideoGenResponse {
  videoUrl: string
  thumbnailUrl: string
  durationMs: number
}

const TIMEOUT_MS = 300_000 // 5 min — video gen is slow
const MAX_RETRIES = 3

async function withRetry<T>(fn: () => Promise<T>, retries: number = MAX_RETRIES): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 5000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

export async function generateVideo(req: VideoGenRequest): Promise<VideoGenResponse> {
  if (req.duration > 6) {
    throw new Error('CogVideoX maximum duration is 6 seconds')
  }

  return withRetry(async () => {
    const response = await axios.post<VideoGenResponse>(
      `${config.cogvideoWorkerUrl}/generate`,
      {
        prompt: req.prompt,
        duration: req.duration,
        width: req.width,
        height: req.height,
        fps: req.fps,
        seed: req.seed ?? null,
      },
      { timeout: TIMEOUT_MS },
    )
    return response.data
  })
}
