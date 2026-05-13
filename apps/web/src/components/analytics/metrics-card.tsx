import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { cn } from '../../lib/utils'
import { Skeleton } from '../ui/skeleton'

interface MetricsCardProps {
  label: string
  value: string | number
  delta?: number
  deltaLabel?: string
  sparklineData?: number[]
  icon?: React.ReactNode
  loading?: boolean
  color?: string
}

export function MetricsCard({
  label,
  value,
  delta,
  deltaLabel,
  sparklineData,
  icon,
  loading,
  color = 'hsl(262 83% 58%)',
}: MetricsCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-20" />
      </div>
    )
  }

  const isPositive = delta !== undefined && delta > 0
  const isNegative = delta !== undefined && delta < 0
  const sparkData = sparklineData?.map((v, i) => ({ v, i }))

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 hover:border-[hsl(262,83%,58%,0.3)] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
          {label}
        </p>
        {icon && (
          <div className="p-1.5 rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]">
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-[hsl(var(--foreground))] mb-1.5">{value}</p>
      <div className="flex items-center justify-between">
        {delta !== undefined && (
          <div className={cn('flex items-center gap-1 text-xs font-semibold', isPositive ? 'text-[hsl(142,71%,45%)]' : isNegative ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--muted-foreground))]')}>
            {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : isNegative ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
            <span>{isPositive ? '+' : ''}{delta.toFixed(1)}%</span>
            {deltaLabel && <span className="text-[hsl(var(--muted-foreground))] font-normal">{deltaLabel}</span>}
          </div>
        )}
        {sparkData && sparkData.length > 0 && (
          <div className="h-8 w-20">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={color}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
