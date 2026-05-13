import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Copy, Trash2, Plus, Check } from 'lucide-react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { useCurrentUser } from '@/lib/hooks/use-auth'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'

const profileSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
})

const workspaceSchema = z.object({
  name: z.string().min(1),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  industry: z.string().optional(),
  targetAudience: z.string().optional(),
})

const PLANS = [
  { id: 'free', name: 'Free', price: '$0/mo', adsPerDay: 3, features: ['3 ads/day', '2 platforms', 'Basic analytics'] },
  { id: 'starter', name: 'Starter', price: '$49/mo', adsPerDay: 7, features: ['7 ads/day', '5 platforms', 'A/B testing', 'Analytics'] },
  { id: 'growth', name: 'Growth', price: '$99/mo', adsPerDay: 14, features: ['14 ads/day', 'All platforms', 'Brand voice training', 'Priority generation'] },
  { id: 'scale', name: 'Scale', price: '$249/mo', adsPerDay: 50, features: ['50 ads/day', 'Custom fine-tuning', 'API access', 'Dedicated support'] },
]

export default function SettingsPage() {
  const { workspace } = useWorkspace()
  const wid = workspace?.id ?? ''
  const qc = useQueryClient()
  const { data: user } = useCurrentUser()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    values: { name: user?.name ?? '', email: user?.email ?? '' },
  })

  const wsForm = useForm({
    resolver: zodResolver(workspaceSchema),
    values: {
      name: workspace?.name ?? '',
      websiteUrl: workspace?.websiteUrl ?? '',
      industry: workspace?.industry ?? '',
      targetAudience: workspace?.targetAudience ?? '',
    },
  })

  const { data: apiKeys } = useQuery({
    queryKey: ['api-keys', wid],
    queryFn: () => api.auth.listApiKeys(),
    enabled: !!wid,
  })

  const updateProfileMutation = useMutation({
    mutationFn: (data: { name: string; email: string }) => api.auth.updateProfile(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })

  const updateWorkspaceMutation = useMutation({
    mutationFn: (data: { name: string; websiteUrl?: string; industry?: string; targetAudience?: string }) =>
      api.workspaces.update(wid, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace', wid] }),
  })

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => api.auth.createApiKey({ name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  const deleteKeyMutation = useMutation({
    mutationFn: (id: string) => api.auth.deleteApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your account and workspace preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={profileForm.handleSubmit(d => updateProfileMutation.mutate(d))} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <Input {...profileForm.register('name')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" {...profileForm.register('email')} />
                </div>
                <Separator />
                <div className="space-y-1.5">
                  <Label>New password</Label>
                  <Input type="password" placeholder="Leave blank to keep current" />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm new password</Label>
                  <Input type="password" placeholder="••••••••" />
                </div>
                <Button type="submit" loading={updateProfileMutation.isPending}>Save changes</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspace" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace</CardTitle>
              <CardDescription>Configure your workspace details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={wsForm.handleSubmit(d => updateWorkspaceMutation.mutate(d))} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Workspace name</Label>
                  <Input {...wsForm.register('name')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Website URL</Label>
                  <Input type="url" placeholder="https://yourcompany.com" {...wsForm.register('websiteUrl')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Industry</Label>
                  <Input placeholder="e.g. SaaS, Ecommerce, Health & Wellness" {...wsForm.register('industry')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Target audience</Label>
                  <Textarea rows={2} placeholder="Describe your ideal customer..." {...wsForm.register('targetAudience')} />
                </div>
                <Button type="submit" loading={updateWorkspaceMutation.isPending}>Save workspace</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-4">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Current Plan</CardTitle>
                <CardDescription>You are on the <strong>{user?.plan ?? 'free'}</strong> plan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-3 rounded-lg bg-accent/50 border border-border">
                  <div>
                    <p className="font-semibold capitalize">{user?.plan ?? 'Free'}</p>
                    <p className="text-xs text-muted-foreground">
                      {PLANS.find(p => p.id === user?.plan)?.adsPerDay ?? 3} ads per day
                    </p>
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>
              </CardContent>
            </Card>

            <div className="grid sm:grid-cols-2 gap-3">
              {PLANS.map(plan => (
                <motion.div key={plan.id} whileHover={{ scale: 1.01 }}>
                  <Card className={`cursor-pointer transition-colors ${user?.plan === plan.id ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/30'}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{plan.name}</h3>
                        <span className="text-sm font-medium">{plan.price}</span>
                      </div>
                      <ul className="space-y-1">
                        {plan.features.map(f => (
                          <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Check className="w-3 h-3 text-primary" />{f}
                          </li>
                        ))}
                      </ul>
                      {user?.plan !== plan.id && (
                        <Button size="sm" className="w-full" variant={plan.id === 'growth' ? 'default' : 'outline'}>
                          {plan.id === 'free' ? 'Downgrade' : 'Upgrade'}
                        </Button>
                      )}
                      {user?.plan === plan.id && <Badge className="w-full justify-center">Current plan</Badge>}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="api" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">API Keys</CardTitle>
                  <CardDescription>Use API keys to access Viralix programmatically</CardDescription>
                </div>
                <Button size="sm" onClick={() => createKeyMutation.mutate(`Key ${Date.now()}`)} loading={createKeyMutation.isPending}>
                  <Plus className="w-4 h-4 mr-1.5" />New Key
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {apiKeys?.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No API keys yet. Create one to get started.</p>
              )}
              {apiKeys?.map((key: { id: string; name: string; keyPreview: string; lastUsedAt?: string; createdAt: string }) => (
                <div key={key.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{key.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{key.keyPreview}••••••••</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {key.lastUsedAt ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : 'Never used'} · Created {new Date(key.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => copyKey(key.keyPreview)}>
                      {copiedKey === key.keyPreview ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteKeyMutation.mutate(key.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
