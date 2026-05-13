import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  date,
  index,
} from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const planEnum = pgEnum('plan', ['free', 'starter', 'growth', 'scale'])

export const brandAssetTypeEnum = pgEnum('brand_asset_type', [
  'logo',
  'font',
  'color_palette',
  'image',
  'document',
])

export const brandVoiceToneEnum = pgEnum('brand_voice_tone', [
  'professional',
  'casual',
  'bold',
  'playful',
  'luxurious',
  'minimalist',
])

export const platformEnum = pgEnum('platform', [
  'facebook',
  'instagram',
  'tiktok',
  'linkedin',
  'twitter',
])

export const campaignObjectiveEnum = pgEnum('campaign_objective', [
  'awareness',
  'traffic',
  'engagement',
  'leads',
  'conversions',
  'sales',
])

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft',
  'active',
  'paused',
  'completed',
  'archived',
])

export const adFormatEnum = pgEnum('ad_format', [
  'static_image',
  'carousel',
  'video',
  'story',
  'reel',
  'banner_300x250',
  'banner_728x90',
  'banner_160x600',
])

export const adPlatformEnum = pgEnum('ad_platform', [
  'facebook',
  'instagram',
  'tiktok',
  'linkedin',
  'twitter',
  'universal',
])

export const adStatusEnum = pgEnum('ad_status', [
  'generating',
  'ready',
  'published',
  'failed',
  'archived',
])

export const adBatchStatusEnum = pgEnum('ad_batch_status', [
  'pending',
  'running',
  'completed',
  'failed',
])

export const insightTypeEnum = pgEnum('insight_type', [
  'headline_pattern',
  'cta_pattern',
  'visual_style',
  'audience_segment',
  'posting_time',
  'format',
])

export const modelTypeEnum = pgEnum('model_type', [
  'llama',
  'sdxl',
  'animatediff',
])

export const fineTuneStatusEnum = pgEnum('fine_tune_status', [
  'pending',
  'running',
  'completed',
  'failed',
])

export const scheduledPostStatusEnum = pgEnum('scheduled_post_status', [
  'scheduled',
  'published',
  'failed',
  'cancelled',
])

export const abTestStatusEnum = pgEnum('ab_test_status', [
  'draft',
  'running',
  'paused',
  'completed',
])

export const abTestMetricEnum = pgEnum('ab_test_metric', [
  'ctr',
  'conversions',
  'engagement',
  'roas',
])

export const generationJobTypeEnum = pgEnum('generation_job_type', [
  'ad_copy',
  'image',
  'video',
  'audio',
  'batch',
])

export const generationJobStatusEnum = pgEnum('generation_job_status', [
  'queued',
  'running',
  'completed',
  'failed',
])

// ---------------------------------------------------------------------------
// USERS & AUTH
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    avatarUrl: text('avatar_url'),
    plan: planEnum('plan').notNull().default('free'),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('users_email_idx').on(t.email)],
)

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('sessions_user_id_idx').on(t.userId),
    index('sessions_token_idx').on(t.token),
  ],
)

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull().unique(),
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('api_keys_user_id_idx').on(t.userId)],
)

// ---------------------------------------------------------------------------
// WORKSPACES / BRANDS
// ---------------------------------------------------------------------------

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    logoUrl: text('logo_url'),
    websiteUrl: text('website_url'),
    industry: text('industry'),
    targetAudience: text('target_audience'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('workspaces_user_id_idx').on(t.userId),
    index('workspaces_slug_idx').on(t.slug),
  ],
)

export const brandAssets = pgTable(
  'brand_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    type: brandAssetTypeEnum('type').notNull(),
    name: text('name').notNull(),
    fileUrl: text('file_url').notNull(),
    fileSize: integer('file_size'),
    mimeType: text('mime_type'),
    uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  },
  (t) => [index('brand_assets_workspace_id_idx').on(t.workspaceId)],
)

export const brandVoices = pgTable(
  'brand_voices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tone: brandVoiceToneEnum('tone').notNull().default('professional'),
    keywords: text('keywords').array().notNull().default([]),
    forbiddenWords: text('forbidden_words').array().notNull().default([]),
    sampleCopy: text('sample_copy'),
    isActive: boolean('is_active').notNull().default(true),
    trainedAt: timestamp('trained_at'),
    modelPath: text('model_path'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('brand_voices_workspace_id_idx').on(t.workspaceId)],
)

// ---------------------------------------------------------------------------
// PLATFORM CONNECTIONS
// ---------------------------------------------------------------------------

export const platformConnections = pgTable(
  'platform_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    platform: platformEnum('platform').notNull(),
    accountId: text('account_id').notNull(),
    accountName: text('account_name'),
    accountAvatarUrl: text('account_avatar_url'),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at'),
    isActive: boolean('is_active').notNull().default(true),
    connectedAt: timestamp('connected_at').notNull().defaultNow(),
  },
  (t) => [
    index('platform_connections_workspace_id_idx').on(t.workspaceId),
    index('platform_connections_platform_idx').on(t.platform),
  ],
)

// ---------------------------------------------------------------------------
// CAMPAIGNS
// ---------------------------------------------------------------------------

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    objective: campaignObjectiveEnum('objective').notNull().default('awareness'),
    status: campaignStatusEnum('status').notNull().default('draft'),
    budget: numeric('budget', { precision: 14, scale: 2 }),
    startDate: date('start_date'),
    endDate: date('end_date'),
    targetAudiences: jsonb('target_audiences').$type<Record<string, unknown>>(),
    platforms: text('platforms').array().notNull().default([]),
    description: text('description'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('campaigns_workspace_id_idx').on(t.workspaceId),
    index('campaigns_status_idx').on(t.status),
  ],
)

export const campaignBriefs = pgTable('campaign_briefs', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  productName: text('product_name').notNull(),
  productDescription: text('product_description').notNull(),
  uniqueSellingPoints: text('unique_selling_points').array().notNull().default([]),
  callToAction: text('call_to_action').notNull(),
  targetDemographics: jsonb('target_demographics').$type<Record<string, unknown>>(),
  competitorUrls: text('competitor_urls').array().notNull().default([]),
  inspirationUrls: text('inspiration_urls').array().notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// AD GENERATION
// ---------------------------------------------------------------------------

export const ads = pgTable(
  'ads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id').references(() => campaigns.id, {
      onDelete: 'set null',
    }),
    format: adFormatEnum('format').notNull(),
    platform: adPlatformEnum('platform').notNull(),
    headline: text('headline'),
    bodyText: text('body_text'),
    ctaText: text('cta_text'),
    imageUrl: text('image_url'),
    videoUrl: text('video_url'),
    audioUrl: text('audio_url'),
    thumbnailUrl: text('thumbnail_url'),
    status: adStatusEnum('status').notNull().default('generating'),
    generationParams: jsonb('generation_params').$type<Record<string, unknown>>(),
    generationDurationMs: integer('generation_duration_ms'),
    aiModel: text('ai_model'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('ads_workspace_id_idx').on(t.workspaceId),
    index('ads_campaign_id_idx').on(t.campaignId),
    index('ads_status_idx').on(t.status),
    index('ads_platform_idx').on(t.platform),
  ],
)

export const adVariants = pgTable(
  'ad_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adId: uuid('ad_id')
      .notNull()
      .references(() => ads.id, { onDelete: 'cascade' }),
    variantName: text('variant_name').notNull(),
    headline: text('headline'),
    bodyText: text('body_text'),
    ctaText: text('cta_text'),
    imageUrl: text('image_url'),
    isControl: boolean('is_control').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('ad_variants_ad_id_idx').on(t.adId)],
)

export const adBatches = pgTable(
  'ad_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id').references(() => campaigns.id, {
      onDelete: 'set null',
    }),
    batchDate: date('batch_date').notNull(),
    totalRequested: integer('total_requested').notNull().default(0),
    totalGenerated: integer('total_generated').notNull().default(0),
    status: adBatchStatusEnum('status').notNull().default('pending'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('ad_batches_workspace_id_idx').on(t.workspaceId)],
)

// ---------------------------------------------------------------------------
// PERFORMANCE & LEARNING
// ---------------------------------------------------------------------------

export const adPerformance = pgTable(
  'ad_performance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adId: uuid('ad_id')
      .notNull()
      .references(() => ads.id, { onDelete: 'cascade' }),
    platform: platformEnum('platform').notNull(),
    date: date('date').notNull(),
    impressions: integer('impressions').notNull().default(0),
    clicks: integer('clicks').notNull().default(0),
    ctr: numeric('ctr', { precision: 8, scale: 6 }).notNull().default('0'),
    conversions: integer('conversions').notNull().default(0),
    spend: numeric('spend', { precision: 14, scale: 4 }).notNull().default('0'),
    cpc: numeric('cpc', { precision: 10, scale: 4 }).notNull().default('0'),
    cpm: numeric('cpm', { precision: 10, scale: 4 }).notNull().default('0'),
    roas: numeric('roas', { precision: 10, scale: 4 }).notNull().default('0'),
    engagementRate: numeric('engagement_rate', { precision: 8, scale: 6 }).notNull().default('0'),
    shares: integer('shares').notNull().default(0),
    saves: integer('saves').notNull().default(0),
    comments: integer('comments').notNull().default(0),
    recordedAt: timestamp('recorded_at').notNull().defaultNow(),
  },
  (t) => [
    index('ad_performance_ad_id_idx').on(t.adId),
    index('ad_performance_date_idx').on(t.date),
    index('ad_performance_platform_idx').on(t.platform),
  ],
)

export const performanceInsights = pgTable(
  'performance_insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    insightType: insightTypeEnum('insight_type').notNull(),
    insight: text('insight').notNull(),
    confidence: numeric('confidence', { precision: 5, scale: 4 }).notNull().default('0'),
    samplesAnalyzed: integer('samples_analyzed').notNull().default(0),
    discoveredAt: timestamp('discovered_at').notNull().defaultNow(),
  },
  (t) => [
    index('performance_insights_workspace_id_idx').on(t.workspaceId),
    index('performance_insights_type_idx').on(t.insightType),
  ],
)

export const modelFineTunes = pgTable(
  'model_fine_tunes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    modelType: modelTypeEnum('model_type').notNull(),
    status: fineTuneStatusEnum('status').notNull().default('pending'),
    samplesUsed: integer('samples_used').notNull().default(0),
    baseModel: text('base_model'),
    outputModelPath: text('output_model_path'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    metrics: jsonb('metrics').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('model_fine_tunes_workspace_id_idx').on(t.workspaceId)],
)

// ---------------------------------------------------------------------------
// CONTENT CALENDAR
// ---------------------------------------------------------------------------

export const scheduledPosts = pgTable(
  'scheduled_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    adId: uuid('ad_id')
      .notNull()
      .references(() => ads.id, { onDelete: 'cascade' }),
    platform: platformEnum('platform').notNull(),
    scheduledAt: timestamp('scheduled_at').notNull(),
    publishedAt: timestamp('published_at'),
    status: scheduledPostStatusEnum('status').notNull().default('scheduled'),
    externalPostId: text('external_post_id'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('scheduled_posts_workspace_id_idx').on(t.workspaceId),
    index('scheduled_posts_scheduled_at_idx').on(t.scheduledAt),
    index('scheduled_posts_status_idx').on(t.status),
  ],
)

export const calendarSlots = pgTable(
  'calendar_slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    platform: platformEnum('platform').notNull(),
    dayOfWeek: integer('day_of_week').notNull(), // 0 = Sunday, 6 = Saturday
    hour: integer('hour').notNull(), // 0-23 UTC
    isEnabled: boolean('is_enabled').notNull().default(true),
    avgEngagement: numeric('avg_engagement', { precision: 8, scale: 4 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('calendar_slots_workspace_id_idx').on(t.workspaceId)],
)

// ---------------------------------------------------------------------------
// A/B TESTING
// ---------------------------------------------------------------------------

export const abTests = pgTable(
  'ab_tests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id').references(() => campaigns.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    status: abTestStatusEnum('status').notNull().default('draft'),
    hypothesis: text('hypothesis'),
    metric: abTestMetricEnum('metric').notNull().default('ctr'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    sampleSize: integer('sample_size'),
    confidenceLevel: numeric('confidence_level', { precision: 5, scale: 4 }),
    winnerId: uuid('winner_id').references(() => ads.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('ab_tests_workspace_id_idx').on(t.workspaceId)],
)

export const abTestVariants = pgTable(
  'ab_test_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    testId: uuid('test_id')
      .notNull()
      .references(() => abTests.id, { onDelete: 'cascade' }),
    adId: uuid('ad_id')
      .notNull()
      .references(() => ads.id, { onDelete: 'cascade' }),
    trafficAllocation: numeric('traffic_allocation', { precision: 5, scale: 4 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('ab_test_variants_test_id_idx').on(t.testId)],
)

// ---------------------------------------------------------------------------
// ANALYTICS AGGREGATES
// ---------------------------------------------------------------------------

export const dailyAnalytics = pgTable(
  'daily_analytics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    platform: platformEnum('platform'),
    date: date('date').notNull(),
    totalImpressions: integer('total_impressions').notNull().default(0),
    totalClicks: integer('total_clicks').notNull().default(0),
    totalConversions: integer('total_conversions').notNull().default(0),
    totalSpend: numeric('total_spend', { precision: 14, scale: 4 }).notNull().default('0'),
    avgCtr: numeric('avg_ctr', { precision: 8, scale: 6 }).notNull().default('0'),
    avgRoas: numeric('avg_roas', { precision: 10, scale: 4 }).notNull().default('0'),
    adsPublished: integer('ads_published').notNull().default(0),
    recordedAt: timestamp('recorded_at').notNull().defaultNow(),
  },
  (t) => [
    index('daily_analytics_workspace_id_idx').on(t.workspaceId),
    index('daily_analytics_date_idx').on(t.date),
    index('daily_analytics_platform_idx').on(t.platform),
  ],
)

// ---------------------------------------------------------------------------
// GENERATION QUEUE
// ---------------------------------------------------------------------------

export const generationJobs = pgTable(
  'generation_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    jobType: generationJobTypeEnum('job_type').notNull(),
    status: generationJobStatusEnum('status').notNull().default('queued'),
    priority: integer('priority').notNull().default(5),
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
    result: jsonb('result').$type<Record<string, unknown>>(),
    errorMessage: text('error_message'),
    workerNode: text('worker_node'),
    queuedAt: timestamp('queued_at').notNull().defaultNow(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
  },
  (t) => [
    index('generation_jobs_workspace_id_idx').on(t.workspaceId),
    index('generation_jobs_status_idx').on(t.status),
    index('generation_jobs_priority_idx').on(t.priority),
  ],
)

// ---------------------------------------------------------------------------
// DB connection helper
// ---------------------------------------------------------------------------

export const schema = {
  users,
  sessions,
  apiKeys,
  workspaces,
  brandAssets,
  brandVoices,
  platformConnections,
  campaigns,
  campaignBriefs,
  ads,
  adVariants,
  adBatches,
  adPerformance,
  performanceInsights,
  modelFineTunes,
  scheduledPosts,
  calendarSlots,
  abTests,
  abTestVariants,
  dailyAnalytics,
  generationJobs,
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export const db = drizzle(pool, { schema })
