import { eq, and, isNull, lte, sql } from 'drizzle-orm'
import { db, campaigns, workspaces, calendarSlots, ads, scheduledPosts, generationJobs } from '../db'
import { generationQueue, schedulerQueue } from '../jobs/queue'
import { generateAdBatch } from './campaign-generator'
import { publish } from './publisher'
import { addDays, startOfDay, setHours, setMinutes } from 'date-fns'

export async function runDailyBatchGeneration(): Promise<void> {
  console.log('[Scheduler] runDailyBatchGeneration starting')

  // Get all active workspaces with at least one active campaign
  const activeCampaigns = await db
    .select({
      workspaceId: campaigns.workspaceId,
      campaignId: campaigns.id,
    })
    .from(campaigns)
    .innerJoin(workspaces, eq(campaigns.workspaceId, workspaces.id))
    .where(
      and(
        eq(campaigns.status, 'active'),
        isNull(campaigns.archivedAt),
        isNull(workspaces.deletedAt),
      ),
    )

  if (activeCampaigns.length === 0) {
    console.log('[Scheduler] No active campaigns found')
    return
  }

  const todayStart = startOfDay(new Date())
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  for (const { workspaceId, campaignId } of activeCampaigns) {
    try {
      // Count ads generated today for this workspace
      const [countRow] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(generationJobs)
        .where(
          and(
            eq(generationJobs.workspaceId, workspaceId),
            sql`${generationJobs.createdAt} >= ${todayStart}`,
            sql`${generationJobs.createdAt} < ${todayEnd}`,
          ),
        )

      const generatedToday = Number(countRow?.count ?? 0)
      const target = 14
      const remaining = target - generatedToday

      if (remaining <= 0) {
        console.log(`[Scheduler] Workspace ${workspaceId} already has ${generatedToday} jobs today`)
        continue
      }

      console.log(`[Scheduler] Generating ${remaining} ads for workspace ${workspaceId}, campaign ${campaignId}`)
      await generateAdBatch(workspaceId, campaignId, remaining)
    } catch (err) {
      console.error(`[Scheduler] Error generating ads for workspace ${workspaceId}:`, err)
    }
  }

  console.log('[Scheduler] runDailyBatchGeneration complete')
}

export async function processScheduledPosts(): Promise<void> {
  const now = new Date()

  const duePosts = await db
    .select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.status, 'scheduled'),
        lte(scheduledPosts.scheduledAt, now),
      ),
    )
    .limit(50)

  if (duePosts.length === 0) return

  console.log(`[Scheduler] Processing ${duePosts.length} due scheduled posts`)

  for (const post of duePosts) {
    try {
      // Enqueue each as a BullMQ job so failures are tracked/retried
      await schedulerQueue.add(
        'PUBLISH_POST',
        { scheduledPostId: post.id },
        {
          jobId: `publish-${post.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
        },
      )
    } catch (err) {
      console.error(`[Scheduler] Failed to enqueue post ${post.id}:`, err)
    }
  }
}
