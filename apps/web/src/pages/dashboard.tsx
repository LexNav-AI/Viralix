import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import { motion } from 'framer-motion'
import {
  Zap, TrendingUp, Image, Calendar, Plus, BarChart2, Wifi, WifiOff, Lightbulb, ArrowRight,
} from 'lucide-react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { analytics, ads, connections, calendar } from '@/lib/api'
import { formatNumber, formatPercent, formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { MetricsCard } from '@/components/analytics/metrics-card'
import { PerformanceChart } from '@/components/analytics/performance-chart'
import type { Ad, PlatformConnection, ScheduledPost, PerformanceInsight } from '@viralix/types'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3 } }),
}

const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2', instagram: '#E1306C', tiktok: '#FF0050', linkedin: '#0A66C2', twitter: '#1DA1F2',
}

const ALL_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter']

export default function DashboardPage() {
  const { workspace } = useWorkspace()
  const wid = workspace?.id ?? ''

  const { data: dashboard, isLoading: loadingDash } = useQuery({
    queryKey: ['analytics', 'dashboard', wid, '7d'],
    queryFn: () => analytics.dashboard(wid, '7d'),
    enabled: !!wid,
  })

  const { data: recentAds, isLoading: loadingAds } = useQuery({
    queryKey: ['ads', wid, 'recent'],
    queryFn: () => ads.list(wid, { perPage: 6, status: 'ready' }),
    enabled: !!wid,
  })

  const { data: conns } = useQuery({
    queryKey: ['connections', wid],
    queryFn: () => connections.list(wid),
    enabled: !!wid,
  })

  const { data: scheduled } = useQuery({
    queryKey: ['calendar', wid, 'upcoming'],
    queryFn: () => {
      const now = new Date()
      const week = new Date(now.getTime() + 7 * 86400_000)
      return calendar.scheduled(wid, now.toISOString(), week.toISOString())
    },
    enabled: !!wid,
  })

  const overview = dashboard?.overview
  const trends = dashboard?.trends ?? []
  const insights = dashboard?.insights ?? []
  const connectedPlatforms = new Set((conns ?? []).filter((c: PlatformConnection) => c.isActive).map((c: PlatformConnection) => c.platform))

  const sparkData = trends.map((t) => t.impressions)

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            {workspace?.name ?? 'Your workspace'} — AI ads running 24/7
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/generate">
            <Button size="sm">
              <Zap className="h-4 w-4" /> Generate Ads
            </Button>
          </Link>
          <Link href="/campaigns/new">
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4" /> New Campaign
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Impressions (7d)',
            value: overview ? formatNumber(overview.totalImpressions, true) : '—',
            delta: 12.4,
            deltaLabel: 'vs last week',
            icon: <BarChart2 className="h-4 w-4" />,
            sparklineData: sparkData,
          },
          {
            label: 'Avg. CTR',
            value: overview ? formatPercent(overview.avgCtr) : '—',
            delta: 0.3,
            deltaLabel: 'vs last week',
            icon: <TrendingUp className="h-4 w-4" />,
          },
          {
            label: 'Ads Generated Today',
            value: overview ? `${overview.adsGeneratedToday}/${overview.dailyAdLimit}` : '—',
            icon: <Image className="h-4 w-4" />,
          },
          {
            label: 'Active Campaigns',
            value: overview ? String(overview.activeCampaigns) : '—',
            icon: <Calendar className="h-4 w-4" />,
          },
        ].map((m, i) => (
          <motion.div key={m.label} custom={i} variants={fadeUp} initial="hidden" animate="visible">
            <MetricsCard
              label={m.label}
              value={m.value}
              delta={m.delta}
              deltaLabel={m.deltaLabel}
              icon={m.icon}
              sparklineData={m.sparklineData}
              loading={loadingDash}
            />
          </motion.div>
        ))}
      </div>

      {/* Generate CTA */}
      <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
        <div className="rounded-2xl bg-gradient-to-r from-[hsl(262,83%,30%)] to-[hsl(280,70%,35%)] p-6 flex items-center justify-between border border-[hsl(262,83%,45%,0.5)] animate-pulse-glow">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Ready to go viral?</h2>
            <p className="text-sm text-[hsl(262,93%,88%)]">Generate 14 platform-optimized ads from a single brief in seconds.</p>
          </div>
          <Link href="/generate">
            <Button size="lg" className="bg-white text-[hsl(262,83%,40%)] hover:bg-white/90 shadow-xl shrink-0">
              Generate Now <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Performance chart */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Performance Trends (7 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceChart data={trends} loading={loadingDash} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Platform connections */}
        <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Platform Connections</CardTitle>
              <CardDescription className="text-xs">Publish to connected accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {ALL_PLATFORMS.map((p) => (
                <div key={p} className="flex items-center justify-between py-1.5 border-b border-[hsl(var(--border))] last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2 w-2 rounded-full" style={{ background: PLATFORM_COLORS[p] }} />
                    <span className="text-sm capitalize">{p}</span>
                  </div>
                  {connectedPlatforms.has(p) ? (
                    <Badge variant="success" className="text-[10px]">
                      <Wifi className="h-3 w-3 mr-1" /> Connected
                    </Badge>
                  ) : (
                    <Link href="/connections">
                      <Badge variant="outline" className="text-[10px] cursor-pointer hover:border-[hsl(var(--primary))]">
                        <WifiOff className="h-3 w-3 mr-1" /> Connect
                      </Badge>
                    </Link>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recently generated ads */}
      <motion.div custom={7} variants={fadeUp} initial="hidden" animate="visible">
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-medium">Recently Generated Ads</CardTitle>
              <CardDescription className="text-xs">Latest ready-to-publish ads</CardDescription>
            </div>
            <Link href="/ads">
              <Button variant="ghost" size="sm" className="text-xs">View all <ArrowRight className="h-3 w-3" /></Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loadingAds ? (
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
              </div>
            ) : (recentAds?.data ?? []).length === 0 ? (
              <div className="text-center py-8">
                <Image className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--muted-foreground))] opacity-50" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No ads yet</p>
                <Link href="/generate">
                  <Button size="sm" className="mt-3">Generate your first ad</Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                {(recentAds?.data ?? []).slice(0, 6).map((ad: Ad) => (
                  <Link key={ad.id} href="/ads">
                    <div className="group rounded-lg overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/0.5)] transition-colors cursor-pointer">
                      <div className="aspect-square bg-[hsl(var(--accent))] flex items-center justify-center">
                        {ad.thumbnailUrl ? (
                          <img src={ad.thumbnailUrl} alt={ad.headline ?? ''} className="w-full h-full object-cover" />
                        ) : (
                          <Image className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                        )}
                      </div>
                      <div className="p-1.5">
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">{ad.format.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Calendar preview */}
      {(scheduled ?? []).length > 0 && (
        <motion.div custom={8} variants={fadeUp} initial="hidden" animate="visible">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[hsl(var(--primary))]" />
                <CardTitle className="text-sm font-medium">Upcoming Posts (next 7 days)</CardTitle>
              </div>
              <Link href="/calendar">
                <Button variant="ghost" size="sm" className="text-xs">View calendar <ArrowRight className="h-3 w-3" /></Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {(scheduled ?? []).slice(0, 5).map((post: ScheduledPost) => (
                  <div key={post.id} className="flex items-center justify-between py-1.5 border-b border-[hsl(var(--border))] last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ background: PLATFORM_COLORS[post.platform] ?? '#7C3AED' }} />
                      <span className="text-sm capitalize">{post.platform}</span>
                      {post.ad && (
                        <span className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-40">{post.ad.headline}</span>
                      )}
                    </div>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                      {formatDate(post.scheduledAt, 'datetime')}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* AI Insights */}
      {insights.length > 0 && (
        <motion.div custom={9} variants={fadeUp} initial="hidden" animate="visible">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-[hsl(var(--primary))]" />
                <CardTitle className="text-sm font-medium">AI Performance Insights</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {insights.slice(0, 3).map((insight: PerformanceInsight) => (
                <div key={insight.id} className="rounded-xl border border-[hsl(var(--border))] p-3 bg-[hsl(var(--accent)/0.3)]">
                  <Badge variant="secondary" className="text-xs mb-2 capitalize">
                    {insight.insightType.replace(/_/g, ' ')}
                  </Badge>
                  <p className="text-xs text-[hsl(var(--foreground))] leading-relaxed">{insight.description}</p>
                  <Progress value={insight.priority * 20} className="mt-2 h-1" />
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
