import { Router } from 'express'
import { db } from '../db'
import { urlCampaigns, generatedAds } from '../schema'
import { eq, desc } from 'drizzle-orm'
import { generationQueue } from '../workers/generation'
import { z } from 'zod'

const router = Router()

// List all campaigns
router.get('/', async (_req, res) => {
  const rows = await db.select().from(urlCampaigns).orderBy(desc(urlCampaigns.createdAt))
  res.json(rows)
})

// Get single campaign with stats
router.get('/:id', async (req, res) => {
  const id = req.params.id as string
  const [campaign] = await db.select().from(urlCampaigns).where(eq(urlCampaigns.id, id))
  if (!campaign) return res.status(404).json({ error: 'Not found' })

  const adRows = await db.select().from(generatedAds).where(eq(generatedAds.campaignId, id))

  res.json({ ...campaign, ads: adRows })
})

// Create campaign and kick off generation
router.post('/', async (req, res) => {
  const body = z.object({ url: z.string().url() }).parse(req.body)

  const [campaign] = await db.insert(urlCampaigns).values({
    url: body.url,
    brandName: new URL(body.url).hostname.replace('www.', ''),
    status: 'pending',
  }).returning()

  // Enqueue generation job
  await generationQueue.add('generate', { campaignId: campaign.id }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })

  res.status(201).json(campaign)
})

// Delete campaign
router.delete('/:id', async (req, res) => {
  const id = req.params.id as string
  await db.delete(urlCampaigns).where(eq(urlCampaigns.id, id))
  res.json({ ok: true })
})

export default router
