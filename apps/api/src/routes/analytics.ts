import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { and, eq, gte, lte, desc, sql } from 'drizzle-orm'
import { format, eachDayOfInterval } from 'date-fns'
import { db, ads, adPerformance, performanceInsights, workspaceMembers } from '../db'
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

function getDateRange(req: Request): { from: Date; to: Date } {
  const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const to = req.query.to ? new Date(req.query.to as string) : new Date()
  return { from, to }
}

// GET /api/workspaces/:workspaceId/analytics/overview
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const { from, to } = getDateRange(req)

  const [perf] = await db
    .select({
      impressions: sql<number>`SUM(${adPerformance.impressions})`,
      clicks: sql<number>`SUM(${adPerformance.clicks})`,
      conversions: sql<number>`SUM(${adPerformance.conversions})`,
      spend: sql<number>`SUM(CAST(${adPerformance.spend} AS DOUBLE PRECISION))`,
      revenue: sql<number>`SUM(CAST(${adPerformance.revenue} AS DOUBLE PRECISION))`,
    })
    .from(adPerformance)
    .innerJoin(ads, eq(adPerformance.adId, ads.id))
    .where(
      and(
        eq(ads.workspaceId, workspaceId),
        gte(adPerformance.date, from),
        lte(adPerformance.date, to),
      ),
    )

  const impressions = Number(perf?.impressions ?? 0)
  const clicks = Number(perf?.clicks ?? 0)
  const spend = Number(perf?.spend ?? 0)
  const revenue = Number(perf?.revenue ?? 0)

  res.json({
    totalImpressions: impressions,
    totalClicks: clicks,
    totalConversions: Number(perf?.conversions ?? 0),
    totalSpend: spend,
    totalRevenue: revenue,
    avgCtr: impressions > 0 ? clicks / impressions : 0,
    avgRoas: spend > 0 ? revenue / spend : 0,
  })
})

// GET /api/workspaces/:workspaceId/analytics/by-platform
router.get('/by-platform', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const { from, to } = getDateRange(req)

  const rows = await db
    .select({
      platform: adPerformance.platform,
      impressions: sql<number>`SUM(${adPerformance.impressions})`,
      clicks: sql<number>`SUM(${adPerformance.clicks})`,
      conversions: sql<number>`SUM(${adPerformance.conversions})`,
      spend: sql<number>`SUM(CAST(${adPerformance.spend} AS DOUBLE PRECISION))`,
      revenue: sql<number>`SUM(CAST(${adPerformance.revenue} AS DOUBLE PRECISION))`,
    })
    .from(adPerformance)
    .innerJoin(ads, eq(adPerformance.adId, ads.id))
    .where(
      and(
        eq(ads.workspaceId, workspaceId),
        gte(adPerformance.date, from),
        lte(adPerformance.date, to),
      ),
    )
    .groupBy(adPerformance.platform)

  res.json(
    rows.map((r) => {
      const imp = Number(r.impressions)
      const clk = Number(r.clicks)
      const spd = Number(r.spend)
      const rev = Number(r.revenue)
      return {
        platform: r.platform,
        impressions: imp,
        clicks: clk,
        ctr: imp > 0 ? clk / imp : 0,
        conversions: Number(r.conversions),
        spend: spd,
        revenue: rev,
        roas: spd > 0 ? rev / spd : 0,
      }
    }),
  )
})

// GET /api/workspaces/:workspaceId/analytics/by-format
router.get('/by-format', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const { from, to } = getDateRange(req)

  const rows = await db
    .select({
      format: ads.format,
      impressions: sql<number>`SUM(${adPerformance.impressions})`,
      clicks: sql<number>`SUM(${adPerformance.clicks})`,
      conversions: sql<number>`SUM(${adPerformance.conversions})`,
      spend: sql<number>`SUM(CAST(${adPerformance.spend} AS DOUBLE PRECISION))`,
      revenue: sql<number>`SUM(CAST(${adPerformance.revenue} AS DOUBLE PRECISION))`,
    })
    .from(adPerformance)
    .innerJoin(ads, eq(adPerformance.adId, ads.id))
    .where(
      and(
        eq(ads.workspaceId, workspaceId),
        gte(adPerformance.date, from),
        lte(adPerformance.date, to),
      ),
    )
    .groupBy(ads.format)

  res.json(
    rows.map((r) => {
      const imp = Number(r.impressions)
      const clk = Number(r.clicks)
      const spd = Number(r.spend)
      const rev = Number(r.revenue)
      return {
        format: r.format,
        impressions: imp,
        clicks: clk,
        ctr: imp > 0 ? clk / imp : 0,
        conversions: Number(r.conversions),
        spend: spd,
        revenue: rev,
        roas: spd > 0 ? rev / spd : 0,
      }
    }),
  )
})

// GET /api/workspaces/:workspaceId/analytics/by-ad
router.get('/by-ad', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const { from, to } = getDateRange(req)
  const sortBy = (req.query.sortBy as string) || 'clicks'
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20)
  const offset = (page - 1) * limit

  const validSortCols: Record<string, ReturnType<typeof sql>> = {
    clicks: sql`SUM(${adPerformance.clicks})`,
    impressions: sql`SUM(${adPerformance.impressions})`,
    conversions: sql`SUM(${adPerformance.conversions})`,
    ctr: sql`SUM(${adPerformance.clicks})::float / NULLIF(SUM(${adPerformance.impressions}), 0)`,
    roas: sql`SUM(CAST(${adPerformance.revenue} AS DOUBLE PRECISION)) / NULLIF(SUM(CAST(${adPerformance.spend} AS DOUBLE PRECISION)), 0)`,
  }

  const orderExpr = validSortCols[sortBy] ?? validSortCols.clicks

  const rows = await db
    .select({
      adId: ads.id,
      headline: ads.headline,
      format: ads.format,
      platform: ads.platform,
      impressions: sql<number>`SUM(${adPerformance.impressions})`,
      clicks: sql<number>`SUM(${adPerformance.clicks})`,
      conversions: sql<number>`SUM(${adPerformance.conversions})`,
      spend: sql<number>`SUM(CAST(${adPerformance.spend} AS DOUBLE PRECISION))`,
      revenue: sql<number>`SUM(CAST(${adPerformance.revenue} AS DOUBLE PRECISION))`,
    })
    .from(adPerformance)
    .innerJoin(ads, eq(adPerformance.adId, ads.id))
    .where(
      and(
        eq(ads.workspaceId, workspaceId),
        gte(adPerformance.date, from),
        lte(adPerformance.date, to),
      ),
    )
    .groupBy(ads.id, ads.headline, ads.format, ads.platform)
    .orderBy(desc(orderExpr))
    .limit(limit)
    .offset(offset)

  res.json(
    rows.map((r) => {
      const imp = Number(r.impressions)
      const clk = Number(r.clicks)
      const spd = Number(r.spend)
      const rev = Number(r.revenue)
      return {
        adId: r.adId,
        headline: r.headline,
        format: r.format,
        platform: r.platform,
        impressions: imp,
        clicks: clk,
        ctr: imp > 0 ? clk / imp : 0,
        conversions: Number(r.conversions),
        spend: spd,
        revenue: rev,
        roas: spd > 0 ? rev / spd : 0,
      }
    }),
  )
})

// GET /api/workspaces/:workspaceId/analytics/top-performers
router.get('/top-performers', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const { from, to } = getDateRange(req)
  const metric = (req.query.metric as string) || 'ctr'

  const orderExpr =
    metric === 'roas'
      ? sql`SUM(CAST(${adPerformance.revenue} AS DOUBLE PRECISION)) / NULLIF(SUM(CAST(${adPerformance.spend} AS DOUBLE PRECISION)), 0)`
      : sql`SUM(${adPerformance.clicks})::float / NULLIF(SUM(${adPerformance.impressions}), 0)`

  const rows = await db
    .select({
      adId: ads.id,
      headline: ads.headline,
      format: ads.format,
      platform: ads.platform,
      imageUrl: ads.imageUrl,
      videoUrl: ads.videoUrl,
      impressions: sql<number>`SUM(${adPerformance.impressions})`,
      clicks: sql<number>`SUM(${adPerformance.clicks})`,
      conversions: sql<number>`SUM(${adPerformance.conversions})`,
      spend: sql<number>`SUM(CAST(${adPerformance.spend} AS DOUBLE PRECISION))`,
      revenue: sql<number>`SUM(CAST(${adPerformance.revenue} AS DOUBLE PRECISION))`,
    })
    .from(adPerformance)
    .innerJoin(ads, eq(adPerformance.adId, ads.id))
    .where(
      and(
        eq(ads.workspaceId, workspaceId),
        gte(adPerformance.date, from),
        lte(adPerformance.date, to),
      ),
    )
    .groupBy(ads.id, ads.headline, ads.format, ads.platform, ads.imageUrl, ads.videoUrl)
    .orderBy(desc(orderExpr))
    .limit(10)

  res.json(
    rows.map((r) => {
      const imp = Number(r.impressions)
      const clk = Number(r.clicks)
      const spd = Number(r.spend)
      const rev = Number(r.revenue)
      return {
        adId: r.adId,
        headline: r.headline,
        format: r.format,
        platform: r.platform,
        imageUrl: r.imageUrl,
        videoUrl: r.videoUrl,
        impressions: imp,
        clicks: clk,
        ctr: imp > 0 ? clk / imp : 0,
        conversions: Number(r.conversions),
        spend: spd,
        revenue: rev,
        roas: spd > 0 ? rev / spd : 0,
      }
    }),
  )
})

// GET /api/workspaces/:workspaceId/analytics/trends
router.get('/trends', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const { from, to } = getDateRange(req)

  const rows = await db
    .select({
      date: sql<string>`DATE(${adPerformance.date})`,
      impressions: sql<number>`SUM(${adPerformance.impressions})`,
      clicks: sql<number>`SUM(${adPerformance.clicks})`,
      conversions: sql<number>`SUM(${adPerformance.conversions})`,
      spend: sql<number>`SUM(CAST(${adPerformance.spend} AS DOUBLE PRECISION))`,
      revenue: sql<number>`SUM(CAST(${adPerformance.revenue} AS DOUBLE PRECISION))`,
    })
    .from(adPerformance)
    .innerJoin(ads, eq(adPerformance.adId, ads.id))
    .where(
      and(
        eq(ads.workspaceId, workspaceId),
        gte(adPerformance.date, from),
        lte(adPerformance.date, to),
      ),
    )
    .groupBy(sql`DATE(${adPerformance.date})`)
    .orderBy(sql`DATE(${adPerformance.date})`)

  // Fill in days with no data as zeros
  const dataMap: Record<string, (typeof rows)[0]> = {}
  for (const row of rows) dataMap[row.date] = row

  const days = eachDayOfInterval({ start: from, end: to })
  const trends = days.map((day) => {
    const key = format(day, 'yyyy-MM-dd')
    const row = dataMap[key]
    const imp = Number(row?.impressions ?? 0)
    const clk = Number(row?.clicks ?? 0)
    const spd = Number(row?.spend ?? 0)
    const rev = Number(row?.revenue ?? 0)
    return {
      date: key,
      impressions: imp,
      clicks: clk,
      ctr: imp > 0 ? clk / imp : 0,
      conversions: Number(row?.conversions ?? 0),
      spend: spd,
      revenue: rev,
    }
  })

  res.json(trends)
})

// POST /api/workspaces/:workspaceId/analytics/ingest
router.post(
  '/ingest',
  validate(
    z.object({
      events: z.array(
        z.object({
          adId: z.string().uuid(),
          platform: z.string(),
          date: z.string(),
          impressions: z.number().int().min(0).default(0),
          clicks: z.number().int().min(0).default(0),
          conversions: z.number().int().min(0).default(0),
          spend: z.string().default('0'),
          revenue: z.string().default('0'),
          externalAdId: z.string().optional(),
          rawData: z.record(z.unknown()).optional(),
        }),
      ),
    }),
  ),
  async (req: Request, res: Response) => {
    const { events } = req.body as {
      events: Array<{
        adId: string
        platform: string
        date: string
        impressions: number
        clicks: number
        conversions: number
        spend: string
        revenue: string
        externalAdId?: string
        rawData?: Record<string, unknown>
      }>
    }

    if (events.length === 0) {
      res.json({ inserted: 0 })
      return
    }

    const rows = events.map((e) => ({
      adId: e.adId,
      platform: e.platform,
      date: new Date(e.date),
      impressions: e.impressions,
      clicks: e.clicks,
      conversions: e.conversions,
      spend: e.spend,
      revenue: e.revenue,
      externalAdId: e.externalAdId ?? null,
      rawData: e.rawData ?? null,
    }))

    await db.insert(adPerformance).values(rows)

    res.json({ inserted: rows.length })
  },
)

// GET /api/workspaces/:workspaceId/analytics/insights
router.get('/insights', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const insights = await db
    .select()
    .from(performanceInsights)
    .where(eq(performanceInsights.workspaceId, workspaceId))
    .orderBy(desc(performanceInsights.priority), desc(performanceInsights.updatedAt))
    .limit(20)

  res.json(insights)
})

export default router
