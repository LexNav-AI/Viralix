import { eq, desc, sql, and, gte } from 'drizzle-orm'
import { db, ads, adPerformance, performanceInsights, modelFineTunes } from '../db'
import { config } from '../config'

interface TopExample {
  headline: string
  bodyText: string
  ctr: number
  roas: number
}

interface AdWithPerformance {
  id: string
  headline: string | null
  bodyText: string | null
  format: string
  platform: string
  totalImpressions: number
  totalClicks: number
  totalConversions: number
  totalSpend: number
  totalRevenue: number
}

export async function analyzeWorkspacePerformance(workspaceId: string): Promise<void> {
  // Pull last 90 days of performance data for this workspace
  const since = new Date()
  since.setDate(since.getDate() - 90)

  const rows = await db
    .select({
      adId: adPerformance.adId,
      platform: adPerformance.platform,
      impressions: sql<number>`SUM(${adPerformance.impressions})`.as('total_impressions'),
      clicks: sql<number>`SUM(${adPerformance.clicks})`.as('total_clicks'),
      conversions: sql<number>`SUM(${adPerformance.conversions})`.as('total_conversions'),
      spend: sql<number>`SUM(CAST(${adPerformance.spend} AS DOUBLE PRECISION))`.as('total_spend'),
      revenue: sql<number>`SUM(CAST(${adPerformance.revenue} AS DOUBLE PRECISION))`.as('total_revenue'),
    })
    .from(adPerformance)
    .innerJoin(ads, eq(adPerformance.adId, ads.id))
    .where(and(eq(ads.workspaceId, workspaceId), gte(adPerformance.date, since)))
    .groupBy(adPerformance.adId, adPerformance.platform)

  if (rows.length === 0) return

  // Compute aggregates
  let totalImpressions = 0
  let totalClicks = 0
  let totalConversions = 0
  let totalSpend = 0
  let totalRevenue = 0

  const adAggregates: Record<string, AdWithPerformance> = {}

  for (const row of rows) {
    totalImpressions += Number(row.impressions)
    totalClicks += Number(row.clicks)
    totalConversions += Number(row.conversions)
    totalSpend += Number(row.spend)
    totalRevenue += Number(row.revenue)

    if (!adAggregates[row.adId]) {
      const [ad] = await db.select().from(ads).where(eq(ads.id, row.adId)).limit(1)
      if (!ad) continue
      adAggregates[row.adId] = {
        id: ad.id,
        headline: ad.headline,
        bodyText: ad.bodyText,
        format: ad.format,
        platform: ad.platform,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
        totalSpend: 0,
        totalRevenue: 0,
      }
    }
    adAggregates[row.adId].totalImpressions += Number(row.impressions)
    adAggregates[row.adId].totalClicks += Number(row.clicks)
    adAggregates[row.adId].totalConversions += Number(row.conversions)
    adAggregates[row.adId].totalSpend += Number(row.spend)
    adAggregates[row.adId].totalRevenue += Number(row.revenue)
  }

  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0

  const adList = Object.values(adAggregates)
  const sortedByCtr = [...adList].sort((a, b) => {
    const ctrA = a.totalImpressions > 0 ? a.totalClicks / a.totalImpressions : 0
    const ctrB = b.totalImpressions > 0 ? b.totalClicks / b.totalImpressions : 0
    return ctrB - ctrA
  })

  const topByCtr = sortedByCtr.slice(0, 5)

  // Platform breakdown
  const platformMap: Record<string, { impressions: number; clicks: number }> = {}
  for (const row of rows) {
    if (!platformMap[row.platform]) platformMap[row.platform] = { impressions: 0, clicks: 0 }
    platformMap[row.platform].impressions += Number(row.impressions)
    platformMap[row.platform].clicks += Number(row.clicks)
  }
  const bestPlatform = Object.entries(platformMap).sort((a, b) => {
    const ctrA = a[1].impressions > 0 ? a[1].clicks / a[1].impressions : 0
    const ctrB = b[1].impressions > 0 ? b[1].clicks / b[1].impressions : 0
    return ctrB - ctrA
  })[0]

  // Format breakdown
  const formatMap: Record<string, { impressions: number; clicks: number }> = {}
  for (const ad of adList) {
    if (!formatMap[ad.format]) formatMap[ad.format] = { impressions: 0, clicks: 0 }
    formatMap[ad.format].impressions += ad.totalImpressions
    formatMap[ad.format].clicks += ad.totalClicks
  }
  const bestFormat = Object.entries(formatMap).sort((a, b) => {
    const ctrA = a[1].impressions > 0 ? a[1].clicks / a[1].impressions : 0
    const ctrB = b[1].impressions > 0 ? b[1].clicks / b[1].impressions : 0
    return ctrB - ctrA
  })[0]

  const now = new Date()

  const insights: Array<{
    insightType: string
    title: string
    description: string
    data: object
    priority: number
  }> = []

  insights.push({
    insightType: 'performance_summary',
    title: '90-Day Performance Summary',
    description: `Your ads achieved an average CTR of ${avgCtr.toFixed(2)}% and ROAS of ${avgRoas.toFixed(2)}x over the last 90 days.`,
    data: { avgCtr, avgRoas, totalImpressions, totalClicks, totalConversions, totalSpend, totalRevenue },
    priority: 10,
  })

  if (bestPlatform) {
    const [plat, stats] = bestPlatform
    const platCtr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : '0.00'
    insights.push({
      insightType: 'best_platform',
      title: `${plat} is Your Top Platform`,
      description: `${plat} delivers the highest CTR at ${platCtr}% across this period.`,
      data: { platform: plat, ...stats },
      priority: 8,
    })
  }

  if (bestFormat) {
    const [fmt, stats] = bestFormat
    const fmtCtr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : '0.00'
    insights.push({
      insightType: 'best_format',
      title: `${fmt} Drives the Best Engagement`,
      description: `The ${fmt} format achieves a ${fmtCtr}% CTR — consider generating more of these.`,
      data: { format: fmt, ...stats },
      priority: 7,
    })
  }

  if (topByCtr.length > 0 && topByCtr[0].headline) {
    insights.push({
      insightType: 'top_performer_pattern',
      title: 'Top Performer Identified',
      description: `Your best ad headline starts with "${topByCtr[0].headline.substring(0, 40)}..." — similar copy tends to outperform.`,
      data: {
        topAdIds: topByCtr.map((a) => a.id),
        topHeadlines: topByCtr.map((a) => a.headline),
      },
      priority: 9,
    })
  }

  // Upsert insights
  for (const insight of insights) {
    const existing = await db
      .select()
      .from(performanceInsights)
      .where(
        and(
          eq(performanceInsights.workspaceId, workspaceId),
          eq(performanceInsights.insightType, insight.insightType),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(performanceInsights)
        .set({
          title: insight.title,
          description: insight.description,
          data: insight.data,
          priority: insight.priority,
          updatedAt: now,
        })
        .where(eq(performanceInsights.id, existing[0].id))
    } else {
      await db.insert(performanceInsights).values({
        workspaceId,
        ...insight,
      })
    }
  }

  // Trigger fine-tune if enough samples and feature is enabled
  if (config.finetuneEnabled && adList.length >= 100) {
    const [existingFt] = await db
      .select()
      .from(modelFineTunes)
      .where(and(eq(modelFineTunes.workspaceId, workspaceId), eq(modelFineTunes.status, 'pending')))
      .limit(1)

    if (!existingFt) {
      await db.insert(modelFineTunes).values({
        workspaceId,
        status: 'pending',
        sampleCount: adList.length,
      })
      console.log(`[PerformanceLearner] Fine-tune queued for workspace ${workspaceId} with ${adList.length} samples`)
    } else {
      await db
        .update(modelFineTunes)
        .set({ sampleCount: adList.length, updatedAt: now })
        .where(eq(modelFineTunes.id, existingFt.id))
    }
  }

  console.log(`[PerformanceLearner] Workspace ${workspaceId}: ${insights.length} insights upserted`)
}

export async function analyzeAllWorkspaces(): Promise<void> {
  const { isNull } = await import('drizzle-orm')
  const { workspaces } = await import('../db')

  const activeWorkspaces = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(isNull(workspaces.deletedAt))

  for (const ws of activeWorkspaces) {
    try {
      await analyzeWorkspacePerformance(ws.id)
    } catch (err) {
      console.error(`[PerformanceLearner] analyzeAllWorkspaces failed for workspace ${ws.id}:`, err)
    }
  }
}

export async function getTopPerformingExamples(
  workspaceId: string,
  limit: number,
): Promise<TopExample[]> {
  const rows = await db
    .select({
      headline: ads.headline,
      bodyText: ads.bodyText,
      impressions: sql<number>`SUM(${adPerformance.impressions})`.as('impressions'),
      clicks: sql<number>`SUM(${adPerformance.clicks})`.as('clicks'),
      spend: sql<number>`SUM(CAST(${adPerformance.spend} AS DOUBLE PRECISION))`.as('spend'),
      revenue: sql<number>`SUM(CAST(${adPerformance.revenue} AS DOUBLE PRECISION))`.as('revenue'),
    })
    .from(ads)
    .innerJoin(adPerformance, eq(ads.id, adPerformance.adId))
    .where(and(eq(ads.workspaceId, workspaceId), eq(ads.status, 'published')))
    .groupBy(ads.id, ads.headline, ads.bodyText)
    .orderBy(desc(sql`SUM(${adPerformance.clicks})::float / NULLIF(SUM(${adPerformance.impressions}), 0)`))
    .limit(limit)

  return rows
    .filter((r) => r.headline && r.bodyText)
    .map((r) => {
      const imp = Number(r.impressions)
      const clk = Number(r.clicks)
      const spd = Number(r.spend)
      const rev = Number(r.revenue)
      return {
        headline: r.headline as string,
        bodyText: r.bodyText as string,
        ctr: imp > 0 ? clk / imp : 0,
        roas: spd > 0 ? rev / spd : 0,
      }
    })
}
