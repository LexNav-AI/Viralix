import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, users, workspaces, workspaceMembers, sessions } from '../db'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { config } from '../config'
import { AppError } from '../middleware/error-handler'

const router = Router()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function signToken(userId: string, email: string, workspaceId: string): string {
  return jwt.sign({ id: userId, email, workspaceId }, config.jwtSecret, { expiresIn: '30d' })
}

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  const { email, password, name } = req.body as z.infer<typeof registerSchema>

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) {
    throw new AppError(409, 'Email already registered', 'EMAIL_IN_USE')
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const [user] = await db.insert(users).values({ email, passwordHash, name }).returning()

  // Create default workspace
  const [workspace] = await db
    .insert(workspaces)
    .values({ name: `${name}'s Workspace`, ownerId: user.id })
    .returning()

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: 'owner',
  })

  const token = signToken(user.id, user.email, workspace.id)

  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    workspace: { id: workspace.id, name: workspace.name },
  })
})

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
  }

  // Get primary workspace (owned, not deleted)
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, user.id))
    .limit(1)

  const workspaceId = workspace?.id ?? ''
  const token = signToken(user.id, user.email, workspaceId)

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    workspace: workspace ? { id: workspace.id, name: workspace.name } : null,
  })
})

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND')

  const memberWorkspaces = await db
    .select({ workspace: workspaces })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))

  res.json({
    user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    workspaces: memberWorkspaces.map((r) => r.workspace),
  })
})

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization']!
  const token = authHeader.slice(7)

  // Remove active session row if it exists (best-effort)
  await db.delete(sessions).where(eq(sessions.token, token))

  res.json({ success: true })
})

// PUT /api/auth/profile
router.put('/profile', requireAuth, async (req: Request, res: Response) => {
  const updateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    avatarUrl: z.string().url().optional(),
  })
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) throw parsed.error

  const { name, avatarUrl } = parsed.data
  const updates: Partial<typeof users.$inferInsert> = {}
  if (name !== undefined) updates.name = name
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl
  updates.updatedAt = new Date()

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, req.user!.id))
    .returning()

  res.json({ id: updated.id, email: updated.email, name: updated.name, avatarUrl: updated.avatarUrl })
})

export default router
