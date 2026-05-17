import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Calendar, Clock, X, CheckCircle, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { ScheduledPost } from '@/lib/api'

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  scheduled: 'default',
  posted: 'success',
  failed: 'destructive',
  cancelled: 'outline',
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

function formatDay(dateStr: string) {
  const date = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function groupByDay(posts: ScheduledPost[]) {
  const groups = new Map<string, ScheduledPost[]>()
  const sorted = [...posts].sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())

  for (const post of sorted) {
    const day = new Date(post.scheduledTime).toDateString()
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day)!.push(post)
  }

  return Array.from(groups.entries()).map(([day, items]) => ({ day, items }))
}

export default function Schedule() {
  const qc = useQueryClient()

  const { data: posts, isLoading } = useQuery({
    queryKey: ['schedule'],
    queryFn: api.schedule.list,
    refetchInterval: 30_000,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.schedule.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  })

  const grouped = groupByDay(posts ?? [])

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F4F5]">Schedule</h1>
          <p className="text-sm text-[#8B8BA0]">
            {posts?.filter(p => p.status === 'scheduled').length ?? 0} posts scheduled
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-32" />
              {Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-20" />)}
            </div>
          ))}
        </div>
      ) : !posts || posts.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-[#1A1033] flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7 text-[#A78BFA]" />
          </div>
          <h3 className="font-semibold text-[#F4F4F5] mb-2">No scheduled posts</h3>
          <p className="text-sm text-[#8B8BA0] max-w-sm mx-auto mb-6">
            Approve ads in your campaigns to schedule them for publishing across platforms.
          </p>
          <a href="/campaigns">
            <Button>Go to Campaigns</Button>
          </a>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ day, items }, groupIdx) => (
            <motion.div
              key={day}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: groupIdx * 0.08 }}
            >
              {/* Day header */}
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-semibold text-[#F4F4F5]">{formatDay(items[0].scheduledTime)}</h2>
                <div className="flex-1 h-px bg-[#1A1A24]" />
                <span className="text-xs text-[#8B8BA0]">{items.length} post{items.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Posts */}
              <div className="space-y-2">
                {items.map((post) => (
                  <Card key={post.id} className={post.status === 'cancelled' ? 'opacity-50' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Platform dot + time */}
                        <div className="flex flex-col items-center gap-1 shrink-0 w-16">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: PLATFORM_COLORS[post.platform] ?? '#7C3AED' }}
                          />
                          <span className="text-[10px] text-[#8B8BA0] text-center leading-tight">
                            {formatTime(post.scheduledTime)}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span
                              className="text-xs font-semibold capitalize"
                              style={{ color: PLATFORM_COLORS[post.platform] ?? '#A78BFA' }}
                            >
                              {post.platform}
                            </span>
                            {post.format && (
                              <Badge variant="outline" className="text-[10px] capitalize">{post.format}</Badge>
                            )}
                            <Badge variant={STATUS_VARIANTS[post.status] ?? 'outline'} className="text-[10px]">
                              {post.status === 'posted' && <CheckCircle className="w-2.5 h-2.5" />}
                              {post.status === 'failed' && <AlertCircle className="w-2.5 h-2.5" />}
                              {post.status}
                            </Badge>
                          </div>

                          {post.headline && (
                            <p className="text-sm font-medium text-[#F4F4F5] truncate">{post.headline}</p>
                          )}

                          {post.cta && (
                            <p className="text-xs text-[#8B8BA0] mt-0.5">CTA: {post.cta}</p>
                          )}

                          {post.postedAt && (
                            <div className="flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3 text-[#8B8BA0]" />
                              <span className="text-[10px] text-[#8B8BA0]">
                                Posted {new Date(post.postedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Cancel button */}
                        {post.status === 'scheduled' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0 text-[#8B8BA0] hover:text-red-400 h-8 w-8 p-0"
                            loading={cancelMutation.isPending && cancelMutation.variables === post.id}
                            onClick={() => cancelMutation.mutate(post.id)}
                            title="Cancel post"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
