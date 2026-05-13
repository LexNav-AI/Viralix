import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number, compact = false): string {
  if (compact) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString()
  }
  return n.toLocaleString()
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`
}

export function formatDate(
  date: string | Date,
  fmt: 'short' | 'long' | 'relative' | 'datetime' = 'short',
): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  switch (fmt) {
    case 'short':
      return format(d, 'MMM d, yyyy')
    case 'long':
      return format(d, 'MMMM d, yyyy')
    case 'datetime':
      return format(d, 'MMM d, yyyy h:mm a')
    case 'relative':
      return formatDistanceToNow(d, { addSuffix: true })
    default:
      return format(d, 'MMM d, yyyy')
  }
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return `${str.slice(0, maxLength - 3)}...`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = key(item)
      if (!acc[k]) acc[k] = []
      acc[k].push(item)
      return acc
    },
    {} as Record<string, T[]>,
  )
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  tiktok: '#FF0050',
  linkedin: '#0A66C2',
  twitter: '#1DA1F2',
  youtube: '#FF0000',
  pinterest: '#E60023',
}

export const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  twitter: 'Twitter / X',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
}

export const FORMAT_LABELS: Record<string, string> = {
  instagram_post: 'Instagram Post',
  instagram_story: 'Instagram Story',
  instagram_reel: 'Instagram Reel',
  facebook_feed: 'Facebook Feed',
  facebook_story: 'Facebook Story',
  tiktok_video: 'TikTok Video',
  linkedin_post: 'LinkedIn Post',
  twitter_post: 'Twitter Post',
  youtube_pre_roll: 'YouTube Pre-roll',
  display_banner_728x90: 'Banner 728×90',
  display_banner_300x250: 'Banner 300×250',
  display_banner_160x600: 'Banner 160×600',
  display_banner_320x50: 'Mobile Banner',
  pinterest_pin: 'Pinterest Pin',
}
