import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { and, eq, sql, inArray } from 'drizzle-orm'
import { db, abTests, ads, adPerformance, workspaceMembers } from '../db'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { AppError } from '../middleware/error-handler'

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
  hypothesis: z.string().optional(),
  metric: z.enum(['ctr', 'roas', 'conversions']).default('ctr'),
  adIds: z.array(z.string().uuid()).min(2),
  trafficAllocations: z.array(z.number().min(0).max(100)),
})

// GET /api/workspaces/:workspaceId/ab-tests
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const tests = await db
    .select()
    .from(abTests)
    .where(eq(abTests.workspaceId, workspaceId))
    .orderBy(abTests.createdAt)

  res.json(tests)
})

// POST /api/workspaces/:workspaceId/ab-tests
router.post('/', requireAuth, validate(createSchema), async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const { name, hypothesis, metric, adIds, trafficAllocations } = req.body as z.infer<typeof createSchema>

  if (trafficAllocations.length !== adIds.length) {
    throw new AppError(400, 'trafficAllocations must have same length as adIds', 'VALIDATION_ERROR')
  }
  const totalAllocation = trafficAllocations.reduce((sum, a) => sum + a, 0)
  if (Math.abs(totalAllocation - 100) > 0.01) {
    throw new AppError(400, 'trafficAllocations must sum to 100', 'VALIDATION_ERROR')
  }

  // Verify all ads belong to this workspace
  const adRows = await db
    .select({ id: ads.id })
    .from(ads)
    .where(and(eq(ads.workspaceId, workspaceId), inArray(ads.id, adIds)))

  if (adRows.length !== adIds.length) {
    throw new AppError(400, 'One or more ads not found in this workspace', 'NOT_FOUND')
  }

  const [test] = await db
    .insert(abTests)
    .values({ workspaceId, name, hypothesis, metric, adIds, trafficAllocations, status: 'draft' })
    .returning()

  res.status(201).json(test)
})

// GET /api/workspaces/:workspaceId/ab-tests/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId, id } = req.params
  await assertMember(req.user!.id, workspaceId)

  const [test] = await db
    .select()
    .from(abTests)
    .where(and(eq(abTests.id, id), eq(abTests.workspaceId, workspaceId)))
    .limit(1)

  if (!test) throw new AppError(404, 'A/B test not found', 'NOT_FOUND')

  const adIds = test.adIds as string[]

  // Load ads with performance
  const variantAds = await db.select().from(ads).where(inArray(ads.id, adIds))

  const perfRows = await db
    .select({
      adId: adPerformance.adId,
      impressions: sql<number>`SUM(${adPerformance.impressions})`,
      clicks: sql<number>`SUM(${adPerformance.clicks})`,
      conversions: sql<number>`SUM(${adPerformance.conversions})`,
      spend: sql<number>`SUM(CAST(${adPerformance.spend} AS DOUBLE PRECISION))`,
      revenue: sql<number>`SUM(CAST(${adPerformance.revenue} AS DOUBLE PRECISION))`,
    })
    .from(adPerformance)
    .where(inArray(adPerformance.adId, adIds))
    .groupBy(adPerformance.adId)

  const perfMap: Record<string, { impressions: number; clicks: number; conversions: number; spend: number; revenue: number }> = {}
  for (const p of perfRows) {
    perfMap[p.adId] = {
      impressions: Number(p.impressions),
      clicks: Number(p.clicks),
      conversions: Number(p.conversions),
      spend: Number(p.spend),
      revenue: Number(p.revenue),
    }
  }

  const variants = variantAds.map((ad) => {
    const p = perfMap[ad.id] ?? { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 }
    return {
      ...ad,
      performance: {
        ...p,
        ctr: p.impressions > 0 ? p.clicks / p.impressions : 0,
        roas: p.spend > 0 ? p.revenue / p.spend : 0,
      },
    }
  })

  // Simple confidence calculation (chi-square approximation for CTR)
  let confidence = 0
  if (variants.length === 2) {
    const a = variants[0].performance
    const b = variants[1].performance
    const totalImp = a.impressions + b.impressions
    const totalClk = a.clicks + b.clicks
    if (totalImp > 0 && totalClk > 0) {
      const expectedA = (a.impressions / totalImp) * totalClk
      const expectedB = (b.impressions / totalImp) * totalClk
      const chiSq =
        Math.pow(a.clicks - expectedA, 2) / (expectedA || 1) +
        Math.pow(b.clicks - expectedB, 2) / (expectedB || 1)
      // Rough p-value to confidence mapping for 1 DOF
      confidence = chiSq > 10.83 ? 99.9 : chiSq > 6.63 ? 99 : chiSq > 3.84 ? 95 : chiSq > 2.71 ? 90 : 0
    }
  }

  res.json({ ...test, ads: variants, confidence })
})

// PUT /api/workspaces/:workspaceId/ab-tests/:id/status
router.put(
  '/:id/status',
  requireAuth,
  validate(z.object({ status: z.enum(['running', 'paused', 'completed']) })),
  async (req: Request, res: Response) => {
    const { workspaceId, id } = req.params
    await assertMember(req.user!.id, workspaceId)

    const { status } = req.body as { status: 'running' | 'paused' | 'completed' }

    const updates: Partial<typeof abTests.$inferInsert> = { status, updatedAt: new Date() }
    if (status === 'running') updates.startedAt = new Date()
    if (status === 'completed') updates.completedAt = new Date()

    const [updated] = await db
      .update(abTests)
      .set(updates)
      .where(and(eq(abTests.id, id), eq(abTests.workspaceId, workspaceId)))
      .returning()

    if (!updated) throw new AppError(404, 'A/B test not found', 'NOT_FOUND')
    res.json(updated)
  },
)

// POST /api/workspaces/:workspaceId/ab-tests/:id/pick-winner
router.post('/:id/pick-winner', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId, id } = req.params
  await assertMember(req.user!.id, workspaceId)

  const [test] = await db
    .select()
    .from(abTests)
    .where(and(eq(abTests.id, id), eq(abTests.workspaceId, workspaceId)))
    .limit(1)

  if (!test) throw new AppError(404, 'A/B test not found', 'NOT_FOUND')

  const adIds = test.adIds as string[]
  const metric = test.metric as string

  // Find the winner based on the metric
  const perfRows = await db
    .select({
      adId: adPerformance.adId,
      impressions: sql<number>`SUM(${adPerformance.impressions})`,
      clicks: sql<number>`SUM(${adPerformance.clicks})`,
      conversions: sql<number>`SUM(${adPerformance.conversions})`,
      spend: sql<number>`SUM(CAST(${adPerformance.spend} AS DOUBLE PRECISION))`,
      revenue: sql<number>`SUM(CAST(${adPerformance.revenue} AS DOUBLE PRECISION))`,
    })
    .from(adPerformance)
    .where(inArray(adPerformance.adId, adIds))
    .groupBy(adPerformance.adId)

  if (perfRows.length === 0) {
    throw new AppError(400, 'No performance data available to pick a winner', 'NO_DATA')
  }

  const scoredVariants = perfRows.map((p) => {
    const imp = Number(p.impressions)
    const clk = Number(p.clicks)
    const conv = Number(p.conversions)
    const spd = Number(p.spend)
    const rev = Number(p.revenue)
    let score = 0
    if (metric === 'ctr') score = imp > 0 ? clk / imp : 0
    else if (metric === 'roas') score = spd > 0 ? rev / spd : 0
    else if (metric === 'conversions') score = conv
    return { adId: p.adId, score }
  })

  scoredVariants.sort((a, b) => b.score - a.score)
  const winnerId = scoredVariants[0].adId

  const [updated] = await db
    .update(abTests)
    .set({ winnerId, status: 'completed', completedAt: new Date(), updatedAt: new Date() })
    .where(eq(abTests.id, id))
    .returning()

  res.json({ ...updated, winnerId, winnerScore: scoredVariants[0].score })
})

export default router
