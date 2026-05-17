import { Router } from 'express'
import { db } from '../db'
import { postSchedule, generatedAds } from '../schema'
import { eq, gte, desc } from 'drizzle-orm'

const router = Router()

// Get upcoming schedule
router.get('/', async (_req, res) => {
  const upcoming = await db.select({
    id: postSchedule.id,
    adId: postSchedule.adId,
    platform: postSchedule.platform,
    scheduledTime: postSchedule.scheduledTime,
    status: postSchedule.status,
    postedAt: postSchedule.postedAt,
    headline: generatedAds.headline,
    cta: generatedAds.cta,
    format: generatedAds.format,
    mediaUrl: generatedAds.mediaUrl,
  })
    .from(postSchedule)
    .leftJoin(generatedAds, eq(postSchedule.adId, generatedAds.id))
    .where(gte(postSchedule.scheduledTime, new Date()))
    .orderBy(postSchedule.scheduledTime)
    .limit(100)

  res.json(upcoming)
})

// Cancel a scheduled post
router.patch('/:id/cancel', async (req, res) => {
  const [row] = await db.update(postSchedule)
    .set({ status: 'cancelled' })
    .where(eq(postSchedule.id, req.params.id))
    .returning()
  res.json(row)
})

export default router
