import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isSameDay,
} from 'date-fns'
import type { ScheduledPost } from '@viralix/types'
import { cn, PLATFORM_COLORS } from '../../lib/utils'
import { Button } from '../ui/button'

interface ContentCalendarGridProps {
  posts: ScheduledPost[]
  onDayClick?: (date: Date) => void
  onPostClick?: (post: ScheduledPost) => void
}

export function ContentCalendarGrid({ posts, onDayClick, onPostClick }: ContentCalendarGridProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const postsForDay = (day: Date) =>
    posts.filter((p) => isSameDay(new Date(p.scheduledAt), day))

  return (
    <div>
      {/* Calendar header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-[hsl(var(--border))] rounded-xl overflow-hidden border border-[hsl(var(--border))]">
        {days.map((day) => {
          const dayPosts = postsForDay(day)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isCurrentDay = isToday(day)

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-[90px] p-1.5 cursor-pointer transition-colors group',
                isCurrentMonth ? 'bg-[hsl(var(--card))]' : 'bg-[hsl(240,5%,6%)]',
                'hover:bg-[hsl(var(--accent)/0.5)]',
              )}
              onClick={() => onDayClick?.(day)}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    'text-xs font-semibold h-5 w-5 flex items-center justify-center rounded-full',
                    isCurrentDay
                      ? 'bg-[hsl(var(--primary))] text-white'
                      : isCurrentMonth
                      ? 'text-[hsl(var(--foreground))]'
                      : 'text-[hsl(var(--muted-foreground))]',
                  )}
                >
                  {format(day, 'd')}
                </span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                </span>
              </div>

              {/* Posts */}
              <div className="space-y-0.5">
                {dayPosts.slice(0, 3).map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-1 rounded px-1 py-0.5 text-[9px] font-medium cursor-pointer hover:opacity-80 transition-opacity truncate"
                    style={{
                      background: `${PLATFORM_COLORS[post.platform] ?? '#7C3AED'}22`,
                      color: PLATFORM_COLORS[post.platform] ?? '#7C3AED',
                    }}
                    onClick={(e) => { e.stopPropagation(); onPostClick?.(post) }}
                    title={post.ad?.headline ?? post.platform}
                  >
                    <div
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: PLATFORM_COLORS[post.platform] ?? '#7C3AED' }}
                    />
                    <span className="truncate">{post.ad?.headline ?? post.platform}</span>
                  </div>
                ))}
                {dayPosts.length > 3 && (
                  <p className="text-[9px] text-[hsl(var(--muted-foreground))] px-1">
                    +{dayPosts.length - 3} more
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
