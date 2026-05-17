import { Worker, Queue } from 'bullmq'
import IORedis from 'ioredis'
import { db } from '../db'
import { urlCampaigns, generatedAds } from '../schema'
import { eq } from 'drizzle-orm'
import { scrapeUrl } from '../services/scraper'
import { generateAdCopy } from '../services/claude'
import { config } from '../config'

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null })

export const generationQueue = new Queue('ad-generation', { connection })

const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube', 'twitter', 'linkedin', 'pinterest', 'snapchat'] as const
const FORMATS = ['vertical_video', 'square', 'landscape', 'carousel'] as const

const PLATFORM_FORMATS: Record<string, (typeof FORMATS[number])[]> = {
  instagram: ['vertical_video', 'square', 'carousel'],
  facebook:  ['square', 'landscape', 'carousel'],
  tiktok:    ['vertical_video'],
  youtube:   ['vertical_video', 'landscape'],
  twitter:   ['landscape', 'square'],
  linkedin:  ['landscape', 'square'],
  pinterest: ['square', 'carousel'],
  snapchat:  ['vertical_video'],
}

export function startGenerationWorker() {
  const worker = new Worker('ad-generation', async (job) => {
    const { campaignId } = job.data as { campaignId: string }

    // 1. Load campaign
    const [campaign] = await db.select().from(urlCampaigns).where(eq(urlCampaigns.id, campaignId))
    if (!campaign) throw new Error('Campaign not found')

    // 2. Update status to scraping
    await db.update(urlCampaigns).set({ status: 'scraping' }).where(eq(urlCampaigns.id, campaignId))

    // 3. Scrape
    const scraped = await scrapeUrl(campaign.url)
    await db.update(urlCampaigns).set({
      scrapedData: scraped as unknown as Record<string, unknown>,
      brandName: scraped.title || campaign.brandName,
      status: 'ready',
    }).where(eq(urlCampaigns.id, campaignId))

    // 4. Generate 14 ads total across platforms
    let count = 0
    let variant = 0
    for (const platform of PLATFORMS) {
      if (count >= 14) break
      const formats = PLATFORM_FORMATS[platform] ?? ['square']
      const format = formats[variant % formats.length]

      const copy = await generateAdCopy(scraped, platform, campaign.url, variant)

      await db.insert(generatedAds).values({
        campaignId,
        platform,
        format,
        headline: copy.headline,
        body: copy.body,
        cta: copy.cta,
        hashtags: copy.hashtags,
        status: 'ready',
      })

      count++
      variant++
    }

  }, { connection })

  worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err.message))
  console.log('Generation worker started')
  return worker
}
