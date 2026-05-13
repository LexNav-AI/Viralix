import type { Ad } from '@viralix/types'
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ThumbsUp, Share2, Play } from 'lucide-react'
import { cn, PLATFORM_LABELS } from '../../lib/utils'

interface AdPreviewProps {
  ad: Partial<Ad> & { format: Ad['format']; platform: Ad['platform'] }
  headline?: string
  bodyText?: string
  ctaText?: string
  className?: string
}

function PlaceholderImage({ className, aspectRatio }: { className?: string; aspectRatio?: string }) {
  return (
    <div
      className={cn('bg-gradient-to-br from-[hsl(262,43%,15%)] to-[hsl(262,60%,25%)] flex items-center justify-center', className)}
      style={{ aspectRatio }}
    >
      <div className="text-center opacity-40">
        <div className="h-10 w-10 rounded-full bg-[hsl(262,83%,58%,0.3)] flex items-center justify-center mx-auto mb-2">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-[hsl(var(--accent-foreground))]">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-1.1 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
        </div>
        <p className="text-xs text-[hsl(var(--accent-foreground))]">Ad Image</p>
      </div>
    </div>
  )
}

function InstagramPostPreview({ headline, bodyText, ctaText }: Omit<AdPreviewProps, 'ad'>) {
  return (
    <div className="w-80 rounded-2xl overflow-hidden border border-[hsl(var(--border))] bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-white">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600" />
          <div>
            <p className="text-xs font-semibold text-gray-900">your_brand</p>
            <p className="text-[10px] text-gray-500">Sponsored</p>
          </div>
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-600" />
      </div>
      {/* Image */}
      <PlaceholderImage aspectRatio="1/1" />
      {/* Actions */}
      <div className="bg-white p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Heart className="h-5 w-5 text-gray-800" />
            <MessageCircle className="h-5 w-5 text-gray-800" />
            <Send className="h-5 w-5 text-gray-800" />
          </div>
          <Bookmark className="h-5 w-5 text-gray-800" />
        </div>
        <p className="text-[11px] font-semibold text-gray-900 mb-0.5">
          {headline ?? 'Transform Your Marketing Today'}
        </p>
        {bodyText && (
          <p className="text-[11px] text-gray-600 line-clamp-2">{bodyText}</p>
        )}
        {ctaText && (
          <button className="mt-2 w-full py-1.5 rounded bg-gradient-to-r from-purple-600 to-pink-500 text-white text-[11px] font-semibold">
            {ctaText}
          </button>
        )}
      </div>
    </div>
  )
}

function InstagramStoryPreview({ headline, bodyText, ctaText }: Omit<AdPreviewProps, 'ad'>) {
  return (
    <div className="w-48 rounded-2xl overflow-hidden border border-[hsl(var(--border))] bg-black shadow-2xl relative" style={{ aspectRatio: '9/16' }}>
      <PlaceholderImage className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 p-3">
        <div className="h-0.5 bg-white/40 rounded-full mb-3">
          <div className="h-full w-2/3 bg-white rounded-full" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600" />
          <span className="text-white text-[9px] font-semibold">your_brand</span>
          <span className="text-white/60 text-[9px] ml-1">Sponsored</span>
        </div>
      </div>
      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        {headline && (
          <p className="text-white text-xs font-bold mb-1 leading-tight">{headline}</p>
        )}
        {bodyText && (
          <p className="text-white/80 text-[9px] mb-2 line-clamp-2">{bodyText}</p>
        )}
        {ctaText && (
          <div className="flex items-center justify-center gap-1 bg-white/20 backdrop-blur rounded-full py-1">
            <span className="text-white text-[9px] font-semibold">{ctaText}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function FacebookFeedPreview({ headline, bodyText, ctaText }: Omit<AdPreviewProps, 'ad'>) {
  return (
    <div className="w-80 rounded-xl overflow-hidden border border-gray-200 bg-white shadow-xl">
      <div className="p-3 flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary))]" />
        <div>
          <p className="text-xs font-semibold text-gray-900">Your Brand Page</p>
          <p className="text-[10px] text-gray-400">Sponsored · <span className="text-blue-500">?</span></p>
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-400 ml-auto" />
      </div>
      {bodyText && (
        <p className="px-3 pb-2 text-[11px] text-gray-700 line-clamp-3">{bodyText}</p>
      )}
      <PlaceholderImage aspectRatio="1.91/1" />
      {(headline || ctaText) && (
        <div className="bg-gray-50 border-t border-gray-200 p-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">yourbrand.com</p>
            <p className="text-xs font-semibold text-gray-900">{headline ?? 'Start Today'}</p>
          </div>
          {ctaText && (
            <button className="px-3 py-1.5 rounded bg-[#1877F2] text-white text-xs font-semibold">
              {ctaText}
            </button>
          )}
        </div>
      )}
      <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-4">
        <button className="flex items-center gap-1 text-[11px] text-gray-500">
          <ThumbsUp className="h-3.5 w-3.5" /> Like
        </button>
        <button className="flex items-center gap-1 text-[11px] text-gray-500">
          <MessageCircle className="h-3.5 w-3.5" /> Comment
        </button>
        <button className="flex items-center gap-1 text-[11px] text-gray-500">
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
      </div>
    </div>
  )
}

function TikTokPreview({ headline, bodyText, ctaText }: Omit<AdPreviewProps, 'ad'>) {
  return (
    <div className="w-48 rounded-2xl overflow-hidden border border-[hsl(var(--border))] bg-black shadow-2xl relative" style={{ aspectRatio: '9/16' }}>
      <PlaceholderImage className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      {/* Right actions */}
      <div className="absolute right-2 bottom-16 flex flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-0.5">
          <Heart className="h-5 w-5 text-white" />
          <span className="text-white text-[8px]">24.5K</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <MessageCircle className="h-5 w-5 text-white" />
          <span className="text-white text-[8px]">843</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Share2 className="h-5 w-5 text-white" />
          <span className="text-white text-[8px]">Share</span>
        </div>
      </div>
      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-3 pr-12">
        <p className="text-white text-[9px] font-semibold mb-0.5">@yourbrand · Sponsored</p>
        {headline && <p className="text-white text-[9px] font-bold mb-1">{headline}</p>}
        {bodyText && <p className="text-white/80 text-[8px] line-clamp-2">{bodyText}</p>}
        {ctaText && (
          <div className="mt-1.5 inline-flex items-center gap-1 bg-[#FF0050] rounded px-2 py-0.5">
            <span className="text-white text-[8px] font-bold">{ctaText}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function LinkedInPostPreview({ headline, bodyText, ctaText }: Omit<AdPreviewProps, 'ad'>) {
  return (
    <div className="w-80 rounded-xl overflow-hidden border border-gray-200 bg-white shadow-xl">
      <div className="p-3 flex items-start gap-2">
        <div className="h-9 w-9 rounded-full bg-[#0A66C2] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">YB</span>
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-900">Your Brand</p>
          <p className="text-[10px] text-gray-400">50,234 followers · Promoted</p>
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-400" />
      </div>
      {bodyText && (
        <p className="px-3 pb-2 text-[11px] text-gray-700 line-clamp-4">{bodyText}</p>
      )}
      <PlaceholderImage aspectRatio="1.91/1" />
      {(headline || ctaText) && (
        <div className="p-3 flex items-center justify-between bg-gray-50 border-t border-gray-200">
          <div>
            <p className="text-xs font-semibold text-gray-900">{headline ?? 'Learn More'}</p>
            <p className="text-[10px] text-gray-400">yourbrand.com</p>
          </div>
          {ctaText && (
            <button className="px-3 py-1.5 rounded border border-[#0A66C2] text-[#0A66C2] text-xs font-semibold hover:bg-blue-50">
              {ctaText}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function TwitterPostPreview({ headline, bodyText, ctaText }: Omit<AdPreviewProps, 'ad'>) {
  return (
    <div className="w-80 rounded-xl overflow-hidden border border-gray-800 bg-black shadow-xl p-4">
      <div className="flex gap-3 mb-3">
        <div className="h-9 w-9 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">YB</span>
        </div>
        <div>
          <div className="flex items-center gap-1">
            <p className="text-sm font-bold text-white">Your Brand</p>
            <svg className="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91-1.01-1-2.52-1.26-3.91-.8C14.67 2.88 13.43 2 12 2c-1.43 0-2.67.88-3.34 2.19-1.39-.46-2.9-.2-3.91.81-1 1.01-1.26 2.52-.8 3.91C2.88 9.33 2 10.57 2 12c0 1.43.88 2.67 2.19 3.34-.46 1.39-.2 2.9.81 3.91 1.01 1 2.52 1.26 3.91.8C9.33 21.12 10.57 22 12 22c1.43 0 2.67-.88 3.34-2.19 1.39.46 2.9.2 3.91-.81 1-1.01 1.26-2.52.8-3.91C21.12 14.67 22 13.43 22 12z"/></svg>
          </div>
          <p className="text-xs text-gray-400">@yourbrand · Promoted</p>
        </div>
      </div>
      {bodyText && <p className="text-sm text-white mb-3 leading-relaxed">{bodyText}</p>}
      {(headline || ctaText) && (
        <div className="rounded-xl border border-gray-700 overflow-hidden mb-3">
          <PlaceholderImage aspectRatio="1.91/1" className="w-full" />
          <div className="p-3 bg-gray-900">
            <p className="text-gray-400 text-[10px]">yourbrand.com</p>
            <p className="text-white text-xs font-semibold">{headline ?? 'Check it out'}</p>
            {ctaText && (
              <button className="mt-2 px-4 py-1.5 rounded-full border border-gray-600 text-white text-xs font-semibold">
                {ctaText}
              </button>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center gap-6 text-gray-400">
        <MessageCircle className="h-4 w-4" />
        <Share2 className="h-4 w-4" />
        <Heart className="h-4 w-4" />
      </div>
    </div>
  )
}

function BannerPreview({ format, headline, ctaText }: Omit<AdPreviewProps, 'ad'> & { format: string }) {
  const sizes: Record<string, { w: number; h: number }> = {
    display_banner_728x90: { w: 364, h: 45 },
    display_banner_300x250: { w: 300, h: 250 },
    display_banner_160x600: { w: 160, h: 300 },
    display_banner_320x50: { w: 320, h: 28 },
  }
  const size = sizes[format] ?? { w: 300, h: 250 }

  return (
    <div
      className="rounded-lg overflow-hidden border border-[hsl(var(--border))] bg-gradient-to-br from-[hsl(262,60%,25%)] to-[hsl(262,83%,45%)] relative flex items-center justify-between px-4"
      style={{ width: size.w, height: size.h }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-xs truncate">{headline ?? 'Your Ad Headline'}</p>
      </div>
      {ctaText && (
        <button className="ml-3 shrink-0 bg-white text-[hsl(var(--primary))] text-xs font-bold px-3 py-1 rounded">
          {ctaText}
        </button>
      )}
    </div>
  )
}

export function AdPreview({ ad, headline, bodyText, ctaText, className }: AdPreviewProps) {
  const h = headline ?? ad.headline ?? undefined
  const b = bodyText ?? ad.bodyText ?? undefined
  const c = ctaText ?? ad.ctaText ?? undefined

  const preview = (() => {
    switch (ad.format) {
      case 'instagram_post':
        return <InstagramPostPreview headline={h} bodyText={b} ctaText={c} />
      case 'instagram_story':
      case 'instagram_reel':
        return <InstagramStoryPreview headline={h} bodyText={b} ctaText={c} />
      case 'facebook_feed':
      case 'facebook_story':
        return <FacebookFeedPreview headline={h} bodyText={b} ctaText={c} />
      case 'tiktok_video':
        return <TikTokPreview headline={h} bodyText={b} ctaText={c} />
      case 'linkedin_post':
        return <LinkedInPostPreview headline={h} bodyText={b} ctaText={c} />
      case 'twitter_post':
        return <TwitterPostPreview headline={h} bodyText={b} ctaText={c} />
      case 'display_banner_728x90':
      case 'display_banner_300x250':
      case 'display_banner_160x600':
      case 'display_banner_320x50':
      case 'pinterest_pin':
        return <BannerPreview format={ad.format} headline={h} ctaText={c} bodyText={b} />
      default:
        return (
          <div className="w-64 h-40 rounded-xl border border-[hsl(var(--border))] flex items-center justify-center">
            <span className="text-[hsl(var(--muted-foreground))] text-sm">
              {PLATFORM_LABELS[ad.platform] ?? ad.platform} Preview
            </span>
          </div>
        )
    }
  })()

  return (
    <div className={cn('flex items-center justify-center', className)}>
      {preview}
    </div>
  )
}

export default AdPreview

export function AdPreviewWithVideoOverlay({ ad, ...props }: AdPreviewProps) {
  const isVideo = ['tiktok_video', 'instagram_reel', 'youtube_pre_roll'].includes(ad.format)
  return (
    <div className="relative">
      <AdPreview ad={ad} {...props} />
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-10 w-10 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="h-5 w-5 text-white fill-white ml-0.5" />
          </div>
        </div>
      )}
    </div>
  )
}
