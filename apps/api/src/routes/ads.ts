import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm'
import { db, ads, adPerformance, generationJobs, workspaceMembers } from '../db'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { AppError } from '../middleware/error-handler'
import { generateSingleAd } from '../services/campaign-generator'

type AdFormat =
  | 'instagram_post' | 'instagram_story' | 'instagram_reel'
  | 'facebook_feed' | 'facebook_story' | 'tiktok_video'
  | 'linkedin_post' | 'twitter_post' | 'youtube_pre_roll'
  | 'display_banner_728x90' | 'display_banner_300x250'
  | 'display_banner_160x600' | 'display_banner_320x50' | 'pinterest_pin'

type Platform = 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'twitter' | 'youtube' | 'pinterest'

const AD_FORMATS: Array<{ format: AdFormat; width: number; height: number; platform: Platform; isVideo: boolean }> = [
  { format: 'instagram_post', width: 1080, height: 1080, platform: 'instagram', isVideo: false },
  { format: 'instagram_story', width: 1080, height: 1920, platform: 'instagram', isVideo: false },
  { format: 'instagram_reel', width: 1080, height: 1920, platform: 'instagram', isVideo: true },
  { format: 'facebook_feed', width: 1200, height: 628, platform: 'facebook', isVideo: false },
  { format: 'facebook_story', width: 1080, height: 1920, platform: 'facebook', isVideo: false },
  { format: 'tiktok_video', width: 1080, height: 1920, platform: 'tiktok', isVideo: true },
  { format: 'linkedin_post', width: 1200, height: 627, platform: 'linkedin', isVideo: false },
  { format: 'twitter_post', width: 1200, height: 675, platform: 'twitter', isVideo: false },
  { format: 'youtube_pre_roll', width: 1920, height: 1080, platform: 'youtube', isVideo: true },
  { format: 'display_banner_728x90', width: 728, height: 90, platform: 'facebook', isVideo: false },
  { format: 'display_banner_300x250', width: 300, height: 250, platform: 'facebook', isVideo: false },
  { format: 'display_banner_160x600', width: 160, height: 600, platform: 'facebook', isVideo: false },
  { format: 'display_banner_320x50', width: 320, height: 50, platform: 'facebook', isVideo: false },
  { format: 'pinterest_pin', width: 1000, height: 1500, platform: 'pinterest', isVideo: false },
]

const router = Router({ mergeParams: true })

async function assertMember(userId: string, workspaceId: string): Promise<void> {
  const [m] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1)
  if (!m) throw new AppError(403, 'Access denied', 'FORBIDDEN')
}

// GET /api/workspaces/:workspaceId/ads
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20)
  const offset = (page - 1) * limit

  const conditions = [eq(ads.workspaceId, workspaceId), isNull(ads.archivedAt)]
  if (req.query.campaignId) conditions.push(eq(ads.campaignId, req.query.campaignId as string))
  if (req.query.format) conditions.push(eq(ads.format, req.query.format as string))
  if (req.query.platform) conditions.push(eq(ads.platform, req.query.platform as string))
  if (req.query.status) conditions.push(eq(ads.status, req.query.status as string))
  if (req.query.dateFrom) conditions.push(gte(ads.createdAt, new Date(req.query.dateFrom as string)))
  if (req.query.dateTo) conditions.push(lte(ads.createdAt, new Date(req.query.dateTo as string)))

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(ads)
    .where(and(...conditions))

  const rows = await db
    .select()
    .from(ads)
    .where(and(...conditions))
    .orderBy(ads.createdAt)
    .limit(limit)
    .offset(offset)

  res.json({
    data: rows,
    total: Number(count),
    page,
    perPage: limit,
    totalPages: Math.ceil(Number(count) / limit),
  })
})

// GET /api/workspaces/:workspaceId/ads/formats
router.get('/formats', requireAuth, async (_req: Request, res: Response) => {
  res.json(AD_FORMATS)
})

// GET /api/workspaces/:workspaceId/ads/job/:jobId
router.get('/job/:jobId', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId, jobId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const [job] = await db
    .select()
    .from(generationJobs)
    .where(and(eq(generationJobs.id, jobId), eq(generationJobs.workspaceId, workspaceId)))
    .limit(1)

  if (!job) throw new AppError(404, 'Job not found', 'NOT_FOUND')

  let ad = null
  if (job.adId) {
    const [adRow] = await db.select().from(ads).where(eq(ads.id, job.adId)).limit(1)
    ad = adRow ?? null
  }

  res.json({ ...job, ad })
})

// GET /api/workspaces/:workspaceId/ads/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId, id } = req.params
  await assertMember(req.user!.id, workspaceId)

  const [ad] = await db
    .select()
    .from(ads)
    .where(and(eq(ads.id, id), eq(ads.workspaceId, workspaceId)))
    .limit(1)

  if (!ad) throw new AppError(404, 'Ad not found', 'NOT_FOUND')

  // Variants
  const variants = await db
    .select()
    .from(ads)
    .where(and(eq(ads.parentAdId, id), isNull(ads.archivedAt)))

  // Performance
  const [perf] = await db
    .select({
      impressions: sql<number>`SUM(${adPerformance.impressions})`,
      clicks: sql<number>`SUM(${adPerformance.clicks})`,
      conversions: sql<number>`SUM(${adPerformance.conversions})`,
      spend: sql<number>`SUM(CAST(${adPerformance.spend} AS DOUBLE PRECISION))`,
      revenue: sql<number>`SUM(CAST(${adPerformance.revenue} AS DOUBLE PRECISION))`,
    })
    .from(adPerformance)
    .where(eq(adPerformance.adId, id))

  const imp = Number(perf?.impressions ?? 0)
  const clk = Number(perf?.clicks ?? 0)
  const spd = Number(perf?.spend ?? 0)
  const rev = Number(perf?.revenue ?? 0)

  res.json({
    ...ad,
    variants,
    performance: {
      impressions: imp,
      clicks: clk,
      ctr: imp > 0 ? clk / imp : 0,
      conversions: Number(perf?.conversions ?? 0),
      spend: spd,
      revenue: rev,
      roas: spd > 0 ? rev / spd : 0,
    },
  })
})

// POST /api/workspaces/:workspaceId/ads/generate
router.post(
  '/generate',
  requireAuth,
  validate(
    z.object({
      format: z.string(),
      platform: z.string(),
      campaignId: z.string().uuid().optional(),
      brief: z.object({
        productName: z.string(),
        productDescription: z.string(),
        callToAction: z.string(),
        targetAudience: z.string(),
      }),
    }),
  ),
  async (req: Request, res: Response) => {
    const { workspaceId } = req.params
    await assertMember(req.user!.id, workspaceId)

    const { format, platform, campaignId, brief } = req.body as {
      format: AdFormat
      platform: Platform
      campaignId?: string
      brief: { productName: string; productDescription: string; callToAction: string; targetAudience: string }
    }

    const jobId = await generateSingleAd(workspaceId, { format, platform, campaignId, brief })

    res.status(202).json({ jobId })
  },
)

// PUT /api/workspaces/:workspaceId/ads/:id
router.put(
  '/:id',
  requireAuth,
  validate(
    z.object({
      headline: z.string().optional(),
      bodyText: z.string().optional(),
      ctaText: z.string().max(100).optional(),
    }),
  ),
  async (req: Request, res: Response) => {
    const { workspaceId, id } = req.params
    await assertMember(req.user!.id, workspaceId)

    const { headline, bodyText, ctaText } = req.body as { headline?: string; bodyText?: string; ctaText?: string }
    const updates: Partial<typeof ads.$inferInsert> = { updatedAt: new Date() }
    if (headline !== undefined) updates.headline = headline
    if (bodyText !== undefined) updates.bodyText = bodyText
    if (ctaText !== undefined) updates.ctaText = ctaText

    const [updated] = await db
      .update(ads)
      .set(updates)
      .where(and(eq(ads.id, id), eq(ads.workspaceId, workspaceId)))
      .returning()

    if (!updated) throw new AppError(404, 'Ad not found', 'NOT_FOUND')
    res.json(updated)
  },
)

// DELETE /api/workspaces/:workspaceId/ads/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId, id } = req.params
  await assertMember(req.user!.id, workspaceId)

  const [updated] = await db
    .update(ads)
    .set({ archivedAt: new Date(), status: 'archived', updatedAt: new Date() })
    .where(and(eq(ads.id, id), eq(ads.workspaceId, workspaceId)))
    .returning()

  if (!updated) throw new AppError(404, 'Ad not found', 'NOT_FOUND')
  res.json({ success: true })
})

// POST /api/workspaces/:workspaceId/ads/:id/variants
router.post('/:id/variants', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId, id } = req.params
  await assertMember(req.user!.id, workspaceId)

  const [original] = await db
    .select()
    .from(ads)
    .where(and(eq(ads.id, id), eq(ads.workspaceId, workspaceId)))
    .limit(1)

  if (!original) throw new AppError(404, 'Ad not found', 'NOT_FOUND')

  // Enqueue a new generation job for a variant of this ad
  const { generateSingleAd: gen } = await import('../services/campaign-generator')
  const jobId = await gen(workspaceId, {
    format: original.format as AdFormat,
    platform: original.platform as Platform,
    campaignId: original.campaignId ?? undefined,
    brief: {
      productName: req.body?.productName ?? 'Product',
      productDescription: req.body?.productDescription ?? '',
      callToAction: original.ctaText ?? 'Learn More',
      targetAudience: req.body?.targetAudience ?? 'General audience',
    },
  })

  // Set parentAdId on the newly created ad (the job creation inserts the ad)
  const [newJob] = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1)

  if (newJob?.adId) {
    await db.update(ads).set({ parentAdId: id }).where(eq(ads.id, newJob.adId))
  }

  res.status(202).json({ jobId })
})

export default router
