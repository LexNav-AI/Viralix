import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { api } from '@/lib/api'
import { formatNumber, formatPercent, formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, RadialBarChart, RadialBar, Legend, Cell } from 'recharts'

const DATE_RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2', instagram: '#E1306C', tiktok: '#69C9D0', linkedin: '#0A66C2', twitter: '#1DA1F2',
}

export default function AnalyticsPage() {
  const { workspace } = useWorkspace()
  const wid = workspace?.id ?? ''
  const [range, setRange] = useState(30)

  const dateFrom = new Date(Date.now() - range * 86400000).toISOString().split('T')[0]
  const dateTo = new Date().toISOString().split('T')[0]

  const { data: overview, isLoading: loadO } = useQuery({ queryKey: ['analytics', 'overview', wid, range], queryFn: () => api.analytics.overview(wid, { from: dateFrom, to: dateTo }), enabled: !!wid })
  const { data: trends, isLoading: loadT } = useQuery({ queryKey: ['analytics', 'trends', wid, range], queryFn: () => api.analytics.trends(wid, { from: dateFrom, to: dateTo }), enabled: !!wid })
  const { data: byPlatform } = useQuery({ queryKey: ['analytics', 'by-platform', wid, range], queryFn: () => api.analytics.byPlatform(wid, { from: dateFrom, to: dateTo }), enabled: !!wid })
  const { data: byFormat } = useQuery({ queryKey: ['analytics', 'by-format', wid, range], queryFn: () => api.analytics.byFormat(wid, { from: dateFrom, to: dateTo }), enabled: !!wid })
  const { data: topAds } = useQuery({ queryKey: ['analytics', 'top-performers', wid, range], queryFn: () => api.analytics.topPerformers(wid, { metric: 'ctr', limit: 10 }), enabled: !!wid })
  const { data: insights } = useQuery({ queryKey: ['analytics', 'insights', wid], queryFn: () => api.analytics.insights(wid), enabled: !!wid })

  const metrics = [
    { label: 'Total Impressions', value: loadO ? null : formatNumber(overview?.impressions ?? 0) },
    { label: 'Total Clicks', value: loadO ? null : formatNumber(overview?.clicks ?? 0) },
    { label: 'Avg CTR', value: loadO ? null : formatPercent(overview?.avgCtr ?? 0) },
    { label: 'Total Spend', value: loadO ? null : formatCurrency(overview?.spend ?? 0) },
    { label: 'Conversions', value: loadO ? null : formatNumber(overview?.conversions ?? 0) },
    { label: 'Avg ROAS', value: loadO ? null : `${Number(overview?.avgRoas ?? 0).toFixed(2)}x` },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm">Performance across all platforms</p>
        </div>
        <div className="flex gap-1">
          {DATE_RANGES.map(r => (
            <Button key={r.label} size="sm" variant={range === r.days ? 'default' : 'outline'} onClick={() => setRange(r.days)}>
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {metrics.map(m => (
          <Card key={m.label}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              {m.value === null ? <Skeleton className="h-6 w-16 mt-1" /> : <p className="text-lg font-bold mt-0.5">{m.value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Impressions & Clicks Trend</CardTitle></CardHeader>
          <CardContent>
            {loadT ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trends ?? []}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8B8BA0' }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8BA0' }} />
                  <Tooltip contentStyle={{ background: '#111116', border: '1px solid #1A1A24', borderRadius: 8, fontSize: 11 }} />
                  <Line type="monotone" dataKey="impressions" stroke="#7C3AED" strokeWidth={2} dot={false} name="Impressions" />
                  <Line type="monotone" dataKey="clicks" stroke="#60A5FA" strokeWidth={2} dot={false} name="Clicks" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Clicks by Platform</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byPlatform ?? []}>
                <XAxis dataKey="platform" tick={{ fontSize: 10, fill: '#8B8BA0' }} />
                <YAxis tick={{ fontSize: 10, fill: '#8B8BA0' }} />
                <Tooltip contentStyle={{ background: '#111116', border: '1px solid #1A1A24', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="clicks" radius={[4, 4, 0, 0]}>
                  {(byPlatform ?? []).map((entry: { platform: string }) => (
                    <Cell key={entry.platform} fill={PLATFORM_COLORS[entry.platform] ?? '#7C3AED'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">CTR by Format</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={byFormat ?? []} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10, fill: '#8B8BA0' }} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="format" tick={{ fontSize: 10, fill: '#8B8BA0' }} width={100} tickFormatter={f => f.replace(/_/g, ' ')} />
              <Tooltip contentStyle={{ background: '#111116', border: '1px solid #1A1A24', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="avgCtr" fill="#7C3AED" radius={[0, 4, 4, 0]} name="Avg CTR %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Top Performing Ads</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Ad</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Format</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Platform</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Impressions</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">CTR</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {(topAds ?? []).map((ad: { adId: string; headline: string; format: string; platform: string; totalImpressions: number; avgCtr: number; avgRoas: number }) => (
                  <tr key={ad.adId} className="border-b border-border/50 hover:bg-accent/20">
                    <td className="py-2 max-w-48 truncate">{ad.headline}</td>
                    <td className="py-2 text-xs text-muted-foreground">{ad.format.replace(/_/g, ' ')}</td>
                    <td className="py-2"><Badge variant="outline" className="text-xs capitalize">{ad.platform}</Badge></td>
                    <td className="py-2 text-right text-xs">{formatNumber(ad.totalImpressions)}</td>
                    <td className="py-2 text-right text-xs text-emerald-400">{formatPercent(ad.avgCtr)}</td>
                    <td className="py-2 text-right text-xs">{Number(ad.avgRoas).toFixed(2)}x</td>
                  </tr>
                ))}
                {!topAds?.length && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">No performance data yet</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {insights && insights.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">AI Insights</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.slice(0, 6).map((i: { id: string; insightType: string; insight: string; confidence: string | number }) => (
              <div key={i.id} className="p-3 rounded-lg bg-accent/50 border border-border">
                <Badge variant="secondary" className="text-xs mb-1.5 capitalize">{i.insightType.replace(/_/g, ' ')}</Badge>
                <p className="text-xs leading-relaxed">{i.insight}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
