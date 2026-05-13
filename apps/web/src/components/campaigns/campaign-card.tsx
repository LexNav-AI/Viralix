import { Link } from 'wouter'
import { Calendar, DollarSign, LayoutGrid } from 'lucide-react'
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts'
import type { Campaign } from '@viralix/types'
import { cn, formatDate, formatCurrency, PLATFORM_LABELS } from '../../lib/utils'
import { Badge } from '../ui/badge'

const STATUS_VARIANT: Record<string, 'success' | 'default' | 'secondary' | 'warning' | 'destructive' | 'outline'> = {
  active: 'success',
  draft: 'secondary',
  paused: 'warning',
  completed: 'default',
  archived: 'outline',
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  tiktok: '#FF0050',
  linkedin: '#0A66C2',
  twitter: '#1DA1F2',
  youtube: '#FF0000',
  pinterest: '#E60023',
}

interface CampaignCardProps {
  campaign: Campaign
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const adCount = campaign.adCount ?? 0
  const chartData = [{ value: Math.min(100, adCount * 10), fill: 'hsl(262 83% 58%)' }]

  return (
    <Link href={`/campaigns/${campaign.id}`}>
      <div className={cn(
        'rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 hover:border-[hsl(262,83%,58%,0.4)] transition-all duration-200 cursor-pointer group',
      )}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[hsl(var(--foreground))] truncate group-hover:text-[hsl(var(--accent-foreground))] transition-colors">
              {campaign.name}
            </h3>
            {campaign.objective && (
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 capitalize">
                {campaign.objective}
              </p>
            )}
          </div>
          <div className="shrink-0">
            <Badge variant={STATUS_VARIANT[campaign.status] ?? 'secondary'}>
              {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
            </Badge>
          </div>
        </div>

        {/* Platform icons */}
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {campaign.platforms.map((platform) => (
            <div
              key={platform}
              className="px-2 py-0.5 rounded text-[10px] font-semibold"
              style={{
                background: `${PLATFORM_COLORS[platform]}22`,
                color: PLATFORM_COLORS[platform] ?? '#888',
              }}
            >
              {PLATFORM_LABELS[platform] ?? platform}
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-1.5">
            {campaign.budget && (
              <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                <DollarSign className="h-3 w-3" />
                <span>{formatCurrency(parseFloat(campaign.budget))} budget</span>
              </div>
            )}
            {(campaign.startDate || campaign.endDate) && (
              <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                <Calendar className="h-3 w-3" />
                <span>
                  {campaign.startDate ? formatDate(campaign.startDate) : '—'}
                  {campaign.endDate ? ` → ${formatDate(campaign.endDate)}` : ''}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
              <LayoutGrid className="h-3 w-3" />
              <span>{adCount} ad{adCount !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Mini ring chart */}
          <div className="h-14 w-14 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="90%"
                data={chartData}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar
                  dataKey="value"
                  cornerRadius={4}
                  background={{ fill: 'hsl(240 5% 14%)' }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Link>
  )
}
