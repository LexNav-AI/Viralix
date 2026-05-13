import axios from 'axios'
import { config } from '../../config'

export interface ImageGenRequest {
  prompt: string
  negativePrompt: string
  format: string
  width: number
  height: number
  style: 'photorealistic' | 'illustration' | 'minimal' | 'bold'
  brandColors?: string[]
  controlNetImage?: string
  steps?: number
  guidanceScale?: number
  seed?: number
}

export interface ImageGenResponse {
  imageUrl: string
  seed: number
  durationMs: number
}

const TIMEOUT_MS = 120_000
const MAX_RETRIES = 3

async function withRetry<T>(fn: () => Promise<T>, retries: number = MAX_RETRIES): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 2000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

export async function generateImage(req: ImageGenRequest): Promise<ImageGenResponse> {
  return withRetry(async () => {
    const payload = {
      prompt: req.prompt,
      negative_prompt: req.negativePrompt,
      format: req.format,
      width: req.width,
      height: req.height,
      style: req.style,
      brand_colors: req.brandColors ?? [],
      controlnet_image: req.controlNetImage ?? null,
      steps: req.steps ?? 30,
      guidance_scale: req.guidanceScale ?? 7.5,
      seed: req.seed ?? null,
    }
    const response = await axios.post<ImageGenResponse>(
      `${config.sdWorkerUrl}/generate`,
      payload,
      { timeout: TIMEOUT_MS },
    )
    return response.data
  })
}

export async function generateCarousel(prompts: ImageGenRequest[]): Promise<ImageGenResponse[]> {
  return withRetry(async () => {
    const response = await axios.post<ImageGenResponse[]>(
      `${config.sdWorkerUrl}/generate/batch`,
      { requests: prompts },
      { timeout: TIMEOUT_MS * prompts.length },
    )
    return response.data
  })
}
