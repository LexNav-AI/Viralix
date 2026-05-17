import { eq, desc, sql, and, gte } from 'drizzle-orm'
import { db, ads, adPerformance, performanceInsights, modelFineTunes, workspaces } from '../db'
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
  totalRoas: number
}

export async function analyzeWorkspacePerformance(workspaceId: string): Promise<void> {
  // Pull last 90 days of performance data for this workspace
  const since = new Date()
  since.setDate(since.getDate() - 90)
  const sinceStr = since.toISOString().split('T')[0] // format as YYYY-MM-DD string

  const rows = await db
    .select({
      adId: adPerformance.adId,
      platform: adPerformance.platform,
      impressions: sql<number>`SUM(${adPerformance.impressions})`.as('total_impressions'),
      clicks: sql<number>`SUM(${adPerformance.clicks})`.as('total_clicks'),
      conversions: sql<number>`SUM(${adPerformance.conversions})`.as('total_conversions'),
      spend: sql<number>`SUM(CAST(${adPerformance.spend} AS DOUBLE PRECISION))`.as('total_spend'),
      roas: sql<number>`AVG(CAST(${adPerformance.roas} AS DOUBLE PRECISION))`.as('avg_roas'),
    })
    .from(adPerformance)
    .innerJoin(ads, eq(adPerformance.adId, ads.id))
    .where(and(eq(ads.workspaceId, workspaceId), gte(adPerformance.date, sinceStr)))
    .groupBy(adPerformance.adId, adPerformance.platform)

  if (rows.length === 0) return

  // Compute aggregates
  let totalImpressions = 0
  let totalClicks = 0
  let totalConversions = 0
  let totalSpend = 0
  let totalRoas = 0
  let roasCount = 0

  const adAggregates: Record<string, AdWithPerformance> = {}

  for (const row of rows) {
    totalImpressions += Number(row.impressions)
    totalClicks += Number(row.clicks)
    totalConversions += Number(row.conversions)
    totalSpend += Number(row.spend)
    totalRoas += Number(row.roas)
    roasCount++

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
        totalRoas: 0,
      }
    }
    adAggregates[row.adId].totalImpressions += Number(row.impressions)
    adAggregates[row.adId].totalClicks += Number(row.clicks)
    adAggregates[row.adId].totalConversions += Number(row.conversions)
    adAggregates[row.adId].totalSpend += Number(row.spend)
    adAggregates[row.adId].totalRoas += Number(row.roas)
  }

  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const avgRoas = roasCount > 0 ? totalRoas / roasCount : 0

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

  const insights: Array<{
    insightType: 'headline_pattern' | 'cta_pattern' | 'visual_style' | 'audience_segment' | 'posting_time' | 'format'
    insight: string
    confidence: number
    samplesAnalyzed: number
  }> = []

  insights.push({
    insightType: 'audience_segment',
    insight: `90-Day Performance: avg CTR ${avgCtr.toFixed(2)}%, avg ROAS ${avgRoas.toFixed(2)}x over ${totalImpressions.toLocaleString()} impressions.`,
    confidence: Math.min(0.99, totalImpressions / 100000),
    samplesAnalyzed: adList.length,
  })

  if (bestPlatform) {
    const [plat, stats] = bestPlatform
    const platCtr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : '0.00'
    insights.push({
      insightType: 'posting_time',
      insight: `${plat} is your top platform with ${platCtr}% CTR.`,
      confidence: Math.min(0.99, stats.impressions / 10000),
      samplesAnalyzed: stats.impressions,
    })
  }

  if (bestFormat) {
    const [fmt, stats] = bestFormat
    const fmtCtr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : '0.00'
    insights.push({
      insightType: 'format',
      insight: `${fmt} format achieves ${fmtCtr}% CTR — consider generating more.`,
      confidence: Math.min(0.99, stats.impressions / 10000),
      samplesAnalyzed: stats.impressions,
    })
  }

  if (topByCtr.length > 0 && topByCtr[0].headline) {
    insights.push({
      insightType: 'headline_pattern',
      insight: `Top performer starts with "${topByCtr[0].headline.substring(0, 40)}..." — similar copy tends to outperform.`,
      confidence: 0.8,
      samplesAnalyzed: topByCtr.length,
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
          insight: insight.insight,
          confidence: String(insight.confidence),
          samplesAnalyzed: insight.samplesAnalyzed,
        })
        .where(eq(performanceInsights.id, existing[0].id))
    } else {
      await db.insert(performanceInsights).values({
        workspaceId,
        insightType: insight.insightType,
        insight: insight.insight,
        confidence: String(insight.confidence),
        samplesAnalyzed: insight.samplesAnalyzed,
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
        modelType: 'llama',
        status: 'pending',
        samplesUsed: adList.length,
      })
      console.log(`[PerformanceLearner] Fine-tune queued for workspace ${workspaceId} with ${adList.length} samples`)
    } else {
      await db
        .update(modelFineTunes)
        .set({ samplesUsed: adList.length })
        .where(eq(modelFineTunes.id, existingFt.id))
    }
  }

  console.log(`[PerformanceLearner] Workspace ${workspaceId}: ${insights.length} insights upserted`)
}

export async function analyzeAllWorkspaces(): Promise<void> {
  const activeWorkspaces = await db
    .select({ id: workspaces.id })
    .from(workspaces)

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
      roas: sql<number>`AVG(CAST(${adPerformance.roas} AS DOUBLE PRECISION))`.as('roas'),
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
      const roasVal = Number(r.roas)
      return {
        headline: r.headline as string,
        bodyText: r.bodyText as string,
        ctr: imp > 0 ? clk / imp : 0,
        roas: roasVal,
      }
    })
}
