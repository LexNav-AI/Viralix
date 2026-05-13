import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'wouter'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft, Check, Rocket } from 'lucide-react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const OBJECTIVES = [
  { value: 'awareness', label: 'Brand Awareness', desc: 'Reach new audiences' },
  { value: 'traffic', label: 'Website Traffic', desc: 'Drive visitors to your site' },
  { value: 'engagement', label: 'Engagement', desc: 'Boost likes, shares, comments' },
  { value: 'leads', label: 'Lead Generation', desc: 'Collect contact info' },
  { value: 'conversions', label: 'Conversions', desc: 'Drive purchases or signups' },
  { value: 'sales', label: 'Sales', desc: 'Increase direct revenue' },
]

const PLATFORMS = ['facebook', 'instagram', 'tiktok', 'linkedin', 'twitter']

const step1Schema = z.object({
  name: z.string().min(2, 'Campaign name required'),
  objective: z.string().min(1, 'Select an objective'),
  platforms: z.array(z.string()).min(1, 'Select at least one platform'),
})

const step2Schema = z.object({
  productName: z.string().min(1, 'Product name required'),
  productDescription: z.string().min(10, 'Describe your product'),
  callToAction: z.string().min(1, 'CTA required'),
  targetAudience: z.string().min(1, 'Describe your audience'),
})

const step3Schema = z.object({
  budget: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

const STEPS = ['Basics', 'Brief', 'Schedule', 'Launch']

export default function NewCampaignPage() {
  const { workspace } = useWorkspace()
  const [, navigate] = useLocation()
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState<Record<string, unknown>>({
    platforms: [],
  })

  const createCampaign = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.campaigns.create(workspace?.id ?? '', data),
    onSuccess: async (campaign: { id: string }) => {
      await api.campaigns.createBrief(workspace?.id ?? '', campaign.id, {
        productName: formData.productName as string,
        productDescription: formData.productDescription as string,
        callToAction: formData.callToAction as string,
        targetDemographics: { audience: formData.targetAudience as string },
      })
      await api.campaigns.generate(workspace?.id ?? '', campaign.id)
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      navigate(`/campaigns/${campaign.id}`)
    },
  })

  const step1Form = useForm({ resolver: zodResolver(step1Schema), defaultValues: { name: '', objective: '', platforms: [] as string[] } })
  const step2Form = useForm({ resolver: zodResolver(step2Schema), defaultValues: { productName: '', productDescription: '', callToAction: 'Shop Now', targetAudience: '' } })
  const step3Form = useForm({ resolver: zodResolver(step3Schema), defaultValues: { budget: '', startDate: '', endDate: '' } })

  const handleStep1 = step1Form.handleSubmit(data => {
    setFormData(prev => ({ ...prev, ...data }))
    setStep(1)
  })

  const handleStep2 = step2Form.handleSubmit(data => {
    setFormData(prev => ({ ...prev, ...data }))
    setStep(2)
  })

  const handleStep3 = step3Form.handleSubmit(data => {
    setFormData(prev => ({ ...prev, ...data }))
    setStep(3)
  })

  const handleLaunch = () => {
    createCampaign.mutate(formData)
  }

  const togglePlatform = (p: string) => {
    const curr = step1Form.getValues('platforms') as string[]
    step1Form.setValue('platforms', curr.includes(p) ? curr.filter(x => x !== p) : [...curr, p])
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Campaign</h1>
        <p className="text-muted-foreground text-sm">Set up your AI-powered ad campaign</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              i < step ? 'bg-primary text-white' : i === step ? 'bg-primary/20 text-primary border border-primary' : 'bg-card border border-border text-muted-foreground'
            }`}>
              {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`text-xs ${i === step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader>
                <CardTitle>Campaign basics</CardTitle>
                <CardDescription>Name your campaign and choose your goal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label>Campaign name</Label>
                  <Input placeholder="e.g. Summer Sale 2026" {...step1Form.register('name')} />
                  {step1Form.formState.errors.name && <p className="text-destructive text-xs">{step1Form.formState.errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Objective</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {OBJECTIVES.map(o => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => step1Form.setValue('objective', o.value)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          step1Form.watch('objective') === o.value
                            ? 'border-primary bg-accent'
                            : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <p className="text-sm font-medium">{o.label}</p>
                        <p className="text-xs text-muted-foreground">{o.desc}</p>
                      </button>
                    ))}
                  </div>
                  {step1Form.formState.errors.objective && <p className="text-destructive text-xs">{step1Form.formState.errors.objective.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Platforms</Label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePlatform(p)}
                        className={`px-3 py-1.5 rounded-full border text-xs capitalize transition-colors ${
                          (step1Form.watch('platforms') as string[]).includes(p)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/40'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  {step1Form.formState.errors.platforms && <p className="text-destructive text-xs">Select at least one platform</p>}
                </div>
                <Button onClick={handleStep1} className="w-full">
                  Continue <ChevronRight className="w-4 h-4 ml-1.5" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader>
                <CardTitle>Campaign brief</CardTitle>
                <CardDescription>Tell the AI what you&apos;re promoting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Product / service name</Label>
                  <Input placeholder="e.g. AcmePro Software" {...step2Form.register('productName')} />
                  {step2Form.formState.errors.productName && <p className="text-destructive text-xs">{step2Form.formState.errors.productName.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea rows={3} placeholder="What does it do? What problem does it solve?" {...step2Form.register('productDescription')} />
                  {step2Form.formState.errors.productDescription && <p className="text-destructive text-xs">{step2Form.formState.errors.productDescription.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Call to action</Label>
                  <Input placeholder="e.g. Shop Now, Get Started, Learn More" {...step2Form.register('callToAction')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Target audience</Label>
                  <Textarea rows={2} placeholder="Who are you targeting? e.g. small business owners aged 30-50..." {...step2Form.register('targetAudience')} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(0)}><ChevronLeft className="w-4 h-4 mr-1.5" />Back</Button>
                  <Button className="flex-1" onClick={handleStep2}>Continue <ChevronRight className="w-4 h-4 ml-1.5" /></Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader>
                <CardTitle>Schedule & budget</CardTitle>
                <CardDescription>Optional — set dates and spending limits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Start date</Label>
                    <Input type="date" {...step3Form.register('startDate')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End date</Label>
                    <Input type="date" {...step3Form.register('endDate')} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Total budget (USD, optional)</Label>
                  <Input type="number" placeholder="e.g. 500" {...step3Form.register('budget')} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-1.5" />Back</Button>
                  <Button className="flex-1" onClick={handleStep3}>Review <ChevronRight className="w-4 h-4 ml-1.5" /></Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader>
                <CardTitle>Ready to launch</CardTitle>
                <CardDescription>Viralix will generate 14 ads and start learning immediately</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-accent/50 border border-border space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Campaign</span><span className="font-medium">{formData.name as string}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Objective</span><span className="capitalize">{(formData.objective as string)?.replace(/_/g, ' ')}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Platforms</span><span>{(formData.platforms as string[])?.join(', ')}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Product</span><span>{formData.productName as string}</span></div>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm text-primary">
                  🚀 After launch, Viralix will immediately begin generating 14 ads across all selected platforms and formats.
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}><ChevronLeft className="w-4 h-4 mr-1.5" />Back</Button>
                  <Button className="flex-1" onClick={handleLaunch} loading={createCampaign.isPending}>
                    <Rocket className="w-4 h-4 mr-1.5" />Launch Campaign
                  </Button>
                </div>
                {createCampaign.error && <p className="text-destructive text-xs text-center">Launch failed — please try again</p>}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
