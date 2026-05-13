import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { db, workspaces, workspaceMembers, brandVoices, platformConnections } from '../db'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { AppError } from '../middleware/error-handler'

const router = Router()

const createSchema = z.object({
  name: z.string().min(1).max(255),
  industry: z.string().max(255).optional(),
  targetAudience: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  industry: z.string().max(255).optional(),
  targetAudience: z.string().optional(),
})

// GET /api/workspaces
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id

  const rows = await db
    .select({ workspace: workspaces })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaceMembers.userId, userId), isNull(workspaces.deletedAt)))

  res.json(rows.map((r) => r.workspace))
})

// POST /api/workspaces
router.post('/', requireAuth, validate(createSchema), async (req: Request, res: Response) => {
  const { name, industry, targetAudience } = req.body as z.infer<typeof createSchema>
  const userId = req.user!.id

  const [workspace] = await db
    .insert(workspaces)
    .values({ name, industry, targetAudience, ownerId: userId })
    .returning()

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId,
    role: 'owner',
  })

  res.status(201).json(workspace)
})

// GET /api/workspaces/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params
  const userId = req.user!.id

  await assertMember(userId, id)

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, id), isNull(workspaces.deletedAt)))
    .limit(1)

  if (!workspace) throw new AppError(404, 'Workspace not found', 'NOT_FOUND')

  const [voice] = await db
    .select()
    .from(brandVoices)
    .where(and(eq(brandVoices.workspaceId, id), eq(brandVoices.isActive, true)))
    .limit(1)

  const connections = await db
    .select()
    .from(platformConnections)
    .where(and(eq(platformConnections.workspaceId, id), eq(platformConnections.isActive, true)))

  res.json({ ...workspace, brandVoice: voice ?? null, connections })
})

// PUT /api/workspaces/:id
router.put('/:id', requireAuth, validate(updateSchema), async (req: Request, res: Response) => {
  const { id } = req.params
  const userId = req.user!.id

  await assertMember(userId, id)

  const { name, industry, targetAudience } = req.body as z.infer<typeof updateSchema>
  const updates: Partial<typeof workspaces.$inferInsert> = { updatedAt: new Date() }
  if (name !== undefined) updates.name = name
  if (industry !== undefined) updates.industry = industry
  if (targetAudience !== undefined) updates.targetAudience = targetAudience

  const [updated] = await db.update(workspaces).set(updates).where(eq(workspaces.id, id)).returning()
  if (!updated) throw new AppError(404, 'Workspace not found', 'NOT_FOUND')

  res.json(updated)
})

// DELETE /api/workspaces/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params
  const userId = req.user!.id

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1)
  if (!workspace) throw new AppError(404, 'Workspace not found', 'NOT_FOUND')
  if (workspace.ownerId !== userId) throw new AppError(403, 'Only the owner can delete this workspace', 'FORBIDDEN')

  await db.update(workspaces).set({ deletedAt: new Date() }).where(eq(workspaces.id, id))

  res.json({ success: true })
})

async function assertMember(userId: string, workspaceId: string): Promise<void> {
  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1)
  if (!member) throw new AppError(403, 'Access denied', 'FORBIDDEN')
}

export default router
