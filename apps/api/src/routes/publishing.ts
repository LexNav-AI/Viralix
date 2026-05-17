import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { and, eq, desc, gte, lte } from 'drizzle-orm'
import { db, scheduledPosts, ads, workspaceMembers } from '../db'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { AppError } from '../middleware/error-handler'
import { publish } from '../services/publisher'

const router = Router({ mergeParams: true })

type ScheduledPostPlatform = 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'twitter'

async function assertMember(userId: string, workspaceId: string): Promise<void> {
  const [m] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1)
  if (!m) throw new AppError(403, 'Access denied', 'FORBIDDEN')
}

// POST /api/workspaces/:workspaceId/publishing/schedule
router.post(
  '/schedule',
  requireAuth,
  validate(
    z.object({
      adId: z.string().uuid(),
      platform: z.string(),
      scheduledAt: z.string().datetime(),
    }),
  ),
  async (req: Request, res: Response) => {
    const workspaceId = req.params.workspaceId as string
    await assertMember(req.user!.id, workspaceId)

    const { adId, platform, scheduledAt } = req.body as { adId: string; platform: string; scheduledAt: string }

    const [ad] = await db
      .select()
      .from(ads)
      .where(and(eq(ads.id, adId), eq(ads.workspaceId, workspaceId)))
      .limit(1)

    if (!ad) throw new AppError(404, 'Ad not found', 'NOT_FOUND')
    if (ad.status !== 'ready') throw new AppError(400, 'Ad must be in ready status to schedule', 'AD_NOT_READY')

    const [post] = await db
      .insert(scheduledPosts)
      .values({
        workspaceId,
        adId,
        platform: platform as ScheduledPostPlatform,
        scheduledAt: new Date(scheduledAt),
        status: 'scheduled',
      })
      .returning()

    res.status(201).json(post)
  },
)

// GET /api/workspaces/:workspaceId/publishing/scheduled
router.get('/scheduled', requireAuth, async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string
  await assertMember(req.user!.id, workspaceId)

  const now = new Date()
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const posts = await db
    .select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.workspaceId, workspaceId),
        gte(scheduledPosts.scheduledAt, windowStart),
        lte(scheduledPosts.scheduledAt, windowEnd),
      ),
    )
    .orderBy(scheduledPosts.scheduledAt)
    .limit(200)

  res.json(posts)
})

// DELETE /api/workspaces/:workspaceId/publishing/scheduled/:id
router.delete('/scheduled/:id', requireAuth, async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string
  const id = req.params.id as string
  await assertMember(req.user!.id, workspaceId)

  const [post] = await db
    .select()
    .from(scheduledPosts)
    .where(and(eq(scheduledPosts.id, id), eq(scheduledPosts.workspaceId, workspaceId)))
    .limit(1)

  if (!post) throw new AppError(404, 'Scheduled post not found', 'NOT_FOUND')
  if (post.status === 'published') throw new AppError(400, 'Cannot cancel a published post', 'ALREADY_PUBLISHED')

  await db
    .update(scheduledPosts)
    .set({ status: 'cancelled' })
    .where(eq(scheduledPosts.id, id))

  res.json({ success: true })
})

// POST /api/workspaces/:workspaceId/publishing/publish-now
router.post(
  '/publish-now',
  requireAuth,
  validate(z.object({ adId: z.string().uuid(), platform: z.string() })),
  async (req: Request, res: Response) => {
    const workspaceId = req.params.workspaceId as string
    await assertMember(req.user!.id, workspaceId)

    const { adId, platform } = req.body as { adId: string; platform: string }

    const [ad] = await db
      .select()
      .from(ads)
      .where(and(eq(ads.id, adId), eq(ads.workspaceId, workspaceId)))
      .limit(1)

    if (!ad) throw new AppError(404, 'Ad not found', 'NOT_FOUND')
    if (ad.status !== 'ready') throw new AppError(400, 'Ad must be in ready status to publish', 'AD_NOT_READY')

    // Create a scheduled post with immediate time
    const [post] = await db
      .insert(scheduledPosts)
      .values({
        workspaceId,
        adId,
        platform: platform as ScheduledPostPlatform,
        scheduledAt: new Date(),
        status: 'scheduled',
      })
      .returning()

    // Publish synchronously
    await publish(post.id)

    const [updated] = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, post.id)).limit(1)

    res.json(updated)
  },
)

// GET /api/workspaces/:workspaceId/publishing/history
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string
  await assertMember(req.user!.id, workspaceId)

  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50)
  const offset = (page - 1) * limit

  const posts = await db
    .select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.workspaceId, workspaceId),
        eq(scheduledPosts.status, 'published'),
      ),
    )
    .orderBy(desc(scheduledPosts.publishedAt))
    .limit(limit)
    .offset(offset)

  res.json(posts)
})

export default router
