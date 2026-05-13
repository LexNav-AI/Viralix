import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import { motion } from 'framer-motion'
import { Plus, Search, SlidersHorizontal, Megaphone } from 'lucide-react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { campaigns } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { CampaignCard } from '@/components/campaigns/campaign-card'
import type { Campaign } from '@viralix/types'

export default function CampaignsPage() {
  const { workspace } = useWorkspace()
  const wid = workspace?.id ?? ''
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [platform, setPlatform] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', wid, status, platform],
    queryFn: () =>
      campaigns.list(wid, {
        status: status === 'all' ? undefined : status,
        platform: platform === 'all' ? undefined : platform,
      }),
    enabled: !!wid,
  })

  const filtered = (data?.data ?? []).filter((c: Campaign) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Campaigns</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">Manage your ad campaigns</p>
        </div>
        <Link href="/campaigns/new">
          <Button><Plus className="h-4 w-4" /> New Campaign</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <Input className="pl-9" placeholder="Search campaigns..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 text-[hsl(var(--muted-foreground))]" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="twitter">Twitter / X</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campaign grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="h-16 w-16 rounded-2xl bg-[hsl(var(--accent))] flex items-center justify-center mx-auto mb-4">
            <Megaphone className="h-7 w-7 text-[hsl(var(--accent-foreground))]" />
          </div>
          <h3 className="font-semibold text-lg mb-1">No campaigns found</h3>
          <p className="text-[hsl(var(--muted-foreground))] text-sm mb-6 max-w-sm mx-auto">
            {search || status !== 'all' ? 'Try adjusting your filters.' : 'Create your first campaign to start generating ads.'}
          </p>
          {!search && status === 'all' && (
            <Link href="/campaigns/new">
              <Button><Plus className="h-4 w-4" /> Create your first campaign</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((campaign: Campaign, i: number) => (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
            >
              <CampaignCard campaign={campaign} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
