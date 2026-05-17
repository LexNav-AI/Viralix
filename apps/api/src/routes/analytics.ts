import { Router } from 'express'
import { db } from '../db'
import { dailyAnalytics } from '../db'
import { eq, sum, desc } from 'drizzle-orm'
import { z } from 'zod'

const router = Router()

// Overview analytics
router.get('/overview', async (_req, res) => {
  const rows = await db.select({
    platform: dailyAnalytics.platform,
    views: sum(dailyAnalytics.totalImpressions),
    clicks: sum(dailyAnalytics.totalClicks),
    conversions: sum(dailyAnalytics.totalConversions),
  })
    .from(dailyAnalytics)
    .groupBy(dailyAnalytics.platform)

  res.json(rows)
})

// Analytics for a specific workspace by date
router.get('/workspace/:workspaceId', async (req, res) => {
  const workspaceId = req.params.workspaceId as string
  const rows = await db.select().from(dailyAnalytics)
    .where(eq(dailyAnalytics.workspaceId, workspaceId))
    .orderBy(desc(dailyAnalytics.recordedAt))
  res.json(rows)
})

// Ingest analytics (called by platform webhooks or manual tracking)
router.post('/ingest', async (req, res) => {
  const body = z.object({
    workspaceId: z.string().uuid(),
    platform: z.string(),
    date: z.string(),
    totalImpressions: z.number().int().min(0).default(0),
    totalClicks: z.number().int().min(0).default(0),
    totalConversions: z.number().int().min(0).default(0),
  }).parse(req.body)

  const [row] = await db.insert(dailyAnalytics).values(body as typeof dailyAnalytics.$inferInsert).returning()
  res.status(201).json(row)
})

export default router
