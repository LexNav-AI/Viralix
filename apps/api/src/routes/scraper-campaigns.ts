import { Router } from 'express'
import { db } from '../db'
import { urlCampaigns, generatedAds } from '../schema'
import { eq, desc } from 'drizzle-orm'
import { generationQueue } from '../workers/generation'
import { z } from 'zod'

const router = Router()

// List all scraper campaigns
router.get('/', async (_req, res) => {
  const rows = await db.select().from(urlCampaigns).orderBy(desc(urlCampaigns.createdAt))
  res.json(rows)
})

// Get single campaign with its generated ads
router.get('/:id', async (req, res) => {
  const [campaign] = await db.select().from(urlCampaigns).where(eq(urlCampaigns.id, req.params.id))
  if (!campaign) return res.status(404).json({ error: 'Not found' })

  const ads = await db.select().from(generatedAds).where(eq(generatedAds.campaignId, req.params.id))

  res.json({ ...campaign, ads })
})

// Create campaign and kick off scrape + generation
router.post('/', async (req, res) => {
  const body = z.object({ url: z.string().url() }).parse(req.body)

  const [campaign] = await db.insert(urlCampaigns).values({
    url: body.url,
    brandName: new URL(body.url).hostname.replace('www.', ''),
    status: 'pending',
  }).returning()

  await generationQueue.add('generate', { campaignId: campaign.id }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })

  res.status(201).json(campaign)
})

// Delete campaign
router.delete('/:id', async (req, res) => {
  await db.delete(urlCampaigns).where(eq(urlCampaigns.id, req.params.id))
  res.json({ ok: true })
})

export default router
