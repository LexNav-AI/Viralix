import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Trophy, FlaskConical, Play, Pause, CheckCheck } from 'lucide-react'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatPercent } from '@/lib/utils'

const STATUS_ICONS = {
  draft: FlaskConical,
  running: Play,
  paused: Pause,
  completed: CheckCheck,
}

const METRIC_LABELS: Record<string, string> = {
  ctr: 'Click-Through Rate', conversions: 'Conversions', engagement: 'Engagement', roas: 'Return on Ad Spend',
}

export default function AbTestingPage() {
  const { workspace } = useWorkspace()
  const wid = workspace?.id ?? ''
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [newTest, setNewTest] = useState({ name: '', hypothesis: '', metric: 'ctr' })

  const { data: tests, isLoading } = useQuery({
    queryKey: ['ab-tests', wid],
    queryFn: () => api.abTesting.list(wid),
    enabled: !!wid,
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof newTest) => api.abTesting.create(wid, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ab-tests', wid] }); setShowNew(false) },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.abTesting.updateStatus(wid, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ab-tests', wid] }),
  })

  const winnerMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => api.abTesting.pickWinner(wid, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ab-tests', wid] }),
  })

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">A/B Testing</h1>
          <p className="text-muted-foreground text-sm">Compare ad variants and let data pick the winner</p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-1.5" />New Test
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : tests?.length === 0 ? (
        <div className="text-center py-16">
          <FlaskConical className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <h3 className="font-semibold mb-1">No A/B tests yet</h3>
          <p className="text-muted-foreground text-sm mb-4">Create a test to compare two ad variants and automatically discover the winner.</p>
          <Button onClick={() => setShowNew(true)}><Plus className="w-4 h-4 mr-1.5" />Create first test</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {tests?.map((test: {
            id: string; name: string; status: string; metric: string; hypothesis: string;
            confidenceLevel: string | number; startDate: string | null; endDate: string | null;
            winnerId: string | null;
            variants: Array<{ id: string; adId: string; ad: { headline: string; thumbnailUrl?: string }; avgCtr: number; avgRoas: number; impressions: number }>
          }, i: number) => {
            const StatusIcon = STATUS_ICONS[test.status as keyof typeof STATUS_ICONS] ?? FlaskConical
            const confidence = Number(test.confidenceLevel) * 100
            const winner = test.variants?.find(v => v.id === test.winnerId)

            return (
              <motion.div key={test.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <Card className={test.status === 'completed' ? 'border-emerald-500/30' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{test.name}</h3>
                          <Badge variant={test.status === 'running' ? 'success' : test.status === 'completed' ? 'secondary' : 'outline'}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {test.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{METRIC_LABELS[test.metric]}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{test.hypothesis}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {test.status === 'draft' && (
                          <Button size="sm" onClick={() => statusMutation.mutate({ id: test.id, status: 'running' })}>
                            <Play className="w-4 h-4 mr-1.5" />Start
                          </Button>
                        )}
                        {test.status === 'running' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: test.id, status: 'paused' })}>
                              <Pause className="w-4 h-4 mr-1.5" />Pause
                            </Button>
                            <Button size="sm" onClick={() => winnerMutation.mutate({ id: test.id })}>
                              <Trophy className="w-4 h-4 mr-1.5" />Pick Winner
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {confidence > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Statistical confidence</span>
                          <span className={confidence >= 95 ? 'text-emerald-400' : 'text-muted-foreground'}>{confidence.toFixed(0)}%</span>
                        </div>
                        <Progress value={confidence} className="h-1.5" />
                        {confidence >= 95 && <p className="text-xs text-emerald-400 mt-1">✓ Statistically significant — safe to pick a winner</p>}
                      </div>
                    )}

                    {test.variants && test.variants.length > 0 && (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {test.variants.map((variant, vi) => (
                          <div
                            key={variant.id}
                            className={`p-3 rounded-lg border ${variant.id === test.winnerId ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border bg-accent/30'}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium">Variant {String.fromCharCode(65 + vi)}</span>
                              {variant.id === test.winnerId && (
                                <Badge variant="success" className="text-xs"><Trophy className="w-3 h-3 mr-1" />Winner</Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium truncate mb-2">{variant.ad?.headline}</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">CTR</span>
                                <p className="font-medium">{formatPercent(variant.avgCtr ?? 0)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">ROAS</span>
                                <p className="font-medium">{Number(variant.avgRoas ?? 0).toFixed(2)}x</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New A/B Test</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Test name</Label>
              <Input placeholder="e.g. Headline tone comparison" value={newTest.name} onChange={e => setNewTest(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Hypothesis</Label>
              <Textarea rows={2} placeholder="e.g. Bold, direct headlines will outperform question-based headlines by >10% CTR" value={newTest.hypothesis} onChange={e => setNewTest(p => ({ ...p, hypothesis: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Primary metric</Label>
              <Select value={newTest.metric} onValueChange={v => setNewTest(p => ({ ...p, metric: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METRIC_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button className="flex-1" loading={createMutation.isPending} onClick={() => createMutation.mutate(newTest)}>
                Create Test
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
