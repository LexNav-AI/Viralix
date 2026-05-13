import type {
  User,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  Workspace,
  WorkspaceMember,
  Campaign,
  CampaignBrief,
  Ad,
  AdFormat,
  Platform,
  GenerationJob,
  GenerationBrief,
  PlatformConnection,
  ScheduledPost,
  BrandVoice,
  BrandAsset,
  BrandTone,
  ABTest,
  ABTestMetric,
  AnalyticsDashboard,
  AnalyticsTrend,
  PaginatedResponse,
  PerformanceInsight,
} from '@viralix/types'
import { getToken, clearAuth } from './auth'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api'

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, params, headers, ...rest } = options

  let url = `${BASE_URL}${path}`
  if (params) {
    const search = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) search.set(k, String(v))
    }
    const qs = search.toString()
    if (qs) url += `?${qs}`
  }

  const token = getToken()
  const reqHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers as Record<string, string> | undefined),
  }

  const res = await fetch(url, {
    ...rest,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    clearAuth()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    let message = `Request failed: ${res.status}`
    try {
      const data = (await res.json()) as { message?: string }
      if (data.message) message = data.message
    } catch {
      // ignore parse error
    }
    throw new Error(message)
  }

  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

// ─── Auth ─────────────────────────────────────────────────────────────────

export const auth = {
  login: (data: LoginRequest) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: data }),

  register: (data: RegisterRequest) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: data }),

  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  me: () => request<User>('/auth/me'),
}

// ─── Workspaces ───────────────────────────────────────────────────────────

export const workspaces = {
  list: () => request<Workspace[]>('/workspaces'),

  get: (id: string) => request<Workspace>(`/workspaces/${id}`),

  create: (data: { name: string; industry?: string; targetAudience?: string }) =>
    request<Workspace>('/workspaces', { method: 'POST', body: data }),

  update: (
    id: string,
    data: Partial<{ name: string; industry: string; targetAudience: string }>,
  ) => request<Workspace>(`/workspaces/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string) => request<void>(`/workspaces/${id}`, { method: 'DELETE' }),

  members: (id: string) => request<WorkspaceMember[]>(`/workspaces/${id}/members`),
}

// ─── Campaigns ────────────────────────────────────────────────────────────

interface CampaignFilters {
  status?: string
  platform?: string
  page?: number
  perPage?: number
}

export const campaigns = {
  list: (workspaceId: string, filters?: CampaignFilters) =>
    request<PaginatedResponse<Campaign>>(`/workspaces/${workspaceId}/campaigns`, {
      params: filters as Record<string, string | number | boolean | undefined>,
    }),

  get: (workspaceId: string, id: string) =>
    request<Campaign>(`/workspaces/${workspaceId}/campaigns/${id}`),

  create: (
    workspaceId: string,
    data: {
      name: string
      objective?: string
      platforms?: Platform[]
      budget?: number
      startDate?: string
      endDate?: string
    },
  ) =>
    request<Campaign>(`/workspaces/${workspaceId}/campaigns`, {
      method: 'POST',
      body: data,
    }),

  update: (workspaceId: string, id: string, data: Partial<Campaign>) =>
    request<Campaign>(`/workspaces/${workspaceId}/campaigns/${id}`, {
      method: 'PATCH',
      body: data,
    }),

  delete: (workspaceId: string, id: string) =>
    request<void>(`/workspaces/${workspaceId}/campaigns/${id}`, { method: 'DELETE' }),

  getBrief: (workspaceId: string, campaignId: string) =>
    request<CampaignBrief>(`/workspaces/${workspaceId}/campaigns/${campaignId}/brief`),

  upsertBrief: (workspaceId: string, campaignId: string, data: Partial<CampaignBrief>) =>
    request<CampaignBrief>(`/workspaces/${workspaceId}/campaigns/${campaignId}/brief`, {
      method: 'PUT',
      body: data,
    }),
}

// ─── Ads ──────────────────────────────────────────────────────────────────

interface AdFilters {
  format?: AdFormat
  platform?: Platform
  status?: string
  campaignId?: string
  page?: number
  perPage?: number
}

export const ads = {
  list: (workspaceId: string, filters?: AdFilters) =>
    request<PaginatedResponse<Ad>>(`/workspaces/${workspaceId}/ads`, {
      params: filters as Record<string, string | number | boolean | undefined>,
    }),

  get: (workspaceId: string, id: string) =>
    request<Ad>(`/workspaces/${workspaceId}/ads/${id}`),

  delete: (workspaceId: string, id: string) =>
    request<void>(`/workspaces/${workspaceId}/ads/${id}`, { method: 'DELETE' }),

  archive: (workspaceId: string, id: string) =>
    request<Ad>(`/workspaces/${workspaceId}/ads/${id}/archive`, { method: 'POST' }),

  duplicate: (workspaceId: string, id: string) =>
    request<Ad>(`/workspaces/${workspaceId}/ads/${id}/duplicate`, { method: 'POST' }),
}

// ─── Generation ──────────────────────────────────────────────────────────

export const generation = {
  create: (
    workspaceId: string,
    data: {
      format: AdFormat
      platform: Platform
      campaignId?: string
      brief: GenerationBrief
    },
  ) =>
    request<GenerationJob>(`/workspaces/${workspaceId}/generate`, {
      method: 'POST',
      body: data,
    }),

  getJob: (workspaceId: string, jobId: string) =>
    request<GenerationJob>(`/workspaces/${workspaceId}/generate/${jobId}`),

  listJobs: (workspaceId: string) =>
    request<GenerationJob[]>(`/workspaces/${workspaceId}/generate`),
}

// ─── Analytics ────────────────────────────────────────────────────────────

export const analytics = {
  dashboard: (workspaceId: string, period: '7d' | '30d' | '90d' = '7d') =>
    request<AnalyticsDashboard>(`/workspaces/${workspaceId}/analytics`, {
      params: { period },
    }),

  trends: (workspaceId: string, period: '7d' | '30d' | '90d' = '7d') =>
    request<AnalyticsTrend[]>(`/workspaces/${workspaceId}/analytics/trends`, {
      params: { period },
    }),

  insights: (workspaceId: string) =>
    request<PerformanceInsight[]>(`/workspaces/${workspaceId}/analytics/insights`),
}

// ─── Connections ──────────────────────────────────────────────────────────

export const connections = {
  list: (workspaceId: string) =>
    request<PlatformConnection[]>(`/workspaces/${workspaceId}/connections`),

  connect: (workspaceId: string, platform: Platform) =>
    request<{ authUrl: string }>(`/workspaces/${workspaceId}/connections/${platform}/connect`, {
      method: 'POST',
    }),

  disconnect: (workspaceId: string, platform: Platform) =>
    request<void>(`/workspaces/${workspaceId}/connections/${platform}`, {
      method: 'DELETE',
    }),
}

// ─── Calendar ─────────────────────────────────────────────────────────────

export const calendar = {
  scheduled: (workspaceId: string, start: string, end: string) =>
    request<ScheduledPost[]>(`/workspaces/${workspaceId}/calendar`, {
      params: { start, end },
    }),

  schedule: (workspaceId: string, data: { adId: string; platform: Platform; scheduledAt: string }) =>
    request<ScheduledPost>(`/workspaces/${workspaceId}/calendar`, {
      method: 'POST',
      body: data,
    }),

  reschedule: (workspaceId: string, postId: string, scheduledAt: string) =>
    request<ScheduledPost>(`/workspaces/${workspaceId}/calendar/${postId}`, {
      method: 'PATCH',
      body: { scheduledAt },
    }),

  cancel: (workspaceId: string, postId: string) =>
    request<void>(`/workspaces/${workspaceId}/calendar/${postId}`, { method: 'DELETE' }),
}

// ─── Brand Voice ──────────────────────────────────────────────────────────

export const brandVoice = {
  get: (workspaceId: string) =>
    request<BrandVoice>(`/workspaces/${workspaceId}/brand-voice`),

  upsert: (
    workspaceId: string,
    data: {
      tone?: BrandTone
      keywords?: string[]
      forbiddenWords?: string[]
      sampleCopy?: string
    },
  ) =>
    request<BrandVoice>(`/workspaces/${workspaceId}/brand-voice`, {
      method: 'PUT',
      body: data,
    }),

  preview: (workspaceId: string) =>
    request<{ copy: string }>(`/workspaces/${workspaceId}/brand-voice/preview`, {
      method: 'POST',
    }),

  assets: (workspaceId: string) =>
    request<BrandAsset[]>(`/workspaces/${workspaceId}/brand-assets`),

  deleteAsset: (workspaceId: string, assetId: string) =>
    request<void>(`/workspaces/${workspaceId}/brand-assets/${assetId}`, {
      method: 'DELETE',
    }),
}

// ─── AB Testing ───────────────────────────────────────────────────────────

export const abTesting = {
  list: (workspaceId: string) =>
    request<ABTest[]>(`/workspaces/${workspaceId}/ab-tests`),

  get: (workspaceId: string, id: string) =>
    request<ABTest>(`/workspaces/${workspaceId}/ab-tests/${id}`),

  create: (
    workspaceId: string,
    data: {
      name: string
      hypothesis?: string
      metric: ABTestMetric
      adIds: string[]
      trafficAllocations: number[]
    },
  ) =>
    request<ABTest>(`/workspaces/${workspaceId}/ab-tests`, {
      method: 'POST',
      body: data,
    }),

  start: (workspaceId: string, id: string) =>
    request<ABTest>(`/workspaces/${workspaceId}/ab-tests/${id}/start`, {
      method: 'POST',
    }),

  pause: (workspaceId: string, id: string) =>
    request<ABTest>(`/workspaces/${workspaceId}/ab-tests/${id}/pause`, {
      method: 'POST',
    }),

  complete: (workspaceId: string, id: string, winnerId: string) =>
    request<ABTest>(`/workspaces/${workspaceId}/ab-tests/${id}/complete`, {
      method: 'POST',
      body: { winnerId },
    }),

  delete: (workspaceId: string, id: string) =>
    request<void>(`/workspaces/${workspaceId}/ab-tests/${id}`, { method: 'DELETE' }),
}

// ─── Publishing ───────────────────────────────────────────────────────────

export const publishing = {
  publish: (workspaceId: string, adId: string, platforms: Platform[]) =>
    request<{ scheduledPosts: ScheduledPost[] }>(
      `/workspaces/${workspaceId}/publish`,
      { method: 'POST', body: { adId, platforms } },
    ),

  scheduled: (workspaceId: string) =>
    request<ScheduledPost[]>(`/workspaces/${workspaceId}/publishing/scheduled`),
}

// ─── Default export (namespace object for legacy page imports) ────────────
// Extends each sub-module with additional methods used by pages.

export const api = {
  auth,
  workspaces,
  campaigns: {
    ...campaigns,
    createBrief: campaigns.upsertBrief,
    generate: (workspaceId: string, campaignId: string) =>
      request<GenerationJob[]>(`/workspaces/${workspaceId}/campaigns/${campaignId}/generate`, {
        method: 'POST',
      }),
  },
  ads: {
    ...ads,
    generate: (workspaceId: string, data: {
      format: string
      platform: string
      brief: GenerationBrief
      campaignId?: string
    }) =>
      request<{ jobId: string }>(`/workspaces/${workspaceId}/ads/generate`, {
        method: 'POST',
        body: data,
      }),
    jobStatus: (workspaceId: string, jobId: string) =>
      request<{ status: string; result?: unknown }>(`/workspaces/${workspaceId}/ads/generate/${jobId}`),
  },
  generation,
  analytics: {
    ...analytics,
    overview: (workspaceId: string, params?: { from?: string; to?: string }) =>
      request<AnalyticsDashboard['overview']>(`/workspaces/${workspaceId}/analytics/overview`, {
        params: params as Record<string, string | undefined>,
      }),
    byPlatform: (workspaceId: string, params?: { from?: string; to?: string }) =>
      request<AnalyticsDashboard['platformBreakdown']>(`/workspaces/${workspaceId}/analytics/by-platform`, {
        params: params as Record<string, string | undefined>,
      }),
    byFormat: (workspaceId: string, params?: { from?: string; to?: string }) =>
      request<unknown[]>(`/workspaces/${workspaceId}/analytics/by-format`, {
        params: params as Record<string, string | undefined>,
      }),
    topPerformers: (workspaceId: string, params?: { metric?: string; limit?: number }) =>
      request<AnalyticsDashboard['topPerformers']>(`/workspaces/${workspaceId}/analytics/top-performers`, {
        params: params as Record<string, string | number | undefined>,
      }),
  },
  connections: {
    ...connections,
    getOAuthUrl: (workspaceId: string, platform: string) =>
      request<{ url: string }>(`/workspaces/${workspaceId}/connections/${platform}/oauth-url`, {
        method: 'POST',
      }),
    refresh: (workspaceId: string, connectionId: string) =>
      request<unknown>(`/workspaces/${workspaceId}/connections/${connectionId}/refresh`, {
        method: 'POST',
      }),
  },
  calendar: {
    ...calendar,
    getMonth: (workspaceId: string, month: string) =>
      request<ScheduledPost[]>(`/workspaces/${workspaceId}/calendar/month`, {
        params: { month },
      }),
    autoSchedule: (workspaceId: string) =>
      request<unknown>(`/workspaces/${workspaceId}/calendar/auto-schedule`, {
        method: 'POST',
      }),
  },
  brands: {
    getVoice: (workspaceId: string) => brandVoice.get(workspaceId),
    upsertVoice: brandVoice.upsert,
    listAssets: brandVoice.assets,
    deleteAsset: brandVoice.deleteAsset,
    voiceStatus: (workspaceId: string) =>
      request<{ status: string }>(`/workspaces/${workspaceId}/brand-voice/fine-tune/status`),
    trainVoice: (workspaceId: string) =>
      request<{ status: string }>(`/workspaces/${workspaceId}/brand-voice/fine-tune`, {
        method: 'POST',
      }),
    uploadAsset: (workspaceId: string, formData: FormData) =>
      fetch(`${BASE_URL}/workspaces/${workspaceId}/brand-assets`, {
        method: 'POST',
        headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
        body: formData,
      }).then((r) => r.json() as Promise<BrandAsset>),
  },
  brandVoice,
  abTesting: {
    ...abTesting,
    updateStatus: (workspaceId: string, id: string, status: string) => {
      if (status === 'running') return abTesting.start(workspaceId, id)
      if (status === 'paused') return abTesting.pause(workspaceId, id)
      return abTesting.complete(workspaceId, id, '')
    },
    pickWinner: (workspaceId: string, id: string) =>
      request<ABTest>(`/workspaces/${workspaceId}/ab-tests/${id}/pick-winner`, {
        method: 'POST',
      }),
  },
  publishing: {
    ...publishing,
    schedule: calendar.schedule,
    scheduled: publishing.scheduled,
  },
}
