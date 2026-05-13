import axios from 'axios'
import { config } from '../../config'

export interface AdCopyRequest {
  format: string
  platform: string
  productName: string
  productDescription: string
  tone: string
  keywords: string[]
  forbiddenWords: string[]
  callToAction: string
  targetAudience: string
  examples?: string[]
}

export interface AdCopyResponse {
  headline: string
  bodyText: string
  ctaText: string
  alternativeHeadlines: string[]
}

interface CampaignStrategyResponse {
  strategy: string
  recommendedFormats: string[]
  postingTimes: object
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

export async function generateAdCopy(req: AdCopyRequest): Promise<AdCopyResponse> {
  return withRetry(async () => {
    const response = await axios.post<AdCopyResponse>(
      `${config.llamaWorkerUrl}/generate`,
      { task: 'ad_copy', ...req },
      { timeout: TIMEOUT_MS },
    )
    return response.data
  })
}

export async function generateCampaignStrategy(
  brief: object,
): Promise<CampaignStrategyResponse> {
  return withRetry(async () => {
    const response = await axios.post<CampaignStrategyResponse>(
      `${config.llamaWorkerUrl}/generate`,
      { task: 'campaign_strategy', brief },
      { timeout: TIMEOUT_MS },
    )
    return response.data
  })
}

export async function generateBatchCopy(requests: AdCopyRequest[]): Promise<AdCopyResponse[]> {
  return withRetry(async () => {
    const response = await axios.post<AdCopyResponse[]>(
      `${config.llamaWorkerUrl}/generate`,
      { task: 'ad_copy_batch', requests },
      { timeout: TIMEOUT_MS * 2 },
    )
    return response.data
  })
}
