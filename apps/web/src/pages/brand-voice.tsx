import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Wand2, RotateCcw, Check, Upload } from 'lucide-react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import VoiceSetup from '@/components/brand-voice/voice-setup'

export default function BrandVoicePage() {
  const { workspace } = useWorkspace()
  const wid = workspace?.id ?? ''
  const qc = useQueryClient()
  const [previewCopy, setPreviewCopy] = useState<{ headline: string; body: string; cta: string } | null>(null)

  const { data: voice, isLoading } = useQuery({
    queryKey: ['brand-voice', wid],
    queryFn: () => api.brands.getVoice(wid),
    enabled: !!wid,
  })

  const { data: assets, isLoading: loadingAssets } = useQuery({
    queryKey: ['brand-assets', wid],
    queryFn: () => api.brands.listAssets(wid),
    enabled: !!wid,
  })

  const { data: voiceStatus } = useQuery({
    queryKey: ['brand-voice-status', wid],
    queryFn: () => api.brands.voiceStatus(wid),
    enabled: !!wid,
    refetchInterval: (data: unknown) => {
      const d = data as { status?: string } | undefined
      return d?.status === 'running' ? 5000 : false
    },
  })

  const trainMutation = useMutation({
    mutationFn: () => api.brands.trainVoice(wid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brand-voice-status', wid] }),
  })

  const generatePreviewMutation = useMutation({
    mutationFn: () => api.ads.generate(wid, {
      format: 'static_image',
      platform: 'instagram',
      brief: {
        productName: 'Your Product',
        productDescription: 'A great product that solves real problems',
        callToAction: voice?.tone === 'bold' ? 'Get It Now' : 'Learn More',
        targetAudience: 'General audience',
      },
    }),
    onSuccess: (res: { result?: { headline: string; bodyText: string; ctaText: string } }) => {
      if (res.result) {
        setPreviewCopy({ headline: res.result.headline, body: res.result.bodyText, cta: res.result.ctaText })
      }
    },
  })

  const isTraining = voiceStatus?.status === 'running'

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Brand Voice</h1>
          <p className="text-muted-foreground text-sm">Train the AI to write in your brand&apos;s unique style</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => generatePreviewMutation.mutate()} loading={generatePreviewMutation.isPending}>
            <RotateCcw className="w-4 h-4 mr-1.5" />Preview Copy
          </Button>
          <Button size="sm" onClick={() => trainMutation.mutate()} loading={trainMutation.isPending} disabled={isTraining}>
            <Wand2 className="w-4 h-4 mr-1.5" />
            {isTraining ? 'Training...' : 'Train Model'}
          </Button>
        </div>
      </div>

      {isTraining && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 rounded-full bg-primary/20">
                <Wand2 className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Brand voice model training in progress</p>
                <p className="text-xs text-muted-foreground">This typically takes 20–40 minutes. Your ads will use the new model automatically when complete.</p>
                <Progress value={voiceStatus?.progress ?? 30} className="mt-2 h-1" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Voice setup form */}
        <div className="space-y-4">
          {isLoading ? <Skeleton className="h-96 rounded-xl" /> : <VoiceSetup workspaceId={wid} initialData={voice} />}

          {/* Brand assets */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Brand Assets</CardTitle>
              <CardDescription className="text-xs">Upload logos, fonts, color guides, and sample content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingAssets ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}</div>
              ) : assets?.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-border rounded-lg">
                  <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">No assets uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {assets?.map((asset: { id: string; name: string; type: string; fileSize: number }) => (
                    <div key={asset.id} className="flex items-center gap-3 p-2 rounded-lg bg-accent/50">
                      <Badge variant="secondary" className="text-xs capitalize">{asset.type}</Badge>
                      <span className="text-sm flex-1 truncate">{asset.name}</span>
                      <span className="text-xs text-muted-foreground">{(asset.fileSize / 1024).toFixed(0)}KB</span>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full" asChild>
                <label className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-1.5" />Upload Asset
                  <input type="file" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const fd = new FormData()
                    fd.append('file', file)
                    await api.brands.uploadAsset(wid, fd)
                    qc.invalidateQueries({ queryKey: ['brand-assets', wid] })
                  }} />
                </label>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Live preview */}
        <div>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Live Copy Preview</CardTitle>
              <CardDescription className="text-xs">See how the AI writes in your voice</CardDescription>
            </CardHeader>
            <CardContent>
              {generatePreviewMutation.isPending ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ) : previewCopy ? (
                <motion.div key={previewCopy.headline} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="p-4 rounded-xl bg-accent border border-border space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">HEADLINE</p>
                      <p className="font-bold text-lg leading-tight">{previewCopy.headline}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">BODY COPY</p>
                      <p className="text-sm leading-relaxed">{previewCopy.body}</p>
                    </div>
                    <div className="pt-1">
                      <button className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium">
                        {previewCopy.cta}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    Generated using your brand voice settings
                  </div>
                </motion.div>
              ) : (
                <div className="text-center py-12">
                  <Wand2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground mb-3">Configure your brand voice and click Preview Copy to see how Viralix writes for your brand.</p>
                  <Button variant="outline" size="sm" onClick={() => generatePreviewMutation.mutate()}>
                    Generate Preview
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
