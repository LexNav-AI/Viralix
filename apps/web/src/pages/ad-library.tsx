import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Hash, CheckCircle, XCircle, Filter } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Campaign, Ad } from '@/lib/api'

const PLATFORMS = ['all', 'facebook', 'instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'pinterest', 'snapchat']
const STATUSES = ['all', 'ready', 'approved', 'rejected', 'posted', 'pending', 'generating']

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  pending: 'outline',
  generating: 'warning',
  ready: 'default',
  approved: 'success',
  rejected: 'destructive',
  posted: 'outline',
}

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

type AdWithCampaign = Ad & { campaignName?: string }

export default function AdLibrary() {
  const qc = useQueryClient()
  const [platformFilter, setPlatformFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Fetch all campaigns then their ads
  const { data: campaigns, isLoading: loadingCampaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: api.campaigns.list,
  })

  const campaignIds = campaigns?.map(c => c.id) ?? []

  const adQueries = useQuery({
    queryKey: ['all-ads', campaignIds],
    queryFn: async () => {
      if (campaignIds.length === 0) return []
      const results = await Promise.all(
        campaignIds.map(cid =>
          api.ads.listByCampaign(cid).then(ads =>
            ads.map(ad => ({
              ...ad,
              campaignName: campaigns?.find(c => c.id === cid)?.brandName ?? cid,
            }))
          )
        )
      )
      return results.flat() as AdWithCampaign[]
    },
    enabled: campaignIds.length > 0,
  })

  const approveMutation = useMutation({
    mutationFn: (adId: string) => api.ads.approve(adId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-ads'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (adId: string) => api.ads.reject(adId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-ads'] })
    },
  })

  const allAds = adQueries.data ?? []

  const filteredAds = allAds.filter(ad => {
    if (platformFilter !== 'all' && ad.platform !== platformFilter) return false
    if (statusFilter !== 'all' && ad.status !== statusFilter) return false
    return true
  })

  const isLoading = loadingCampaigns || adQueries.isLoading

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F4F5]">Ad Library</h1>
          <p className="text-sm text-[#8B8BA0]">{filteredAds.length} ads {allAds.length !== filteredAds.length ? `(filtered from ${allAds.length})` : 'total'}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-[#8B8BA0] shrink-0" />

        {/* Platform filter */}
        <div className="flex flex-wrap gap-1">
          {PLATFORMS.map(p => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                platformFilter === p
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-[#1A1A24] text-[#8B8BA0] hover:text-[#F4F4F5]'
              }`}
            >
              {p === 'all' ? 'All Platforms' : p}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[#1A1A24]" />

        {/* Status filter */}
        <div className="flex flex-wrap gap-1">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                statusFilter === s
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-[#1A1A24] text-[#8B8BA0] hover:text-[#F4F4F5]'
              }`}
            >
              {s === 'all' ? 'All Statuses' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Ads grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
        </div>
      ) : filteredAds.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[#8B8BA0] text-sm">
            {allAds.length === 0
              ? 'No ads generated yet. Create a campaign to get started.'
              : 'No ads match the selected filters.'}
          </p>
          {allAds.length === 0 && (
            <a href="/campaigns" className="mt-4 inline-block">
              <Button>Go to Campaigns</Button>
            </a>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAds.map((ad, i) => (
            <motion.div
              key={ad.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="flex flex-col h-full">
                <CardContent className="p-4 flex flex-col h-full">
                  {/* Platform + format + status */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <Badge
                      className="capitalize text-[10px]"
                      style={{
                        backgroundColor: `${PLATFORM_COLORS[ad.platform] ?? '#7C3AED'}20`,
                        color: PLATFORM_COLORS[ad.platform] ?? '#A78BFA',
                        border: 'none',
                      }}
                    >
                      {ad.platform}
                    </Badge>
                    <Badge variant="outline" className="capitalize text-[10px]">{ad.format}</Badge>
                    <div className="ml-auto">
                      <Badge variant={STATUS_VARIANTS[ad.status] ?? 'outline'} className="text-[10px]">
                        {ad.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Campaign name */}
                  {ad.campaignName && (
                    <p className="text-[10px] text-[#8B8BA0] mb-1.5 truncate">{ad.campaignName}</p>
                  )}

                  {/* Headline */}
                  <h4 className="font-semibold text-[#F4F4F5] text-sm mb-2 leading-snug">{ad.headline}</h4>

                  {/* Body */}
                  <p className="text-xs text-[#8B8BA0] leading-relaxed mb-3 flex-1 line-clamp-3">{ad.body}</p>

                  {/* CTA */}
                  {ad.cta && (
                    <div className="mb-2">
                      <span className="text-xs font-medium text-[#7C3AED] bg-[#1A1033] px-2 py-0.5 rounded-md">
                        {ad.cta}
                      </span>
                    </div>
                  )}

                  {/* Hashtags */}
                  {ad.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {ad.hashtags.slice(0, 3).map((tag, j) => (
                        <span key={j} className="flex items-center gap-0.5 text-[10px] text-[#8B8BA0]">
                          <Hash className="w-2.5 h-2.5" />{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Approve / Reject */}
                  {(ad.status === 'ready' || ad.status === 'pending') && (
                    <div className="flex gap-1.5 pt-3 border-t border-[#1A1A24]">
                      <Button
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7"
                        loading={approveMutation.isPending && approveMutation.variables === ad.id}
                        onClick={() => approveMutation.mutate(ad.id)}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 text-xs h-7"
                        loading={rejectMutation.isPending && rejectMutation.variables === ad.id}
                        onClick={() => rejectMutation.mutate(ad.id)}
                      >
                        <XCircle className="w-3 h-3 mr-1" />Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
