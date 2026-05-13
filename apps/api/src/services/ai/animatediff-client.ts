import axios from 'axios'
import { config } from '../../config'

const TIMEOUT_MS = 180_000
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

export async function imageToVideo(
  imageUrl: string,
  motionStrength: number,
  duration: number,
): Promise<{ videoUrl: string }> {
  return withRetry(async () => {
    const response = await axios.post<{ videoUrl: string }>(
      `${config.animatediffWorkerUrl}/image-to-video`,
      {
        image_url: imageUrl,
        motion_strength: motionStrength,
        duration,
      },
      { timeout: TIMEOUT_MS },
    )
    return response.data
  })
}
