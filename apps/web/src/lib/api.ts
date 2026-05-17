import axios from 'axios'

const http = axios.create({ baseURL: '/api', timeout: 30_000 })

export interface Campaign {
  id: string
  url: string
  brandName: string
  scrapedData: ScrapedData | null
  status: 'pending' | 'scraping' | 'ready' | 'failed'
  createdAt: string
  ads?: Ad[]
}

export interface ScrapedData {
  title: string
  description: string
  headlines: string[]
  features: string[]
  pricing: string[]
  ctas: string[]
  brandColors: string[]
  tone: string
  logoUrl: string | null
  ogImage: string | null
}

export interface Ad {
  id: string
  campaignId: string
  platform: string
  format: string
  headline: string
  body: string
  cta: string
  hashtags: string[]
  mediaUrl: string | null
  status: 'pending' | 'generating' | 'ready' | 'approved' | 'rejected' | 'posted'
  createdAt: string
}

export interface ScheduledPost {
  id: string
  adId: string
  platform: string
  scheduledTime: string
  status: 'scheduled' | 'posted' | 'failed' | 'cancelled'
  postedAt: string | null
  headline: string | null
  cta: string | null
  format: string | null
  mediaUrl: string | null
}

export interface AnalyticsOverview {
  platform: string
  views: string | null
  clicks: string | null
  conversions: string | null
}

export const api = {
  campaigns: {
    list: () => http.get<Campaign[]>('/campaigns').then(r => r.data),
    get: (id: string) => http.get<Campaign>(`/campaigns/${id}`).then(r => r.data),
    create: (url: string) => http.post<Campaign>('/campaigns', { url }).then(r => r.data),
    delete: (id: string) => http.delete(`/campaigns/${id}`).then(r => r.data),
  },
  ads: {
    listByCampaign: (campaignId: string) => http.get<Ad[]>(`/ads/campaign/${campaignId}`).then(r => r.data),
    approve: (id: string) => http.patch<Ad>(`/ads/${id}/approve`).then(r => r.data),
    reject: (id: string) => http.patch<Ad>(`/ads/${id}/reject`).then(r => r.data),
  },
  schedule: {
    list: () => http.get<ScheduledPost[]>('/schedule').then(r => r.data),
    cancel: (id: string) => http.patch(`/schedule/${id}/cancel`).then(r => r.data),
  },
  analytics: {
    overview: () => http.get<AnalyticsOverview[]>('/ad-analytics/overview').then(r => r.data),
  },
}
