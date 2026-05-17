import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Re-export everything from the canonical lib/db schema (all original tables).
// We do NOT re-export `db` or `schema` — those are instantiated fresh in db.ts.
// ---------------------------------------------------------------------------
export {
  planEnum,
  brandAssetTypeEnum,
  brandVoiceToneEnum,
  platformEnum,
  campaignObjectiveEnum,
  campaignStatusEnum,
  adFormatEnum,
  adPlatformEnum,
  adStatusEnum,
  adBatchStatusEnum,
  insightTypeEnum,
  modelTypeEnum,
  fineTuneStatusEnum,
  scheduledPostStatusEnum,
  abTestStatusEnum,
  abTestMetricEnum,
  generationJobTypeEnum,
  generationJobStatusEnum,
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
} from '../../../lib/db/schema'

import { workspaces, users } from '../../../lib/db/schema'

// ---------------------------------------------------------------------------
// workspaceMembers — referenced by auth, workspace, calendar, brand routes
// (was missing from the original lib/db schema)
// ---------------------------------------------------------------------------
export const workspaceMemberRoleEnum = pgEnum('workspace_member_role', [
  'owner',
  'admin',
  'member',
])

export const workspaceMembers = pgTable('workspace_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: workspaceMemberRoleEnum('role').notNull().default('member'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// NEW: URL-scraper campaign tables
//
// Postgres enum names are prefixed (scrape_*, generated_*, full_*, etc.) to
// avoid collision with existing enums (campaign_status, ad_status, platform…)
// ---------------------------------------------------------------------------

export const scrapeCampaignStatusEnum = pgEnum('scrape_campaign_status', [
  'pending',
  'scraping',
  'ready',
  'failed',
])

export const generatedAdStatusEnum = pgEnum('generated_ad_status', [
  'pending',
  'generating',
  'ready',
  'approved',
  'rejected',
  'posted',
])

export const fullPlatformEnum = pgEnum('full_platform', [
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'twitter',
  'linkedin',
  'pinterest',
  'snapchat',
])

export const adPostFormatEnum = pgEnum('ad_post_format', [
  'vertical_video',
  'square',
  'landscape',
  'carousel',
])

export const schedPostStatusEnum = pgEnum('sched_post_status', [
  'scheduled',
  'posted',
  'failed',
  'cancelled',
])

// url_campaigns: scraper-driven campaigns (distinct from workspace `campaigns` table)
export const urlCampaigns = pgTable('url_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  brandName: text('brand_name').notNull().default(''),
  scrapedData: jsonb('scraped_data'),
  status: scrapeCampaignStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const generatedAds = pgTable('generated_ads', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => urlCampaigns.id, { onDelete: 'cascade' }),
  platform: fullPlatformEnum('platform').notNull(),
  format: adPostFormatEnum('format').notNull(),
  headline: text('headline').notNull().default(''),
  body: text('body').notNull().default(''),
  cta: text('cta').notNull().default(''),
  hashtags: text('hashtags').array().notNull().default([]),
  mediaUrl: text('media_url'),
  status: generatedAdStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const postSchedule = pgTable('post_schedule', {
  id: uuid('id').primaryKey().defaultRandom(),
  adId: uuid('ad_id')
    .notNull()
    .references(() => generatedAds.id, { onDelete: 'cascade' }),
  platform: fullPlatformEnum('platform').notNull(),
  scheduledTime: timestamp('scheduled_time').notNull(),
  status: schedPostStatusEnum('status').notNull().default('scheduled'),
  postedAt: timestamp('posted_at'),
})

export const adAnalytics = pgTable('ad_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  adId: uuid('ad_id')
    .notNull()
    .references(() => generatedAds.id, { onDelete: 'cascade' }),
  platform: fullPlatformEnum('platform').notNull(),
  views: integer('views').notNull().default(0),
  clicks: integer('clicks').notNull().default(0),
  conversions: integer('conversions').notNull().default(0),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
})
