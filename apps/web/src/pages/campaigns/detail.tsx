import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'wouter'
import { ArrowLeft, Play, Pause, Archive, Zap } from 'lucide-react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'

const STATUS_COLORS: Record<string, 'success' | 'secondary' | 'warning' | 'outline' | 'destructive'> = {
  active: 'success', draft: 'secondary', paused: 'warning', completed: 'outline', archived: 'destructive',
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { workspace } = useWorkspace()
  const wid = workspace?.id ?? ''
  const qc = useQueryClient()

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.campaigns.get(wid, id),
    enabled: !!wid && !!id,
  })

  const { data: ads, isLoading: loadingAds } = useQuery({
    queryKey: ['ads', wid, 'campaign', id],
    queryFn: () => api.ads.list(wid, { campaignId: id }),
    enabled: !!wid && !!id,
  })

  const { data: trends } = useQuery({
    queryKey: ['analytics', 'trends', wid, 'campaign', id],
    queryFn: () => api.analytics.trends(wid, { from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] }),
    enabled: !!wid && !!id,
  })

  const generateMutation = useMutation({
    mutationFn: () => api.campaigns.generate(wid, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ads', wid] }),
  })

  if (isLoading) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>
  if (!campaign) return <div className="p-6 text-muted-foreground">Campaign not found.</div>

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/campaigns"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <Badge variant={STATUS_COLORS[campaign.status]}>{campaign.status}</Badge>
          </div>
          <p className="text-muted-foreground text-sm capitalize mt-0.5">{campaign.objective?.replace(/_/g, ' ')} · {campaign.platforms?.join(', ')}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => generateMutation.mutate()} loading={generateMutation.isPending}>
            <Zap className="w-4 h-4 mr-1.5" />Generate More
          </Button>
          {campaign.status === 'active'
            ? <Button size="sm" variant="outline"><Pause className="w-4 h-4 mr-1.5" />Pause</Button>
            : <Button size="sm"><Play className="w-4 h-4 mr-1.5" />Activate</Button>
          }
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ads">Ads ({ads?.total ?? 0})</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Ads', value: formatNumber(ads?.total ?? 0) },
              { label: 'Budget', value: campaign.budget ? formatCurrency(Number(campaign.budget)) : '—' },
              { label: 'Duration', value: campaign.startDate ? `${new Date(campaign.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} →` : 'Ongoing' },
            ].map(m => (
              <Card key={m.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-xl font-bold mt-1">{m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {campaign.brief && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Campaign Brief</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Product: </span>{campaign.brief.productName}</div>
                <div><span className="text-muted-foreground">Description: </span>{campaign.brief.productDescription}</div>
                <div><span className="text-muted-foreground">CTA: </span>{campaign.brief.callToAction}</div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ads" className="mt-4">
          {loadingAds ? (
            <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
              {ads?.data?.map((ad: { id: string; thumbnailUrl?: string; headline: string; format: string; status: string }) => (
                <div key={ad.id} className="rounded-lg overflow-hidden border border-border bg-card hover:border-primary/50 transition-colors">
                  <div className="aspect-square bg-accent flex items-center justify-center overflow-hidden">
                    {ad.thumbnailUrl
                      ? <img src={ad.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="text-xs text-muted-foreground text-center p-2">{ad.format.replace(/_/g, ' ')}</div>
                    }
                  </div>
                  <div className="p-2">
                    <p className="text-xs truncate">{ad.headline}</p>
                    <Badge variant={ad.status === 'ready' ? 'success' : 'secondary'} className="text-xs mt-1">{ad.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">30-Day Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trends ?? []}>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8B8BA0' }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: '#8B8BA0' }} />
                  <Tooltip contentStyle={{ background: '#111116', border: '1px solid #1A1A24', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="impressions" stroke="#7C3AED" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="clicks" stroke="#60A5FA" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
