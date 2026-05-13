import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'wouter'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, ChevronLeft, Rocket, Target, Calendar, FileText } from 'lucide-react'
import type { Platform, CampaignObjective } from '@viralix/types'
import { campaigns } from '../../lib/api'
import { useWorkspace } from '../../lib/hooks/use-workspace'
import { useToast } from '../ui/toast'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { cn } from '../../lib/utils'

const OBJECTIVES: { value: CampaignObjective; label: string; description: string }[] = [
  { value: 'awareness', label: 'Brand Awareness', description: 'Reach new audiences' },
  { value: 'traffic', label: 'Traffic', description: 'Drive website visits' },
  { value: 'engagement', label: 'Engagement', description: 'Likes, shares, comments' },
  { value: 'leads', label: 'Lead Generation', description: 'Collect contact info' },
  { value: 'conversions', label: 'Conversions', description: 'Sales and sign-ups' },
  { value: 'sales', label: 'Sales', description: 'Direct purchase intent' },
]

const PLATFORMS: { value: Platform; label: string; color: string }[] = [
  { value: 'instagram', label: 'Instagram', color: '#E1306C' },
  { value: 'facebook', label: 'Facebook', color: '#1877F2' },
  { value: 'tiktok', label: 'TikTok', color: '#FF0050' },
  { value: 'linkedin', label: 'LinkedIn', color: '#0A66C2' },
  { value: 'twitter', label: 'Twitter / X', color: '#1DA1F2' },
  { value: 'youtube', label: 'YouTube', color: '#FF0000' },
]

const step1Schema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  objective: z.string().min(1, 'Select an objective'),
  platforms: z.array(z.string()).min(1, 'Select at least one platform'),
})

const step2Schema = z.object({
  productName: z.string().min(1, 'Product name is required'),
  productDescription: z.string().min(10, 'Describe your product (min 10 chars)'),
  callToAction: z.string().min(1, 'CTA is required'),
  targetAudience: z.string().min(1, 'Describe your audience'),
  additionalNotes: z.string().optional(),
})

const step3Schema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.string().optional(),
})

type Step1 = z.infer<typeof step1Schema>
type Step2 = z.infer<typeof step2Schema>
type Step3 = z.infer<typeof step3Schema>

interface WizardData {
  step1?: Step1
  step2?: Step2
  step3?: Step3
}

const STEPS = [
  { label: 'Basics', icon: <Target className="h-4 w-4" /> },
  { label: 'Brief', icon: <FileText className="h-4 w-4" /> },
  { label: 'Schedule', icon: <Calendar className="h-4 w-4" /> },
  { label: 'Review', icon: <Rocket className="h-4 w-4" /> },
]

export function CampaignWizard() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardData>({})
  const { workspace } = useWorkspace()
  const { toast } = useToast()
  const [, navigate] = useLocation()
  const qc = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!workspace || !data.step1) throw new Error('Missing data')
      const campaign = await campaigns.create(workspace.id, {
        name: data.step1.name,
        objective: data.step1.objective as CampaignObjective,
        platforms: data.step1.platforms as Platform[],
        budget: data.step3?.budget ? parseFloat(data.step3.budget) : undefined,
        startDate: data.step3?.startDate,
        endDate: data.step3?.endDate,
      })
      if (data.step2) {
        await campaigns.upsertBrief(workspace.id, campaign.id, {
          productName: data.step2.productName,
          productDescription: data.step2.productDescription,
          callToAction: data.step2.callToAction,
          targetAudience: data.step2.targetAudience,
          additionalNotes: data.step2.additionalNotes,
        })
      }
      return campaign
    },
    onSuccess: (campaign) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast({ title: 'Campaign created!', variant: 'success' })
      navigate(`/campaigns/${campaign.id}`)
    },
    onError: (e) => {
      toast({ title: 'Failed to create campaign', description: (e as Error).message, variant: 'error' })
    },
  })

  const form1 = useForm<Step1>({
    resolver: zodResolver(step1Schema),
    defaultValues: data.step1 ?? { name: '', objective: '', platforms: [] },
  })

  const form2 = useForm<Step2>({
    resolver: zodResolver(step2Schema),
    defaultValues: data.step2 ?? { productName: '', productDescription: '', callToAction: '', targetAudience: '' },
  })

  const form3 = useForm<Step3>({
    resolver: zodResolver(step3Schema),
    defaultValues: data.step3 ?? {},
  })

  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction < 0 ? 40 : -40, opacity: 0 }),
  }

  const [direction, setDirection] = useState(1)

  const goNext = () => { setDirection(1); setStep((s) => s + 1) }
  const goPrev = () => { setDirection(-1); setStep((s) => s - 1) }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                'flex items-center gap-2 transition-all',
                i <= step ? 'opacity-100' : 'opacity-40',
              )}
            >
              <div
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center transition-all',
                  i < step
                    ? 'bg-[hsl(var(--primary))] text-white'
                    : i === step
                    ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] ring-2 ring-[hsl(var(--primary))]'
                    : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]',
                )}
              >
                {i < step ? <Check className="h-4 w-4" /> : s.icon}
              </div>
              <span className={cn('text-sm font-medium hidden sm:block', i === step ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]')}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('flex-1 h-px mx-3', i < step ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--border))]')} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          {step === 0 && (
            <motion.div key="step0" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <h2 className="text-lg font-semibold mb-4">Campaign Basics</h2>
              <form onSubmit={form1.handleSubmit((d) => { setData((p) => ({ ...p, step1: d })); goNext() })} className="space-y-4">
                <div>
                  <Label>Campaign Name</Label>
                  <Input {...form1.register('name')} placeholder="e.g. Summer Sale 2025" className="mt-1.5" />
                  {form1.formState.errors.name && (
                    <p className="text-xs text-[hsl(var(--destructive))] mt-1">{form1.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <Label className="mb-2 block">Objective</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {OBJECTIVES.map((obj) => {
                      const val = form1.watch('objective')
                      return (
                        <button
                          key={obj.value}
                          type="button"
                          onClick={() => form1.setValue('objective', obj.value)}
                          className={cn(
                            'rounded-lg border p-3 text-left transition-all',
                            val === obj.value
                              ? 'border-[hsl(var(--primary))] bg-[hsl(var(--accent))]'
                              : 'border-[hsl(var(--border))] hover:border-[hsl(262,83%,58%,0.4)]',
                          )}
                        >
                          <p className="text-sm font-semibold">{obj.label}</p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">{obj.description}</p>
                        </button>
                      )
                    })}
                  </div>
                  {form1.formState.errors.objective && (
                    <p className="text-xs text-[hsl(var(--destructive))] mt-1">{form1.formState.errors.objective.message}</p>
                  )}
                </div>
                <div>
                  <Label className="mb-2 block">Platforms</Label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((p) => {
                      const selected = form1.watch('platforms') ?? []
                      const isSelected = selected.includes(p.value)
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => {
                            const cur = form1.getValues('platforms') ?? []
                            form1.setValue('platforms', isSelected ? cur.filter((x) => x !== p.value) : [...cur, p.value])
                          }}
                          className={cn(
                            'px-3 py-1.5 rounded-full border text-xs font-semibold transition-all',
                            isSelected ? 'border-transparent text-white' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.5)]',
                          )}
                          style={isSelected ? { background: p.color } : {}}
                        >
                          {p.label}
                        </button>
                      )
                    })}
                  </div>
                  {form1.formState.errors.platforms && (
                    <p className="text-xs text-[hsl(var(--destructive))] mt-1">{form1.formState.errors.platforms.message}</p>
                  )}
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit">
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step1" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <h2 className="text-lg font-semibold mb-4">Campaign Brief</h2>
              <form onSubmit={form2.handleSubmit((d) => { setData((p) => ({ ...p, step2: d })); goNext() })} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <Label>Product / Service Name</Label>
                    <Input {...form2.register('productName')} placeholder="e.g. Viralix Pro" className="mt-1.5" />
                    {form2.formState.errors.productName && (
                      <p className="text-xs text-[hsl(var(--destructive))] mt-1">{form2.formState.errors.productName.message}</p>
                    )}
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label>Call to Action</Label>
                    <Input {...form2.register('callToAction')} placeholder="e.g. Start Free Trial" className="mt-1.5" />
                    {form2.formState.errors.callToAction && (
                      <p className="text-xs text-[hsl(var(--destructive))] mt-1">{form2.formState.errors.callToAction.message}</p>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Product Description</Label>
                  <Textarea {...form2.register('productDescription')} placeholder="Describe what your product does and its key benefits..." className="mt-1.5" rows={3} />
                  {form2.formState.errors.productDescription && (
                    <p className="text-xs text-[hsl(var(--destructive))] mt-1">{form2.formState.errors.productDescription.message}</p>
                  )}
                </div>
                <div>
                  <Label>Target Audience</Label>
                  <Textarea {...form2.register('targetAudience')} placeholder="e.g. Marketing managers at SMBs, ages 25-45, interested in automation..." className="mt-1.5" rows={2} />
                  {form2.formState.errors.targetAudience && (
                    <p className="text-xs text-[hsl(var(--destructive))] mt-1">{form2.formState.errors.targetAudience.message}</p>
                  )}
                </div>
                <div>
                  <Label>Additional Notes (optional)</Label>
                  <Textarea {...form2.register('additionalNotes')} placeholder="Any specific messaging, tone preferences, or constraints..." className="mt-1.5" rows={2} />
                </div>
                <div className="flex justify-between pt-2">
                  <Button type="button" variant="outline" onClick={goPrev}>
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button type="submit">
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <h2 className="text-lg font-semibold mb-4">Schedule & Budget</h2>
              <form onSubmit={form3.handleSubmit((d) => { setData((p) => ({ ...p, step3: d })); goNext() })} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Date</Label>
                    <Input type="date" {...form3.register('startDate')} className="mt-1.5" />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input type="date" {...form3.register('endDate')} className="mt-1.5" />
                  </div>
                </div>
                <div>
                  <Label>Total Budget (USD)</Label>
                  <Input type="number" {...form3.register('budget')} placeholder="e.g. 5000" className="mt-1.5" />
                </div>
                <div className="flex justify-between pt-2">
                  <Button type="button" variant="outline" onClick={goPrev}>
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button type="submit">
                    Review <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <h2 className="text-lg font-semibold mb-4">Review & Launch</h2>
              <div className="space-y-4">
                {data.step1 && (
                  <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                    <h3 className="text-sm font-semibold mb-2 text-[hsl(var(--muted-foreground))]">Campaign Details</h3>
                    <p className="font-semibold">{data.step1.name}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Objective: {data.step1.objective}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Platforms: {data.step1.platforms.join(', ')}</p>
                  </div>
                )}
                {data.step2 && (
                  <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                    <h3 className="text-sm font-semibold mb-2 text-[hsl(var(--muted-foreground))]">Brief</h3>
                    <p className="font-semibold">{data.step2.productName}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{data.step2.productDescription}</p>
                    <p className="text-sm mt-1"><span className="text-[hsl(var(--muted-foreground))]">CTA:</span> {data.step2.callToAction}</p>
                  </div>
                )}
                {data.step3 && (data.step3.startDate || data.step3.budget) && (
                  <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                    <h3 className="text-sm font-semibold mb-2 text-[hsl(var(--muted-foreground))]">Schedule & Budget</h3>
                    {data.step3.startDate && <p className="text-sm">Start: {data.step3.startDate}</p>}
                    {data.step3.endDate && <p className="text-sm">End: {data.step3.endDate}</p>}
                    {data.step3.budget && <p className="text-sm">Budget: ${data.step3.budget}</p>}
                  </div>
                )}
              </div>
              <div className="flex justify-between pt-6">
                <Button type="button" variant="outline" onClick={goPrev}>
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  loading={createMutation.isPending}
                >
                  <Rocket className="h-4 w-4" />
                  Launch Campaign
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
