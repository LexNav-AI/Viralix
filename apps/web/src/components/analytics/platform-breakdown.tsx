import {
  RadialBarChart,
  RadialBar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { PlatformBreakdown } from '@viralix/types'
import { formatNumber, PLATFORM_COLORS, PLATFORM_LABELS } from '../../lib/utils'
import { Skeleton } from '../ui/skeleton'

interface PlatformBreakdownChartProps {
  data: PlatformBreakdown[]
  loading?: boolean
}

export function PlatformBreakdownChart({ data, loading }: PlatformBreakdownChartProps) {
  if (loading) {
    return <Skeleton className="h-64 w-full rounded-xl" />
  }

  const chartData = data.map((d, i) => ({
    name: PLATFORM_LABELS[d.platform] ?? d.platform,
    impressions: d.impressions,
    fill: PLATFORM_COLORS[d.platform] ?? `hsl(${i * 50} 70% 50%)`,
  }))

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <ResponsiveContainer width="100%" height={200}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="20%"
            outerRadius="80%"
            data={chartData}
          >
            <RadialBar dataKey="impressions" cornerRadius={4} />
            <Tooltip
              formatter={(value: number) => [formatNumber(value, true), 'Impressions']}
              contentStyle={{
                background: 'hsl(240 5% 8%)',
                border: '1px solid hsl(240 14% 12%)',
                borderRadius: 12,
                color: 'hsl(0 0% 95%)',
                fontSize: 12,
              }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.fill }} />
            <div>
              <p className="text-xs font-medium text-[hsl(var(--foreground))]">{item.name}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{formatNumber(item.impressions, true)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
