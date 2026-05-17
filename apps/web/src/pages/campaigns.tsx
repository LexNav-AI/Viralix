import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Globe, Search, Megaphone, X, Zap, ArrowRight, Trash2 } from 'lucide-react'
import { useLocation } from 'wouter'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, timeAgo } from '@/lib/utils'
import type { Campaign } from '@/lib/api'

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  pending: 'outline',
  scraping: 'warning',
  ready: 'success',
  failed: 'destructive',
}

export default function Campaigns() {
  const [, navigate] = useLocation()
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [url, setUrl] = useState('')
  const [search, setSearch] = useState('')

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: api.campaigns.list,
    refetchInterval: (query) => {
      const data = query.state.data
      if (Array.isArray(data) && data.some((c: Campaign) => c.status === 'scraping' || c.status === 'pending')) return 3000
      return false
    },
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.campaigns.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })

  const filtered = campaigns?.filter(c =>
    !search || c.brandName?.toLowerCase().includes(search.toLowerCase()) || c.url.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F4F5]">Campaigns</h1>
          <p className="text-sm text-[#8B8BA0]">{campaigns?.length ?? 0} campaigns total</p>
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8BA0]" />
        <Input
          className="pl-9"
          placeholder="Search campaigns..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Campaign grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1033] flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-7 h-7 text-[#A78BFA]" />
          </div>
          <h3 className="font-semibold text-lg text-[#F4F4F5] mb-1">
            {search ? 'No campaigns match your search' : 'No campaigns yet'}
          </h3>
          <p className="text-[#8B8BA0] text-sm mb-6 max-w-sm mx-auto">
            {search ? 'Try a different search term.' : 'Add your first campaign URL to get started.'}
          </p>
          {!search && (
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 mr-1.5" />Add First Campaign
            </Button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((campaign, i) => (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
            >
              <Card className="hover:border-[#7C3AED]/40 transition-colors cursor-pointer group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-[#1A1033] flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-[#A78BFA]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANTS[campaign.status] ?? 'outline'}>
                        {campaign.status}
                      </Badge>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteMutation.mutate(campaign.id) }}
                        className="opacity-0 group-hover:opacity-100 text-[#8B8BA0] hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-semibold text-[#F4F4F5] truncate mb-0.5">
                    {campaign.brandName || (() => { try { return new URL(campaign.url.startsWith('http') ? campaign.url : `https://${campaign.url}`).hostname } catch { return campaign.url } })()}
                  </h3>
                  <p className="text-xs text-[#8B8BA0] truncate mb-3">{campaign.url}</p>

                  <div className="flex items-center justify-between text-xs text-[#8B8BA0]">
                    <span>{campaign.ads?.length ?? 0} ads</span>
                    <span>{timeAgo(campaign.createdAt)}</span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#1A1A24] flex items-center justify-between">
                    <span className="text-xs text-[#8B8BA0]">{formatDate(campaign.createdAt)}</span>
                    <a
                      href={`/campaigns/${campaign.id}`}
                      className="flex items-center gap-1 text-xs text-[#A78BFA] hover:text-[#7C3AED] transition-colors"
                    >
                      View <ArrowRight className="w-3 h-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
