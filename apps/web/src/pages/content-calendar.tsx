import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Clock, Zap } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from 'date-fns'
import { useWorkspace } from '@/lib/hooks/use-workspace'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2', instagram: '#E1306C', tiktok: '#FF0050', linkedin: '#0A66C2', twitter: '#1DA1F2',
}

type ScheduledPost = {
  id: string
  platform: string
  scheduledAt: string
  status: string
  ad: { headline: string; thumbnailUrl?: string }
}

export default function ContentCalendarPage() {
  const { workspace } = useWorkspace()
  const wid = workspace?.id ?? ''
  const qc = useQueryClient()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [scheduleAdId, setScheduleAdId] = useState('')
  const [schedulePlatform, setSchedulePlatform] = useState('')

  const monthStr = format(currentMonth, 'yyyy-MM')

  const { data: calendarData, isLoading } = useQuery({
    queryKey: ['calendar', wid, monthStr],
    queryFn: () => api.calendar.getMonth(wid, monthStr),
    enabled: !!wid,
  })

  const { data: readyAds } = useQuery({
    queryKey: ['ads', wid, 'ready'],
    queryFn: () => api.ads.list(wid, { status: 'ready', limit: 50 }),
    enabled: !!wid,
  })

  const scheduleMutation = useMutation({
    mutationFn: ({ adId, platform, scheduledAt }: { adId: string; platform: string; scheduledAt: string }) =>
      api.publishing.schedule(wid, { adId, platform, scheduledAt }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar', wid] })
      setSelectedDay(null)
    },
  })

  const autoScheduleMutation = useMutation({
    mutationFn: () => api.calendar.autoSchedule(wid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', wid] }),
  })

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })

  const getPostsForDay = (day: Date): ScheduledPost[] => {
    if (!calendarData?.days) return []
    const key = format(day, 'yyyy-MM-dd')
    return calendarData.days[key] ?? []
  }

  const selectedDayPosts = selectedDay ? getPostsForDay(selectedDay) : []

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content Calendar</h1>
          <p className="text-muted-foreground text-sm">Schedule and manage your publishing timeline</p>
        </div>
        <Button onClick={() => autoScheduleMutation.mutate()} loading={autoScheduleMutation.isPending} variant="outline" size="sm">
          <Zap className="w-4 h-4 mr-1.5" />Auto-Schedule 30 Days
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCurrentMonth(new Date())}>Today</Button>
              <Button size="sm" variant="ghost" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs text-muted-foreground font-medium py-2">{d}</div>
            ))}

            {/* Empty cells for start of month */}
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-20 p-1 bg-card/20" />
            ))}

            {isLoading
              ? days.map((_, i) => <Skeleton key={i} className="min-h-20 rounded" />)
              : days.map(day => {
                  const posts = getPostsForDay(day)
                  const isCurrentMonth = isSameMonth(day, currentMonth)
                  const isSelected = selectedDay ? isSameDay(day, selectedDay) : false

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => setSelectedDay(day)}
                      className={`min-h-20 p-1.5 border border-transparent rounded cursor-pointer transition-colors ${
                        isToday(day) ? 'bg-primary/10 border-primary/40' : 'hover:bg-accent/50'
                      } ${isSelected ? 'border-primary' : ''} ${!isCurrentMonth ? 'opacity-30' : ''}`}
                    >
                      <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday(day) ? 'bg-primary text-white' : 'text-foreground'
                      }`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-0.5">
                        {posts.slice(0, 3).map(post => (
                          <div
                            key={post.id}
                            className="text-xs px-1 py-0.5 rounded truncate"
                            style={{ background: `${PLATFORM_COLORS[post.platform]}20`, color: PLATFORM_COLORS[post.platform] }}
                          >
                            {post.ad?.headline?.slice(0, 20) ?? post.platform}
                          </div>
                        ))}
                        {posts.length > 3 && <div className="text-xs text-muted-foreground pl-1">+{posts.length - 3} more</div>}
                      </div>
                    </div>
                  )
                })
            }
          </div>
        </CardContent>
      </Card>

      {/* Day detail dialog */}
      <Dialog open={!!selectedDay} onOpenChange={open => !open && setSelectedDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedDay ? format(selectedDay, 'EEEE, MMMM d') : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedDayPosts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">SCHEDULED</p>
                {selectedDayPosts.map(post => (
                  <div key={post.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-accent/50">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PLATFORM_COLORS[post.platform] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{post.ad?.headline}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {post.platform} · {format(new Date(post.scheduledAt), 'h:mm a')}
                      </p>
                    </div>
                    <Badge variant={post.status === 'published' ? 'success' : 'secondary'} className="text-xs shrink-0">
                      {post.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-medium">SCHEDULE AN AD</p>
              <Select value={scheduleAdId} onValueChange={setScheduleAdId}>
                <SelectTrigger><SelectValue placeholder="Select an ad..." /></SelectTrigger>
                <SelectContent>
                  {readyAds?.data?.map((ad: { id: string; headline: string; format: string }) => (
                    <SelectItem key={ad.id} value={ad.id}>{ad.headline} ({ad.format.replace(/_/g, ' ')})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={schedulePlatform} onValueChange={setSchedulePlatform}>
                <SelectTrigger><SelectValue placeholder="Select platform..." /></SelectTrigger>
                <SelectContent>
                  {['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter'].map(p => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="w-full"
                disabled={!scheduleAdId || !schedulePlatform}
                loading={scheduleMutation.isPending}
                onClick={() => {
                  if (!selectedDay) return
                  const scheduledAt = new Date(selectedDay)
                  scheduledAt.setHours(9, 0, 0, 0)
                  scheduleMutation.mutate({ adId: scheduleAdId, platform: schedulePlatform, scheduledAt: scheduledAt.toISOString() })
                }}
              >
                <Clock className="w-4 h-4 mr-1.5" />Schedule for 9:00 AM
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
