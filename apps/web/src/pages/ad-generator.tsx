import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, CheckCircle2, Loader2, Image, Video, Volume2, Film, Download, RefreshCw } from 'lucide-react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import AdPreview from '@/components/ads/ad-preview'

const FORMATS = [
  { value: 'static_image', label: 'Static Image', icon: Image, desc: '1080×1080' },
  { value: 'story', label: 'Story', icon: Image, desc: '1080×1920' },
  { value: 'video', label: 'Video', icon: Video, desc: '15-30s' },
  { value: 'reel', label: 'Reel', icon: Film, desc: '9:16 vertical' },
  { value: 'carousel', label: 'Carousel', icon: Image, desc: 'Multi-image' },
  { value: 'banner_300x250', label: 'Banner 300×250', icon: Image, desc: 'Rectangle' },
  { value: 'banner_728x90', label: 'Banner 728×90', icon: Image, desc: 'Leaderboard' },
]

const PLATFORMS = ['facebook', 'instagram', 'tiktok', 'linkedin', 'twitter', 'universal']

const GENERATION_STEPS = [
  { id: 'copy', label: 'Writing ad copy', icon: Zap },
  { id: 'image', label: 'Generating image', icon: Image },
  { id: 'audio', label: 'Creating voiceover', icon: Volume2 },
  { id: 'video', label: 'Assembling video', icon: Film },
  { id: 'complete', label: 'Ready!', icon: CheckCircle2 },
]

const schema = z.object({
  format: z.string().min(1),
  platform: z.string().min(1),
  productName: z.string().min(1, 'Product name required'),
  productDescription: z.string().min(10, 'Describe your product'),
  callToAction: z.string().min(1),
  targetAudience: z.string().min(1),
})
type FormData = z.infer<typeof schema>

type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

interface GenerationResult {
  id: string
  headline: string
  bodyText: string
  ctaText: string
  imageUrl?: string
  videoUrl?: string
  format: string
  platform: string
}

export default function AdGeneratorPage() {
  const { workspace } = useWorkspace()
  const wid = workspace?.id ?? ''
  const [jobId, setJobId] = useState<string | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [activeStep, setActiveStep] = useState(0)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { format: 'static_image', platform: 'instagram', callToAction: 'Shop Now' },
  })

  const generateMutation = useMutation({
    mutationFn: (data: FormData) => api.ads.generate(wid, {
      format: data.format,
      platform: data.platform,
      brief: {
        productName: data.productName,
        productDescription: data.productDescription,
        callToAction: data.callToAction,
        targetAudience: data.targetAudience,
      },
    }),
    onSuccess: (res: { jobId: string }) => {
      setJobId(res.jobId)
      setActiveStep(0)
      pollJob(res.jobId)
    },
  })

  const pollJob = (id: string) => {
    let step = 0
    const interval = setInterval(async () => {
      try {
        const status: { status: JobStatus; result?: GenerationResult } = await api.ads.jobStatus(wid, id)
        step = Math.min(step + 1, GENERATION_STEPS.length - 2)
        setActiveStep(step)
        if (status.status === 'completed' && status.result) {
          clearInterval(interval)
          setActiveStep(GENERATION_STEPS.length - 1)
          setResult(status.result)
        } else if (status.status === 'failed') {
          clearInterval(interval)
        }
      } catch {
        clearInterval(interval)
      }
    }, 3000)
  }

  const format = watch('format')
  const platform = watch('platform')

  const isGenerating = generateMutation.isPending || (jobId !== null && result === null)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ad Generator</h1>
        <p className="text-muted-foreground text-sm">Generate a single on-demand ad with full AI pipeline</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Ad Format & Platform</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Format</Label>
                <div className="grid grid-cols-2 gap-2">
                  {FORMATS.map(f => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setValue('format', f.value)}
                      className={`p-2.5 rounded-lg border text-left flex items-center gap-2.5 transition-colors ${
                        format === f.value ? 'border-primary bg-accent' : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <f.icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-xs font-medium">{f.label}</p>
                        <p className="text-xs text-muted-foreground">{f.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Platform</Label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setValue('platform', p)}
                      className={`px-3 py-1 rounded-full border text-xs capitalize transition-colors ${
                        platform === p ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Product Brief</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Product name</Label>
                <Input placeholder="AcmePro Software" {...register('productName')} />
                {errors.productName && <p className="text-destructive text-xs">{errors.productName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={3} placeholder="What does it do? What problem does it solve?" {...register('productDescription')} />
                {errors.productDescription && <p className="text-destructive text-xs">{errors.productDescription.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Call to action</Label>
                  <Input placeholder="Shop Now" {...register('callToAction')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Target audience</Label>
                  <Input placeholder="SMB owners 30-50" {...register('targetAudience')} />
                </div>
              </div>
              <Button className="w-full" onClick={handleSubmit(d => generateMutation.mutate(d))} disabled={isGenerating} size="lg">
                {isGenerating
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                  : <><Zap className="w-4 h-4 mr-2" />Generate Ad</>
                }
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview / Progress */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {!jobId && !result && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card className="h-full min-h-80">
                  <CardContent className="flex flex-col items-center justify-center h-full min-h-80 text-center">
                    <div className="p-4 rounded-full bg-accent mb-4">
                      <Zap className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Your ad will appear here</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Fill in the form and click Generate to create an AI-powered ad using Llama 3, Stable Diffusion XL, and Kokoro TTS.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {isGenerating && (
              <motion.div key="generating" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Generating your ad...</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Progress value={((activeStep + 1) / GENERATION_STEPS.length) * 100} className="h-2" />
                    <div className="space-y-2">
                      {GENERATION_STEPS.map((step, i) => (
                        <div key={step.id} className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                          i === activeStep ? 'bg-accent' : i < activeStep ? 'opacity-50' : 'opacity-30'
                        }`}>
                          {i < activeStep
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            : i === activeStep
                              ? <Loader2 className="w-4 h-4 text-primary animate-spin" />
                              : <step.icon className="w-4 h-4 text-muted-foreground" />
                          }
                          <span className={`text-sm ${i === activeStep ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      This typically takes 30–120 seconds depending on format
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {result && !isGenerating && (
              <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="font-semibold text-sm">Ad Ready!</span>
                    <Badge variant="success">Completed</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setResult(null); setJobId(null) }}>
                      <RefreshCw className="w-4 h-4 mr-1.5" />Regenerate
                    </Button>
                    {(result.imageUrl || result.videoUrl) && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={result.imageUrl ?? result.videoUrl} download>
                          <Download className="w-4 h-4 mr-1.5" />Download
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Headline</p>
                      <p className="font-semibold">{result.headline}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Body</p>
                      <p className="text-sm">{result.bodyText}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">CTA</p>
                      <Badge>{result.ctaText}</Badge>
                    </div>
                  </CardContent>
                </Card>

                <AdPreview
                  ad={{
                    headline: result.headline,
                    bodyText: result.bodyText,
                    ctaText: result.ctaText,
                    imageUrl: result.imageUrl,
                    videoUrl: result.videoUrl,
                    format: result.format,
                    platform: result.platform,
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
