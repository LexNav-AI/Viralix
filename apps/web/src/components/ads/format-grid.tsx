import {
  Instagram,
  Facebook,
  Youtube,
  Linkedin,
  Twitter,
  Monitor,
  Smartphone,
  Film,
} from 'lucide-react'
import type { AdFormat } from '@viralix/types'
import { cn, FORMAT_LABELS } from '../../lib/utils'

interface FormatItem {
  format: AdFormat
  icon: React.ReactNode
  description: string
  aspectRatio: string
}

const FORMATS: FormatItem[] = [
  { format: 'instagram_post', icon: <Instagram className="h-5 w-5" />, description: 'Square or landscape post', aspectRatio: '1:1' },
  { format: 'instagram_story', icon: <Instagram className="h-5 w-5" />, description: 'Full-screen vertical', aspectRatio: '9:16' },
  { format: 'instagram_reel', icon: <Film className="h-5 w-5" />, description: 'Short-form vertical video', aspectRatio: '9:16' },
  { format: 'facebook_feed', icon: <Facebook className="h-5 w-5" />, description: 'News feed ad', aspectRatio: '1.91:1' },
  { format: 'facebook_story', icon: <Facebook className="h-5 w-5" />, description: 'Full-screen story', aspectRatio: '9:16' },
  { format: 'tiktok_video', icon: <Film className="h-5 w-5" />, description: 'In-feed TikTok video', aspectRatio: '9:16' },
  { format: 'linkedin_post', icon: <Linkedin className="h-5 w-5" />, description: 'Professional feed post', aspectRatio: '1.91:1' },
  { format: 'twitter_post', icon: <Twitter className="h-5 w-5" />, description: 'Tweet with media', aspectRatio: '1.91:1' },
  { format: 'youtube_pre_roll', icon: <Youtube className="h-5 w-5" />, description: 'Skippable pre-roll', aspectRatio: '16:9' },
  { format: 'display_banner_728x90', icon: <Monitor className="h-5 w-5" />, description: 'Leaderboard banner', aspectRatio: '728:90' },
  { format: 'display_banner_300x250', icon: <Monitor className="h-5 w-5" />, description: 'Medium rectangle', aspectRatio: '300:250' },
  { format: 'display_banner_160x600', icon: <Monitor className="h-5 w-5" />, description: 'Wide skyscraper', aspectRatio: '160:600' },
  { format: 'display_banner_320x50', icon: <Smartphone className="h-5 w-5" />, description: 'Mobile banner', aspectRatio: '320:50' },
  { format: 'pinterest_pin', icon: <Monitor className="h-5 w-5" />, description: 'Promoted pin', aspectRatio: '2:3' },
]

interface FormatGridProps {
  selected?: AdFormat[]
  onSelect?: (format: AdFormat) => void
  multi?: boolean
}

export function FormatGrid({ selected = [], onSelect, multi = false }: FormatGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {FORMATS.map(({ format, icon, description, aspectRatio }) => {
        const isSelected = selected.includes(format)
        return (
          <button
            key={format}
            type="button"
            onClick={() => onSelect?.(format)}
            className={cn(
              'relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all duration-150',
              isSelected
                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--accent))] shadow-md shadow-[hsl(262,83%,58%,0.15)]'
                : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(262,83%,58%,0.4)] hover:bg-[hsl(var(--accent)/0.5)]',
            )}
          >
            {isSelected && (
              <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
                <svg viewBox="0 0 10 10" className="h-2.5 w-2.5">
                  <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
              </div>
            )}
            <div className={cn('p-1.5 rounded-lg', isSelected ? 'bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]')}>
              {icon}
            </div>
            <div>
              <p className={cn('text-xs font-semibold', isSelected ? 'text-[hsl(var(--accent-foreground))]' : 'text-[hsl(var(--foreground))]')}>
                {FORMAT_LABELS[format]}
              </p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{description}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono">{aspectRatio}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
