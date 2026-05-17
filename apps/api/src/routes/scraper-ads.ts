import { Router } from 'express'
import { db } from '../db'
import { generatedAds } from '../schema'
import { eq } from 'drizzle-orm'

const router = Router()

// List ads for a campaign
router.get('/campaign/:campaignId', async (req, res) => {
  const rows = await db.select().from(generatedAds)
    .where(eq(generatedAds.campaignId, req.params.campaignId))
  res.json(rows)
})

// Approve ad
router.patch('/:id/approve', async (req, res) => {
  const [ad] = await db.update(generatedAds)
    .set({ status: 'approved' })
    .where(eq(generatedAds.id, req.params.id))
    .returning()
  res.json(ad)
})

// Reject ad
router.patch('/:id/reject', async (req, res) => {
  const [ad] = await db.update(generatedAds)
    .set({ status: 'rejected' })
    .where(eq(generatedAds.id, req.params.id))
    .returning()
  res.json(ad)
})

export default router
