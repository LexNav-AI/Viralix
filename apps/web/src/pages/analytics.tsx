import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, Eye, MousePointer, ShoppingCart } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatNumber } from '@/lib/utils'
import type { AnalyticsOverview } from '@/lib/api'

const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2',
  instagram: '#E1306C',
  tiktok: '#FF0050',
  youtube: '#FF0000',
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  pinterest: '#E60023',
  snapchat: '#FFFC00',
}

const CHART_TOOLTIP_STYLE = {
  background: '#111116',
  border: '1px solid #1A1A24',
  borderRadius: 8,
  fontSize: 12,
  color: '#F4F4F5',
}

export default function Analytics() {
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: api.analytics.overview,
    refetchInterval: 60_000,
  })

  const data = analyticsData ?? []

  const totalViews = data.reduce((acc, a) => acc + Number(a.views ?? 0), 0)
  const totalClicks = data.reduce((acc, a) => acc + Number(a.clicks ?? 0), 0)
  const totalConversions = data.reduce((acc, a) => acc + Number(a.conversions ?? 0), 0)
  const avgCtr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0

  const stats = [
    { label: 'Total Views', value: formatNumber(totalViews), icon: Eye, color: '#A78BFA' },
    { label: 'Total Clicks', value: formatNumber(totalClicks), icon: MousePointer, color: '#60A5FA' },
    { label: 'Total Conversions', value: formatNumber(totalConversions), icon: ShoppingCart, color: '#34D399' },
    { label: 'Average CTR', value: `${avgCtr.toFixed(2)}%`, icon: TrendingUp, color: '#FB923C' },
  ]

  const chartData = data.map(a => ({
    platform: a.platform,
    views: Number(a.views ?? 0),
    clicks: Number(a.clicks ?? 0),
    conversions: Number(a.conversions ?? 0),
  }))

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#F4F4F5]">Analytics</h1>
        <p className="text-sm text-[#8B8BA0]">Performance across all platforms</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : stats.map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-[#F4F4F5]">{value}</p>
                    <p className="text-xs text-[#8B8BA0]">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Bar chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance by Platform</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-[#8B8BA0] text-sm">
              No analytics data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={4}>
                <XAxis
                  dataKey="platform"
                  tick={{ fontSize: 11, fill: '#8B8BA0' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#8B8BA0' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => formatNumber(Number(v))}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: number, name: string) => [formatNumber(value), name.charAt(0).toUpperCase() + name.slice(1)]}
                />
                <Bar dataKey="views" name="views" radius={[4, 4, 0, 0]}>
                  {chartData.map(entry => (
                    <Cell key={entry.platform} fill={PLATFORM_COLORS[entry.platform] ?? '#7C3AED'} opacity={0.7} />
                  ))}
                </Bar>
                <Bar dataKey="clicks" name="clicks" radius={[4, 4, 0, 0]}>
                  {chartData.map(entry => (
                    <Cell key={entry.platform} fill={PLATFORM_COLORS[entry.platform] ?? '#7C3AED'} />
                  ))}
                </Bar>
                <Bar dataKey="conversions" name="conversions" radius={[4, 4, 0, 0]}>
                  {chartData.map(entry => (
                    <Cell key={entry.platform} fill={PLATFORM_COLORS[entry.platform] ?? '#7C3AED'} opacity={0.5} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-[#8B8BA0] text-sm">
              No analytics data yet. Launch campaigns to start collecting data.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1A1A24]">
                    <th className="text-left py-3 px-2 text-xs text-[#8B8BA0] font-medium">Platform</th>
                    <th className="text-right py-3 px-2 text-xs text-[#8B8BA0] font-medium">Views</th>
                    <th className="text-right py-3 px-2 text-xs text-[#8B8BA0] font-medium">Clicks</th>
                    <th className="text-right py-3 px-2 text-xs text-[#8B8BA0] font-medium">Conversions</th>
                    <th className="text-right py-3 px-2 text-xs text-[#8B8BA0] font-medium">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row: AnalyticsOverview) => {
                    const views = Number(row.views ?? 0)
                    const clicks = Number(row.clicks ?? 0)
                    const conversions = Number(row.conversions ?? 0)
                    const ctr = views > 0 ? ((clicks / views) * 100).toFixed(2) : '0.00'
                    return (
                      <tr key={row.platform} className="border-b border-[#1A1A24]/50 hover:bg-[#1A1A24]/30 transition-colors">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: PLATFORM_COLORS[row.platform] ?? '#7C3AED' }}
                            />
                            <Badge
                              className="capitalize text-[10px]"
                              style={{
                                backgroundColor: `${PLATFORM_COLORS[row.platform] ?? '#7C3AED'}20`,
                                color: PLATFORM_COLORS[row.platform] ?? '#A78BFA',
                                border: 'none',
                              }}
                            >
                              {row.platform}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right text-[#F4F4F5]">{formatNumber(views)}</td>
                        <td className="py-3 px-2 text-right text-[#F4F4F5]">{formatNumber(clicks)}</td>
                        <td className="py-3 px-2 text-right text-[#F4F4F5]">{formatNumber(conversions)}</td>
                        <td className="py-3 px-2 text-right">
                          <span className={Number(ctr) >= 2 ? 'text-emerald-400' : 'text-[#8B8BA0]'}>
                            {ctr}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#1A1A24]">
                    <td className="py-3 px-2 text-xs font-semibold text-[#8B8BA0]">Total</td>
                    <td className="py-3 px-2 text-right font-semibold text-[#F4F4F5]">{formatNumber(totalViews)}</td>
                    <td className="py-3 px-2 text-right font-semibold text-[#F4F4F5]">{formatNumber(totalClicks)}</td>
                    <td className="py-3 px-2 text-right font-semibold text-[#F4F4F5]">{formatNumber(totalConversions)}</td>
                    <td className="py-3 px-2 text-right font-semibold text-[#F4F4F5]">{avgCtr.toFixed(2)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
