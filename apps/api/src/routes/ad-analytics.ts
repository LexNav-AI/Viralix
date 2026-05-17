import { Router } from 'express'
import { db } from '../db'
import { adAnalytics } from '../schema'
import { eq, sum, desc } from 'drizzle-orm'
import { z } from 'zod'

const router = Router()

// Aggregated overview by platform
router.get('/overview', async (_req, res) => {
  const rows = await db.select({
    platform: adAnalytics.platform,
    views: sum(adAnalytics.views),
    clicks: sum(adAnalytics.clicks),
    conversions: sum(adAnalytics.conversions),
  })
    .from(adAnalytics)
    .groupBy(adAnalytics.platform)

  res.json(rows)
})

// Analytics for a specific ad
router.get('/ad/:adId', async (req, res) => {
  const rows = await db.select().from(adAnalytics)
    .where(eq(adAnalytics.adId, req.params.adId))
    .orderBy(desc(adAnalytics.recordedAt))
  res.json(rows)
})

// Ingest analytics (platform webhook or manual)
router.post('/ingest', async (req, res) => {
  const body = z.object({
    adId: z.string().uuid(),
    platform: z.string(),
    views: z.number().int().min(0).default(0),
    clicks: z.number().int().min(0).default(0),
    conversions: z.number().int().min(0).default(0),
  }).parse(req.body)

  const [row] = await db.insert(adAnalytics).values(body as typeof adAnalytics.$inferInsert).returning()
  res.status(201).json(row)
})

export default router
