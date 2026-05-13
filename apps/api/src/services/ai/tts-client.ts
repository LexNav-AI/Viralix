import axios from 'axios'
import { config } from '../../config'

export interface TTSRequest {
  text: string
  voice: 'af_heart' | 'af_sky' | 'af_bella' | 'am_michael' | 'am_adam'
  speed: number
  format: 'mp3' | 'wav'
}

interface TTSResponse {
  audioUrl: string
  durationSeconds: number
}

const TIMEOUT_MS = 60_000
const MAX_RETRIES = 3

async function withRetry<T>(fn: () => Promise<T>, retries: number = MAX_RETRIES): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

export async function generateVoiceover(
  req: TTSRequest,
): Promise<{ audioUrl: string; durationSeconds: number }> {
  if (req.speed < 0.5 || req.speed > 2.0) {
    throw new Error('TTS speed must be between 0.5 and 2.0')
  }

  return withRetry(async () => {
    const response = await axios.post<TTSResponse>(
      `${config.ttsWorkerUrl}/synthesize`,
      {
        text: req.text,
        voice: req.voice,
        speed: req.speed,
        format: req.format,
      },
      { timeout: TIMEOUT_MS },
    )
    return response.data
  })
}
