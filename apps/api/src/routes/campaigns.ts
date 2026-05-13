import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db, campaigns, campaignBriefs, ads, workspaceMembers, adPerformance } from '../db'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { AppError } from '../middleware/error-handler'
import { generateAdBatch } from '../services/campaign-generator'

const router = Router({ mergeParams: true })

async function assertMember(userId: string, workspaceId: string): Promise<void> {
  const [m] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1)
  if (!m) throw new AppError(403, 'Access denied', 'FORBIDDEN')
}

const createSchema = z.object({
  name: z.string().min(1).max(255),
  objective: z.string().max(100).optional(),
  platforms: z.array(z.string()).default([]),
  budget: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

const updateSchema = createSchema.partial()

const briefSchema = z.object({
  productName: z.string().min(1).max(255),
  productDescription: z.string().min(1),
  callToAction: z.string().min(1).max(255),
  targetAudience: z.string().min(1),
  additionalNotes: z.string().optional(),
})

// GET /api/workspaces/:workspaceId/campaigns
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20)
  const offset = (page - 1) * limit
  const statusFilter = req.query.status as string | undefined

  const conditions = [eq(campaigns.workspaceId, workspaceId), isNull(campaigns.archivedAt)]
  if (statusFilter) conditions.push(eq(campaigns.status, statusFilter))

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(campaigns)
    .where(and(...conditions))

  const rows = await db
    .select()
    .from(campaigns)
    .where(and(...conditions))
    .orderBy(campaigns.createdAt)
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

// POST /api/workspaces/:workspaceId/campaigns
router.post('/', requireAuth, validate(createSchema), async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const { name, objective, platforms, budget, startDate, endDate } = req.body as z.infer<typeof createSchema>

  const [campaign] = await db
    .insert(campaigns)
    .values({
      workspaceId,
      name,
      objective,
      platforms,
      budget,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status: 'draft',
    })
    .returning()

  res.status(201).json(campaign)
})

// GET /api/workspaces/:workspaceId/campaigns/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId, id } = req.params
  await assertMember(req.user!.id, workspaceId)

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, workspaceId), isNull(campaigns.archivedAt)))
    .limit(1)

  if (!campaign) throw new AppError(404, 'Campaign not found', 'NOT_FOUND')

  const [brief] = await db
    .select()
    .from(campaignBriefs)
    .where(eq(campaignBriefs.campaignId, id))
    .limit(1)

  const [{ adCount }] = await db
    .select({ adCount: sql<number>`COUNT(*)` })
    .from(ads)
    .where(and(eq(ads.campaignId, id), isNull(ads.archivedAt)))

  // Performance summary
  const perfRows = await db
    .select({
      impressions: sql<number>`SUM(${adPerformance.impressions})`,
      clicks: sql<number>`SUM(${adPerformance.clicks})`,
      conversions: sql<number>`SUM(${adPerformance.conversions})`,
      spend: sql<number>`SUM(CAST(${adPerformance.spend} AS DOUBLE PRECISION))`,
      revenue: sql<number>`SUM(CAST(${adPerformance.revenue} AS DOUBLE PRECISION))`,
    })
    .from(adPerformance)
    .innerJoin(ads, eq(adPerformance.adId, ads.id))
    .where(eq(ads.campaignId, id))

  const perf = perfRows[0]
  const impressions = Number(perf?.impressions ?? 0)
  const clicks = Number(perf?.clicks ?? 0)
  const spend = Number(perf?.spend ?? 0)
  const revenue = Number(perf?.revenue ?? 0)

  res.json({
    ...campaign,
    brief: brief ?? null,
    adCount: Number(adCount),
    performance: {
      impressions,
      clicks,
      ctr: impressions > 0 ? clicks / impressions : 0,
      conversions: Number(perf?.conversions ?? 0),
      spend,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
    },
  })
})

// PUT /api/workspaces/:workspaceId/campaigns/:id
router.put('/:id', requireAuth, validate(updateSchema), async (req: Request, res: Response) => {
  const { workspaceId, id } = req.params
  await assertMember(req.user!.id, workspaceId)

  const { name, objective, platforms, budget, startDate, endDate } = req.body as z.infer<typeof updateSchema>
  const updates: Partial<typeof campaigns.$inferInsert> = { updatedAt: new Date() }
  if (name !== undefined) updates.name = name
  if (objective !== undefined) updates.objective = objective
  if (platforms !== undefined) updates.platforms = platforms
  if (budget !== undefined) updates.budget = budget
  if (startDate !== undefined) updates.startDate = new Date(startDate)
  if (endDate !== undefined) updates.endDate = new Date(endDate)

  const [updated] = await db
    .update(campaigns)
    .set(updates)
    .where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, workspaceId)))
    .returning()

  if (!updated) throw new AppError(404, 'Campaign not found', 'NOT_FOUND')
  res.json(updated)
})

// DELETE /api/workspaces/:workspaceId/campaigns/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId, id } = req.params
  await assertMember(req.user!.id, workspaceId)

  const [updated] = await db
    .update(campaigns)
    .set({ archivedAt: new Date(), status: 'archived', updatedAt: new Date() })
    .where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, workspaceId)))
    .returning()

  if (!updated) throw new AppError(404, 'Campaign not found', 'NOT_FOUND')
  res.json({ success: true })
})

// POST /api/workspaces/:workspaceId/campaigns/:id/brief
router.post('/:id/brief', requireAuth, validate(briefSchema), async (req: Request, res: Response) => {
  const { workspaceId, id } = req.params
  await assertMember(req.user!.id, workspaceId)

  const body = req.body as z.infer<typeof briefSchema>

  const [existing] = await db
    .select()
    .from(campaignBriefs)
    .where(eq(campaignBriefs.campaignId, id))
    .limit(1)

  let brief
  if (existing) {
    ;[brief] = await db
      .update(campaignBriefs)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(campaignBriefs.id, existing.id))
      .returning()
  } else {
    ;[brief] = await db
      .insert(campaignBriefs)
      .values({ campaignId: id, ...body })
      .returning()
  }

  res.status(201).json(brief)
})

// POST /api/workspaces/:workspaceId/campaigns/:id/generate
router.post('/:id/generate', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId, id } = req.params
  await assertMember(req.user!.id, workspaceId)

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.workspaceId, workspaceId)))
    .limit(1)

  if (!campaign) throw new AppError(404, 'Campaign not found', 'NOT_FOUND')

  const jobIds = await generateAdBatch(workspaceId, id, 14)

  res.status(202).json({ jobIds, count: jobIds.length })
})

export default router
