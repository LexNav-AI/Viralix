import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { AnalyticsTrend } from '@viralix/types'
import { formatDate, formatNumber, formatPercent } from '../../lib/utils'
import { Skeleton } from '../ui/skeleton'

interface PerformanceChartProps {
  data: AnalyticsTrend[]
  loading?: boolean
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-3 shadow-xl">
      <p className="text-xs font-semibold text-[hsl(var(--foreground))] mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <div className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-[hsl(var(--muted-foreground))]">{entry.name}:</span>
          <span className="font-semibold text-[hsl(var(--foreground))]">
            {entry.name === 'CTR' ? formatPercent(entry.value) : formatNumber(entry.value, true)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function PerformanceChart({ data, loading }: PerformanceChartProps) {
  if (loading) {
    return <Skeleton className="h-64 w-full rounded-xl" />
  }

  const chartData = data.map((d) => ({
    date: formatDate(d.date, 'short'),
    Impressions: d.impressions,
    Clicks: d.clicks,
    CTR: d.ctr,
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 14% 14%)" />
        <XAxis
          dataKey="date"
          tick={{ fill: 'hsl(240 8% 57%)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: 'hsl(240 8% 57%)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatNumber(v, true)}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: 'hsl(240 8% 57%)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v.toFixed(1)}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => <span style={{ color: 'hsl(240 8% 57%)', fontSize: 12 }}>{value}</span>}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="Impressions"
          stroke="hsl(262 83% 68%)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: 'hsl(262 83% 68%)' }}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="Clicks"
          stroke="hsl(142 71% 45%)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: 'hsl(142 71% 45%)' }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="CTR"
          stroke="hsl(38 92% 50%)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: 'hsl(38 92% 50%)' }}
          strokeDasharray="5 3"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
