// ---------------------------------------------------------------------------
// Enums — mirror pgEnum values exactly
// ---------------------------------------------------------------------------

export type Plan = 'free' | 'starter' | 'growth' | 'scale'

export type BrandAssetType = 'logo' | 'font' | 'color_palette' | 'image' | 'document'

export type BrandVoiceTone =
  | 'professional'
  | 'casual'
  | 'bold'
  | 'playful'
  | 'luxurious'
  | 'minimalist'

export type Platform = 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'twitter'

export type AdPlatform = Platform | 'universal'

export type CampaignObjective =
  | 'awareness'
  | 'traffic'
  | 'engagement'
  | 'leads'
  | 'conversions'
  | 'sales'

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived'

export type AdFormat =
  | 'static_image'
  | 'carousel'
  | 'video'
  | 'story'
  | 'reel'
  | 'banner_300x250'
  | 'banner_728x90'
  | 'banner_160x600'

export type AdStatus = 'generating' | 'ready' | 'published' | 'failed' | 'archived'

export type AdBatchStatus = 'pending' | 'running' | 'completed' | 'failed'

export type InsightType =
  | 'headline_pattern'
  | 'cta_pattern'
  | 'visual_style'
  | 'audience_segment'
  | 'posting_time'
  | 'format'

export type ModelType = 'llama' | 'sdxl' | 'animatediff'

export type FineTuneStatus = 'pending' | 'running' | 'completed' | 'failed'

export type ScheduledPostStatus = 'scheduled' | 'published' | 'failed' | 'cancelled'

export type AbTestStatus = 'draft' | 'running' | 'paused' | 'completed'

export type AbTestMetric = 'ctr' | 'conversions' | 'engagement' | 'roas'

export type GenerationJobType = 'ad_copy' | 'image' | 'video' | 'audio' | 'batch'

export type GenerationJobStatus = 'queued' | 'running' | 'completed' | 'failed'

// ---------------------------------------------------------------------------
// Select types (rows returned from DB)
// ---------------------------------------------------------------------------

export interface User {
  id: string
  email: string
  passwordHash: string
  name: string
  avatarUrl: string | null
  plan: Plan
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  id: string
  userId: string
  token: string
  expiresAt: Date
  createdAt: Date
}

export interface ApiKey {
  id: string
  userId: string
  name: string
  keyHash: string
  lastUsedAt: Date | null
  createdAt: Date
}

export interface Workspace {
  id: string
  userId: string
  name: string
  slug: string
  logoUrl: string | null
  websiteUrl: string | null
  industry: string | null
  targetAudience: string | null
  createdAt: Date
}

export interface BrandAsset {
  id: string
  workspaceId: string
  type: BrandAssetType
  name: string
  fileUrl: string
  fileSize: number | null
  mimeType: string | null
  uploadedAt: Date
}

export interface BrandVoice {
  id: string
  workspaceId: string
  name: string
  tone: BrandVoiceTone
  keywords: string[]
  forbiddenWords: string[]
  sampleCopy: string | null
  isActive: boolean
  trainedAt: Date | null
  modelPath: string | null
  createdAt: Date
}

export interface PlatformConnection {
  id: string
  workspaceId: string
  platform: Platform
  accountId: string
  accountName: string | null
  accountAvatarUrl: string | null
  accessToken: string
  refreshToken: string | null
  tokenExpiresAt: Date | null
  isActive: boolean
  connectedAt: Date
}

export interface Campaign {
  id: string
  workspaceId: string
  name: string
  objective: CampaignObjective
  status: CampaignStatus
  budget: string | null
  startDate: string | null
  endDate: string | null
  targetAudiences: Record<string, unknown> | null
  platforms: string[]
  description: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CampaignBrief {
  id: string
  campaignId: string
  productName: string
  productDescription: string
  uniqueSellingPoints: string[]
  callToAction: string
  targetDemographics: Record<string, unknown> | null
  competitorUrls: string[]
  inspirationUrls: string[]
  createdAt: Date
}

export interface Ad {
  id: string
  workspaceId: string
  campaignId: string | null
  format: AdFormat
  platform: AdPlatform
  headline: string | null
  bodyText: string | null
  ctaText: string | null
  imageUrl: string | null
  videoUrl: string | null
  audioUrl: string | null
  thumbnailUrl: string | null
  status: AdStatus
  generationParams: Record<string, unknown> | null
  generationDurationMs: number | null
  aiModel: string | null
  createdAt: Date
}

export interface AdVariant {
  id: string
  adId: string
  variantName: string
  headline: string | null
  bodyText: string | null
  ctaText: string | null
  imageUrl: string | null
  isControl: boolean
  createdAt: Date
}

export interface AdBatch {
  id: string
  workspaceId: string
  campaignId: string | null
  batchDate: string
  totalRequested: number
  totalGenerated: number
  status: AdBatchStatus
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

export interface AdPerformance {
  id: string
  adId: string
  platform: Platform
  date: string
  impressions: number
  clicks: number
  ctr: string
  conversions: number
  spend: string
  cpc: string
  cpm: string
  roas: string
  engagementRate: string
  shares: number
  saves: number
  comments: number
  recordedAt: Date
}

export interface PerformanceInsight {
  id: string
  workspaceId: string
  insightType: InsightType
  insight: string
  confidence: string
  samplesAnalyzed: number
  discoveredAt: Date
}

export interface ModelFineTune {
  id: string
  workspaceId: string
  modelType: ModelType
  status: FineTuneStatus
  samplesUsed: number
  baseModel: string | null
  outputModelPath: string | null
  startedAt: Date | null
  completedAt: Date | null
  metrics: Record<string, unknown> | null
  createdAt: Date
}

export interface ScheduledPost {
  id: string
  workspaceId: string
  adId: string
  platform: Platform
  scheduledAt: Date
  publishedAt: Date | null
  status: ScheduledPostStatus
  externalPostId: string | null
  errorMessage: string | null
  createdAt: Date
}

export interface CalendarSlot {
  id: string
  workspaceId: string
  platform: Platform
  dayOfWeek: number
  hour: number
  isEnabled: boolean
  avgEngagement: string | null
  createdAt: Date
}

export interface AbTest {
  id: string
  workspaceId: string
  campaignId: string | null
  name: string
  status: AbTestStatus
  hypothesis: string | null
  metric: AbTestMetric
  startDate: string | null
  endDate: string | null
  sampleSize: number | null
  confidenceLevel: string | null
  winnerId: string | null
  createdAt: Date
}

export interface AbTestVariant {
  id: string
  testId: string
  adId: string
  trafficAllocation: string
  createdAt: Date
}

export interface DailyAnalytics {
  id: string
  workspaceId: string
  platform: Platform | null
  date: string
  totalImpressions: number
  totalClicks: number
  totalConversions: number
  totalSpend: string
  avgCtr: string
  avgRoas: string
  adsPublished: number
  recordedAt: Date
}

export interface GenerationJob {
  id: string
  workspaceId: string
  jobType: GenerationJobType
  status: GenerationJobStatus
  priority: number
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  errorMessage: string | null
  workerNode: string | null
  queuedAt: Date
  startedAt: Date | null
  completedAt: Date | null
}

// ---------------------------------------------------------------------------
// Insert types (omit auto-generated fields)
// ---------------------------------------------------------------------------

export type InsertUser = Omit<User, 'id' | 'createdAt' | 'updatedAt'>
export type InsertSession = Omit<Session, 'id' | 'createdAt'>
export type InsertApiKey = Omit<ApiKey, 'id' | 'createdAt' | 'lastUsedAt'>
export type InsertWorkspace = Omit<Workspace, 'id' | 'createdAt'>
export type InsertBrandAsset = Omit<BrandAsset, 'id' | 'uploadedAt'>
export type InsertBrandVoice = Omit<BrandVoice, 'id' | 'createdAt'>
export type InsertPlatformConnection = Omit<PlatformConnection, 'id' | 'connectedAt'>
export type InsertCampaign = Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>
export type InsertCampaignBrief = Omit<CampaignBrief, 'id' | 'createdAt'>
export type InsertAd = Omit<Ad, 'id' | 'createdAt'>
export type InsertAdVariant = Omit<AdVariant, 'id' | 'createdAt'>
export type InsertAdBatch = Omit<AdBatch, 'id' | 'createdAt'>
export type InsertAdPerformance = Omit<AdPerformance, 'id' | 'recordedAt'>
export type InsertPerformanceInsight = Omit<PerformanceInsight, 'id' | 'discoveredAt'>
export type InsertModelFineTune = Omit<ModelFineTune, 'id' | 'createdAt'>
export type InsertScheduledPost = Omit<ScheduledPost, 'id' | 'createdAt'>
export type InsertCalendarSlot = Omit<CalendarSlot, 'id' | 'createdAt'>
export type InsertAbTest = Omit<AbTest, 'id' | 'createdAt'>
export type InsertAbTestVariant = Omit<AbTestVariant, 'id' | 'createdAt'>
export type InsertDailyAnalytics = Omit<DailyAnalytics, 'id' | 'recordedAt'>
export type InsertGenerationJob = Omit<GenerationJob, 'id' | 'queuedAt'>

// ---------------------------------------------------------------------------
// Shared API response types
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiError {
  error: string
  message: string
  statusCode: number
  details?: unknown
}

export interface ApiSuccess<T = unknown> {
  data: T
  message?: string
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export interface AuthTokenPayload {
  sub: string  // user id
  email: string
  plan: Plan
  iat: number
  exp: number
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>
  token: string
  expiresAt: string
}

// ---------------------------------------------------------------------------
// Workspace helpers
// ---------------------------------------------------------------------------

export interface WorkspaceContext {
  workspace: Workspace
  role: 'owner' | 'admin' | 'member'
}

// ---------------------------------------------------------------------------
// Ad generation helpers
// ---------------------------------------------------------------------------

export interface AdGenerationRequest {
  workspaceId: string
  campaignId?: string
  format: AdFormat
  platform: AdPlatform
  brief: {
    productName: string
    productDescription: string
    uniqueSellingPoints: string[]
    callToAction: string
    targetDemographics?: Record<string, unknown>
  }
  count?: number
  priority?: number
}

export interface AdGenerationResult {
  jobId: string
  status: GenerationJobStatus
  ads?: Ad[]
}

// ---------------------------------------------------------------------------
// Analytics helpers
// ---------------------------------------------------------------------------

export interface PerformanceSummary {
  totalImpressions: number
  totalClicks: number
  totalConversions: number
  totalSpend: number
  avgCtr: number
  avgRoas: number
  adsPublished: number
  period: { from: string; to: string }
}

export interface TopPerformingAd {
  ad: Ad
  performance: PerformanceSummary
  rank: number
}

// ---------------------------------------------------------------------------
// Composite / enriched types
// ---------------------------------------------------------------------------

export interface CampaignWithBrief extends Campaign {
  brief: CampaignBrief | null
}

export interface AdWithVariants extends Ad {
  variants: AdVariant[]
}

export interface AbTestWithVariants extends AbTest {
  variants: (AbTestVariant & { ad: Ad })[]
  winner: Ad | null
}

export interface AnalyticsDashboard {
  overview: PerformanceSummary
  trends: DailyAnalytics[]
  topPerformers: TopPerformingAd[]
  insights: PerformanceInsight[]
}
