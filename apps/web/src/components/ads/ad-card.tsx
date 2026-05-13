import { useState } from 'react'
import { Eye, Send, Pencil, Copy, MoreHorizontal } from 'lucide-react'
import type { Ad } from '@viralix/types'
import { cn, FORMAT_LABELS, PLATFORM_LABELS, formatNumber, formatPercent } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

const STATUS_VARIANT: Record<string, 'success' | 'default' | 'secondary' | 'warning' | 'destructive'> = {
  ready: 'success',
  published: 'default',
  generating: 'warning',
  archived: 'secondary',
  failed: 'destructive',
}

export default AdCard

interface AdCardProps {
  ad: Ad
  onPreview?: (ad: Ad) => void
  onPublish?: (ad: Ad) => void
  onEdit?: (ad: Ad) => void
  onDuplicate?: (ad: Ad) => void
  selected?: boolean
  onSelect?: (ad: Ad) => void
}

export function AdCard({ ad, onPreview, onPublish, onEdit, onDuplicate, selected, onSelect }: AdCardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={cn(
        'group relative rounded-xl border transition-all duration-200 bg-[hsl(var(--card))] overflow-hidden cursor-pointer',
        selected
          ? 'border-[hsl(var(--primary))] shadow-lg shadow-[hsl(262,83%,58%,0.15)]'
          : 'border-[hsl(var(--border))] hover:border-[hsl(262,83%,58%,0.4)]',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect?.(ad)}
    >
      {/* Selection checkbox */}
      {onSelect && (
        <div
          className={cn(
            'absolute top-2 left-2 z-10 h-5 w-5 rounded border-2 transition-all flex items-center justify-center',
            selected
              ? 'bg-[hsl(var(--primary))] border-[hsl(var(--primary))]'
              : 'border-[hsl(var(--border))] bg-[hsl(var(--card)/0.8)]',
          )}
        >
          {selected && (
            <svg viewBox="0 0 12 12" className="h-3 w-3">
              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          )}
        </div>
      )}

      {/* Thumbnail */}
      <div className="relative bg-gradient-to-br from-[hsl(262,43%,12%)] to-[hsl(262,60%,20%)] aspect-video flex items-center justify-center">
        {ad.thumbnailUrl ? (
          <img src={ad.thumbnailUrl} alt={ad.headline ?? ''} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center opacity-50">
            <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary)/0.2)] flex items-center justify-center mx-auto mb-1">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current text-[hsl(var(--accent-foreground))]">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-1.1 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
              </svg>
            </div>
          </div>
        )}

        {/* Hover overlay with actions */}
        <div
          className={cn(
            'absolute inset-0 bg-black/60 flex items-center justify-center gap-2 transition-opacity duration-200',
            hovered ? 'opacity-100' : 'opacity-0',
          )}
        >
          {onPreview && (
            <Button
              size="icon-sm"
              variant="secondary"
              onClick={(e) => { e.stopPropagation(); onPreview(ad) }}
              title="Preview"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
          {onPublish && ad.status === 'ready' && (
            <Button
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); onPublish(ad) }}
              title="Publish"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
          {onEdit && (
            <Button
              size="icon-sm"
              variant="secondary"
              onClick={(e) => { e.stopPropagation(); onEdit(ad) }}
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDuplicate && (
            <Button
              size="icon-sm"
              variant="secondary"
              onClick={(e) => { e.stopPropagation(); onDuplicate(ad) }}
              title="Duplicate"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Format + platform badges */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5">
            {FORMAT_LABELS[ad.format] ?? ad.format}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-sm font-semibold text-[hsl(var(--foreground))] line-clamp-1 flex-1">
            {ad.headline ?? 'Untitled Ad'}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                className="shrink-0 h-6 w-6"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onPreview && (
                <DropdownMenuItem onClick={() => onPreview(ad)}>Preview</DropdownMenuItem>
              )}
              {onPublish && ad.status === 'ready' && (
                <DropdownMenuItem onClick={() => onPublish(ad)}>Publish</DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(ad)}>Edit</DropdownMenuItem>
              )}
              {onDuplicate && (
                <DropdownMenuItem onClick={() => onDuplicate(ad)}>Duplicate</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-2">
          <Badge variant={STATUS_VARIANT[ad.status] ?? 'secondary'}>
            {ad.status.charAt(0).toUpperCase() + ad.status.slice(1)}
          </Badge>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {PLATFORM_LABELS[ad.platform] ?? ad.platform}
          </span>
        </div>

        {ad.performance && (
          <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
            <span>{formatNumber(ad.performance.impressions, true)} impr.</span>
            <span>{formatPercent(ad.performance.ctr)} CTR</span>
          </div>
        )}
      </div>
    </div>
  )
}
