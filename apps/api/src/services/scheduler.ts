import { db } from '../db'
import { generatedAds, postSchedule } from '../schema'
import { eq, and } from 'drizzle-orm'
import { addHours, addMinutes, startOfDay, addDays } from 'date-fns'

// Install date-fns: already in deps below

const PLATFORM_SLOTS: Record<string, number[]> = {
  instagram: [8, 12, 17, 20],
  facebook:  [9, 13, 18, 21],
  tiktok:    [7, 12, 16, 20],
  youtube:   [10, 15, 19],
  twitter:   [8, 11, 14, 18, 21],
  linkedin:  [8, 12, 17],
  pinterest: [9, 14, 20],
  snapchat:  [11, 16, 21],
}

export async function scheduleAdsForCampaign(campaignId: string) {
  const ads = await db.select().from(generatedAds)
    .where(and(eq(generatedAds.campaignId, campaignId), eq(generatedAds.status, 'ready')))

  const today = startOfDay(new Date())
  let adIndex = 0

  for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
    const baseDay = addDays(today, dayOffset)

    for (const [platform, slots] of Object.entries(PLATFORM_SLOTS)) {
      for (const hour of slots) {
        if (adIndex >= ads.length) break
        const ad = ads[adIndex++]
        const scheduledTime = addMinutes(addHours(baseDay, hour), Math.floor(Math.random() * 30))

        await db.insert(postSchedule).values({
          adId: ad.id,
          platform: platform as typeof postSchedule.$inferInsert['platform'],
          scheduledTime,
          status: 'scheduled',
        })
      }
    }
  }
}
