import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Globe, Megaphone, Calendar, BarChart3, X, ArrowRight, Zap } from 'lucide-react'
import { useLocation } from 'wouter'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'
import type { Campaign } from '@/lib/api'

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  pending: 'outline',
  scraping: 'warning',
  ready: 'success',
  failed: 'destructive',
}

export default function Dashboard() {
  const [, navigate] = useLocation()
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [url, setUrl] = useState('')

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: api.campaigns.list,
    refetchInterval: (query) => {
      const data = query.state.data
      if (Array.isArray(data) && data.some((c: Campaign) => c.status === 'scraping' || c.status === 'pending')) return 3000
      return false
    },
  })

  const { data: scheduleData } = useQuery({
    queryKey: ['schedule'],
    queryFn: api.schedule.list,
  })

  const { data: analyticsData } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: api.analytics.overview,
  })

  const createMutation = useMutation({
    mutationFn: (u: string) => api.campaigns.create(u),
    onSuccess: (campaign) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      setShowNew(false)
      setUrl('')
      navigate(`/campaigns/${campaign.id}`)
    },
  })

  const totalClicks = analyticsData?.reduce((acc, a) => acc + Number(a.clicks ?? 0), 0) ?? 0

  const stats = [
    { label: 'Campaigns', value: campaigns?.length ?? 0, icon: Megaphone },
    { label: 'Schedule', value: scheduleData?.length ?? 0, icon: Calendar },
    { label: 'Total Clicks', value: totalClicks, icon: BarChart3 },
    { label: 'Platforms', value: 8, icon: Globe },
  ]

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F4F5]">Dashboard</h1>
          <p className="text-sm text-[#8B8BA0]">Your AI-powered ad generation platform</p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-1.5" />New Campaign
        </Button>
      </div>

      {/* New campaign dialog */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            onClick={() => setShowNew(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111116] border border-[#1A1A24] rounded-2xl p-6 w-full max-w-md mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-[#F4F4F5]">New Campaign</h2>
                <button onClick={() => setShowNew(false)} className="text-[#8B8BA0] hover:text-[#F4F4F5]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-[#8B8BA0] mb-4">
                Enter your website URL. Viralix will scrape your site and generate 14 ads per day across 8 platforms.
              </p>
              <div className="space-y-3">
                <Input
                  type="url"
                  placeholder="https://yourwebsite.com"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && url && createMutation.mutate(url)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowNew(false)}>Cancel</Button>
                  <Button
                    className="flex-1"
                    disabled={!url || createMutation.isPending}
                    loading={createMutation.isPending}
                    onClick={() => createMutation.mutate(url)}
                  >
                    <Zap className="w-4 h-4 mr-1.5" />Start Campaign
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#1A1033] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#A78BFA]" />
                </div>
                <div>
                  <p className="text-xl font-bold text-[#F4F4F5]">{value}</p>
                  <p className="text-xs text-[#8B8BA0]">{label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Recent Campaigns */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : !campaigns || campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="w-10 h-10 mx-auto mb-3 text-[#8B8BA0] opacity-40" />
              <h3 className="font-semibold text-[#F4F4F5] mb-1">No campaigns yet</h3>
              <p className="text-sm text-[#8B8BA0] mb-4">Add a URL and watch Viralix generate 14 ads per day across every platform.</p>
              <Button onClick={() => setShowNew(true)}>
                <Plus className="w-4 h-4 mr-1.5" />Add First Campaign
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.slice(0, 5).map((campaign) => (
                <a key={campaign.id} href={`/campaigns/${campaign.id}`} className="flex items-center gap-4 p-3 rounded-lg hover:bg-[#1A1A24] transition-colors group">
                  <div className="w-9 h-9 rounded-lg bg-[#1A1033] flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-[#A78BFA]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#F4F4F5] truncate">{campaign.brandName || campaign.url}</p>
                    <p className="text-xs text-[#8B8BA0] truncate">{campaign.url}</p>
                  </div>
                  <Badge variant={STATUS_VARIANTS[campaign.status] ?? 'outline'}>{campaign.status}</Badge>
                  <span className="text-xs text-[#8B8BA0] shrink-0">{timeAgo(campaign.createdAt)}</span>
                  <ArrowRight className="w-4 h-4 text-[#8B8BA0] opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
