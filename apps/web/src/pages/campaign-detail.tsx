import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'wouter'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Globe, Loader2, CheckCircle, XCircle,
  Hash, ExternalLink, RefreshCw
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Ad } from '@/lib/api'

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  pending: 'outline',
  scraping: 'warning',
  ready: 'default',
  approved: 'success',
  rejected: 'destructive',
  posted: 'outline',
  generating: 'warning',
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

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.campaigns.get(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'scraping' || status === 'pending') return 3000
      return false
    },
  })

  const { data: ads, isLoading: loadingAds } = useQuery({
    queryKey: ['ads', 'campaign', id],
    queryFn: () => api.ads.listByCampaign(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data
      if (Array.isArray(data) && data.some((a: Ad) => a.status === 'pending' || a.status === 'generating')) return 3000
      return false
    },
  })

  const approveMutation = useMutation({
    mutationFn: (adId: string) => api.ads.approve(adId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ads', 'campaign', id] }),
  })

  const rejectMutation = useMutation({
    mutationFn: (adId: string) => api.ads.reject(adId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ads', 'campaign', id] }),
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-[#8B8BA0]">Campaign not found.</p>
        <a href="/campaigns" className="mt-4 inline-block">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-1.5" />Back to Campaigns</Button>
        </a>
      </div>
    )
  }

  const isProcessing = campaign.status === 'scraping' || campaign.status === 'pending'

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <a href="/campaigns">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </a>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-[#F4F4F5] truncate">
              {campaign.brandName || campaign.url}
            </h1>
            <Badge variant={STATUS_VARIANTS[campaign.status] ?? 'outline'}>
              {isProcessing && <RefreshCw className="w-3 h-3 animate-spin" />}
              {campaign.status}
            </Badge>
          </div>
          <a
            href={campaign.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#8B8BA0] hover:text-[#A78BFA] flex items-center gap-1 transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            {campaign.url}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Processing state */}
      {isProcessing && (
        <Card>
          <CardContent className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#1A1033] flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-[#A78BFA] animate-spin" />
            </div>
            <h3 className="font-semibold text-[#F4F4F5] mb-2">
              {campaign.status === 'scraping' ? 'Scraping your website...' : 'Preparing campaign...'}
            </h3>
            <p className="text-sm text-[#8B8BA0]">
              Scraping your website and generating 14 ads per day across 8 platforms. This usually takes 30–60 seconds.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scraped data */}
      {campaign.scrapedData && !isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brand Intelligence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {campaign.scrapedData.headlines.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[#8B8BA0] mb-2 uppercase tracking-wide">Headlines</p>
                  <div className="flex flex-wrap gap-1.5">
                    {campaign.scrapedData.headlines.slice(0, 5).map((h, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-[#1A1033] text-[#A78BFA] text-xs">{h}</span>
                    ))}
                  </div>
                </div>
              )}
              {campaign.scrapedData.features.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[#8B8BA0] mb-2 uppercase tracking-wide">Features</p>
                  <div className="flex flex-wrap gap-1.5">
                    {campaign.scrapedData.features.slice(0, 5).map((f, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs">{f}</span>
                    ))}
                  </div>
                </div>
              )}
              {campaign.scrapedData.pricing.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[#8B8BA0] mb-2 uppercase tracking-wide">Pricing</p>
                  <div className="flex flex-wrap gap-1.5">
                    {campaign.scrapedData.pricing.slice(0, 5).map((p, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-xs">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {campaign.scrapedData.ctas.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[#8B8BA0] mb-2 uppercase tracking-wide">CTAs</p>
                  <div className="flex flex-wrap gap-1.5">
                    {campaign.scrapedData.ctas.slice(0, 5).map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-[#1A1A24] text-[#F4F4F5] text-xs">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {campaign.scrapedData.tone && (
              <div className="flex items-center gap-2 pt-2 border-t border-[#1A1A24]">
                <span className="text-xs text-[#8B8BA0]">Tone:</span>
                <span className="text-xs text-[#F4F4F5] capitalize">{campaign.scrapedData.tone}</span>
                {campaign.scrapedData.brandColors.length > 0 && (
                  <div className="flex gap-1 ml-4">
                    {campaign.scrapedData.brandColors.slice(0, 5).map((color, i) => (
                      <div
                        key={i}
                        className="w-4 h-4 rounded-full border border-[#1A1A24]"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ads grid */}
      {!isProcessing && (
        <div>
          <h2 className="text-lg font-semibold text-[#F4F4F5] mb-4">
            Generated Ads {ads && <span className="text-[#8B8BA0] font-normal text-base">({ads.length})</span>}
          </h2>

          {loadingAds ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
            </div>
          ) : !ads || ads.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-[#8B8BA0]">No ads generated yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ads.map((ad, i) => (
                <motion.div
                  key={ad.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="flex flex-col">
                    <CardContent className="p-4 flex flex-col h-full">
                      {/* Platform + format */}
                      <div className="flex items-center gap-2 mb-3">
                        <Badge
                          className="capitalize"
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
                          <Badge variant={STATUS_VARIANTS[ad.status] ?? 'outline'}>{ad.status}</Badge>
                        </div>
                      </div>

                      {/* Headline */}
                      <h4 className="font-semibold text-[#F4F4F5] text-sm mb-2 leading-snug">{ad.headline}</h4>

                      {/* Body */}
                      <p className="text-xs text-[#8B8BA0] leading-relaxed mb-3 flex-1 line-clamp-3">{ad.body}</p>

                      {/* CTA */}
                      {ad.cta && (
                        <div className="mb-3">
                          <span className="text-xs font-medium text-[#7C3AED] bg-[#1A1033] px-2 py-0.5 rounded-md">
                            {ad.cta}
                          </span>
                        </div>
                      )}

                      {/* Hashtags */}
                      {ad.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {ad.hashtags.slice(0, 4).map((tag, j) => (
                            <span key={j} className="flex items-center gap-0.5 text-[10px] text-[#8B8BA0]">
                              <Hash className="w-2.5 h-2.5" />{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Approve / Reject buttons */}
                      {(ad.status === 'ready' || ad.status === 'pending') && (
                        <div className="flex gap-2 pt-3 border-t border-[#1A1A24]">
                          <Button
                            size="sm"
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            loading={approveMutation.isPending && approveMutation.variables === ad.id}
                            onClick={() => approveMutation.mutate(ad.id)}
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1"
                            loading={rejectMutation.isPending && rejectMutation.variables === ad.id}
                            onClick={() => rejectMutation.mutate(ad.id)}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                          </Button>
                        </div>
                      )}

                      {ad.status === 'approved' && (
                        <div className="pt-3 border-t border-[#1A1A24] text-center">
                          <span className="text-xs text-emerald-400 flex items-center justify-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />Approved
                          </span>
                        </div>
                      )}

                      {ad.status === 'rejected' && (
                        <div className="pt-3 border-t border-[#1A1A24] text-center">
                          <span className="text-xs text-red-400 flex items-center justify-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />Rejected
                          </span>
                        </div>
                      )}

                      {ad.status === 'posted' && (
                        <div className="pt-3 border-t border-[#1A1A24] text-center">
                          <span className="text-xs text-[#8B8BA0]">Posted</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
