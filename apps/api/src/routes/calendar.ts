import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { and, eq, gte, lte } from 'drizzle-orm'
import { addDays, startOfDay, setHours, setMinutes, format } from 'date-fns'
import { db, calendarSlots, scheduledPosts, ads, workspaceMembers } from '../db'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { AppError } from '../middleware/error-handler'

const router = Router({ mergeParams: true })

type ScheduledPostPlatform = 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'twitter'
type CalendarPlatform = 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'twitter'

async function assertMember(userId: string, workspaceId: string): Promise<void> {
  const [m] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1)
  if (!m) throw new AppError(403, 'Access denied', 'FORBIDDEN')
}

// GET /api/workspaces/:workspaceId/calendar?month=YYYY-MM
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string
  await assertMember(req.user!.id, workspaceId)

  const monthParam = (req.query.month as string) || format(new Date(), 'yyyy-MM')
  const [yearStr, monthStr] = monthParam.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) - 1 // 0-based

  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0, 23, 59, 59)

  const posts = await db
    .select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.workspaceId, workspaceId),
        gte(scheduledPosts.scheduledAt, startDate),
        lte(scheduledPosts.scheduledAt, endDate),
      ),
    )
    .orderBy(scheduledPosts.scheduledAt)

  // Group by day
  const dayMap: Record<string, typeof posts> = {}
  for (const post of posts) {
    const day = format(post.scheduledAt, 'yyyy-MM-dd')
    if (!dayMap[day]) dayMap[day] = []
    dayMap[day].push(post)
  }

  const days = Object.entries(dayMap).map(([date, dayPosts]) => ({
    date,
    posts: dayPosts,
    count: dayPosts.length,
  }))

  res.json({ month: monthParam, days })
})

// GET /api/workspaces/:workspaceId/calendar/slots
router.get('/slots', requireAuth, async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string
  await assertMember(req.user!.id, workspaceId)

  const slots = await db
    .select()
    .from(calendarSlots)
    .where(eq(calendarSlots.workspaceId, workspaceId))
    .orderBy(calendarSlots.platform, calendarSlots.dayOfWeek, calendarSlots.hour)

  // If no slots configured, return sensible defaults
  if (slots.length === 0) {
    const defaults = generateDefaultSlots(workspaceId)
    res.json(defaults)
    return
  }

  res.json(slots)
})

// PUT /api/workspaces/:workspaceId/calendar/slots
router.put(
  '/slots',
  requireAuth,
  validate(
    z.object({
      slots: z.array(
        z.object({
          platform: z.string(),
          dayOfWeek: z.number().int().min(0).max(6),
          hour: z.number().int().min(0).max(23),
          minute: z.number().int().min(0).max(59).default(0),
          isEnabled: z.boolean().default(true),
        }),
      ),
    }),
  ),
  async (req: Request, res: Response) => {
    const workspaceId = req.params.workspaceId as string
    await assertMember(req.user!.id, workspaceId)

    const { slots } = req.body as {
      slots: Array<{ platform: string; dayOfWeek: number; hour: number; minute: number; isEnabled: boolean }>
    }

    // Delete existing slots and replace
    await db.delete(calendarSlots).where(eq(calendarSlots.workspaceId, workspaceId))

    if (slots.length > 0) {
      const inserted = await db
        .insert(calendarSlots)
        .values(slots.map((s) => ({
          workspaceId,
          platform: s.platform as CalendarPlatform,
          dayOfWeek: s.dayOfWeek,
          hour: s.hour,
          isEnabled: s.isEnabled,
        })))
        .returning()
      res.json(inserted)
    } else {
      res.json([])
    }
  },
)

// POST /api/workspaces/:workspaceId/calendar/auto-schedule
router.post('/auto-schedule', requireAuth, async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string
  await assertMember(req.user!.id, workspaceId)

  // Get enabled slots
  const slots = await db
    .select()
    .from(calendarSlots)
    .where(and(eq(calendarSlots.workspaceId, workspaceId), eq(calendarSlots.isEnabled, true)))

  if (slots.length === 0) {
    throw new AppError(400, 'No calendar slots configured. Set up posting slots first.', 'NO_SLOTS')
  }

  // Get ready ads that are not yet scheduled
  const readyAds = await db
    .select()
    .from(ads)
    .where(and(eq(ads.workspaceId, workspaceId), eq(ads.status, 'ready')))
    .limit(200)

  if (readyAds.length === 0) {
    res.json({ scheduled: 0, message: 'No ready ads to schedule' })
    return
  }

  const now = new Date()
  const horizon = addDays(now, 30)

  // Generate all slot times in the next 30 days
  const slotTimes: Array<{ platform: string; time: Date }> = []
  let current = addDays(startOfDay(now), 1) // start tomorrow

  while (current <= horizon) {
    const dow = current.getDay()
    const matchingSlots = slots.filter((s) => s.dayOfWeek === dow)
    for (const slot of matchingSlots) {
      const slotTime = setMinutes(setHours(new Date(current), slot.hour), 0)
      if (slotTime > now) {
        slotTimes.push({ platform: slot.platform, time: slotTime })
      }
    }
    current = addDays(current, 1)
  }

  slotTimes.sort((a, b) => a.time.getTime() - b.time.getTime())

  let adIndex = 0
  const createdPosts: typeof scheduledPosts.$inferInsert[] = []

  for (const slot of slotTimes) {
    if (adIndex >= readyAds.length) break

    const ad = readyAds[adIndex++]

    // Only schedule for matching platform or any if no platform match
    const platformMatch = ad.platform === slot.platform

    if (!platformMatch) {
      // Try to find a matching ad for this slot platform
      const matchIdx = readyAds.findIndex((a, i) => i >= adIndex - 1 && a.platform === slot.platform)
      if (matchIdx === -1) continue
    }

    createdPosts.push({
      workspaceId,
      adId: ad.id,
      platform: slot.platform as ScheduledPostPlatform,
      scheduledAt: slot.time,
      status: 'scheduled',
    })
  }

  let inserted: (typeof scheduledPosts.$inferSelect)[] = []
  if (createdPosts.length > 0) {
    inserted = await db.insert(scheduledPosts).values(createdPosts).returning()
  }

  res.json({ scheduled: inserted.length, posts: inserted })
})

function generateDefaultSlots(
  workspaceId: string,
): Array<{ workspaceId: string; platform: string; dayOfWeek: number; hour: number; isEnabled: boolean }> {
  const platforms = ['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter']
  // Optimal times: Tue/Thu/Sat at 9am and 6pm UTC
  const days = [2, 4, 6]
  const hours = [9, 18]

  const defaults = []
  for (const platform of platforms) {
    for (const day of days) {
      for (const hour of hours) {
        defaults.push({ workspaceId, platform, dayOfWeek: day, hour, isEnabled: true })
      }
    }
  }
  return defaults
}

export default router
