import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { db, brandAssets, brandVoices, workspaceMembers, modelFineTunes } from '../db'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { AppError } from '../middleware/error-handler'
import { config } from '../config'
import { generationQueue } from '../jobs/queue'

const router = Router({ mergeParams: true })

// Multer storage
const uploadDir = path.join(process.cwd(), 'uploads', 'brand-assets')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${unique}${path.extname(file.originalname)}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
})

const voiceSchema = z.object({
  tone: z.string().min(1).max(100),
  keywords: z.array(z.string()).default([]),
  forbiddenWords: z.array(z.string()).default([]),
  sampleCopy: z.string().optional(),
})

// Ensure user is a member of :workspaceId (injected by mergeParams)
async function assertMember(userId: string, workspaceId: string): Promise<void> {
  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1)
  if (!member) throw new AppError(403, 'Access denied', 'FORBIDDEN')
}

// GET /api/workspaces/:workspaceId/brand/assets
router.get('/assets', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const assets = await db
    .select()
    .from(brandAssets)
    .where(eq(brandAssets.workspaceId, workspaceId))
    .orderBy(brandAssets.createdAt)

  res.json(assets)
})

// POST /api/workspaces/:workspaceId/brand/assets
router.post('/assets', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  if (!req.file) throw new AppError(400, 'No file uploaded', 'NO_FILE')

  const fileUrl =
    config.storageBackend === 's3'
      ? `https://${config.s3Bucket}.s3.${config.awsRegion}.amazonaws.com/brand-assets/${req.file.filename}`
      : `/uploads/brand-assets/${req.file.filename}`

  const [asset] = await db
    .insert(brandAssets)
    .values({
      workspaceId,
      filename: req.file.originalname,
      fileUrl,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      assetType: req.file.mimetype.startsWith('video') ? 'video' : 'image',
    })
    .returning()

  res.status(201).json(asset)
})

// DELETE /api/workspaces/:workspaceId/brand/assets/:id
router.delete('/assets/:id', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId, id } = req.params
  await assertMember(req.user!.id, workspaceId)

  const [asset] = await db
    .select()
    .from(brandAssets)
    .where(and(eq(brandAssets.id, id), eq(brandAssets.workspaceId, workspaceId)))
    .limit(1)

  if (!asset) throw new AppError(404, 'Asset not found', 'NOT_FOUND')

  await db.delete(brandAssets).where(eq(brandAssets.id, id))

  res.json({ success: true })
})

// GET /api/workspaces/:workspaceId/brand/voice
router.get('/voice', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const [voice] = await db
    .select()
    .from(brandVoices)
    .where(and(eq(brandVoices.workspaceId, workspaceId), eq(brandVoices.isActive, true)))
    .limit(1)

  res.json(voice ?? null)
})

// POST /api/workspaces/:workspaceId/brand/voice
router.post('/voice', requireAuth, validate(voiceSchema), async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const { tone, keywords, forbiddenWords, sampleCopy } = req.body as z.infer<typeof voiceSchema>

  // Deactivate existing voices
  await db
    .update(brandVoices)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(brandVoices.workspaceId, workspaceId))

  const [voice] = await db
    .insert(brandVoices)
    .values({ workspaceId, tone, keywords, forbiddenWords, sampleCopy, isActive: true })
    .returning()

  res.status(201).json(voice)
})

// POST /api/workspaces/:workspaceId/brand/voice/train
router.post('/voice/train', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  if (!config.finetuneEnabled) {
    throw new AppError(403, 'Fine-tuning is not enabled', 'FINETUNE_DISABLED')
  }

  const [voice] = await db
    .select()
    .from(brandVoices)
    .where(and(eq(brandVoices.workspaceId, workspaceId), eq(brandVoices.isActive, true)))
    .limit(1)

  if (!voice) throw new AppError(404, 'No active brand voice found', 'NOT_FOUND')

  const job = await generationQueue.add('finetune', { workspaceId, brandVoiceId: voice.id }, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10_000 },
  })

  // Create a fine-tune record
  const [fineTune] = await db
    .insert(modelFineTunes)
    .values({ workspaceId, status: 'pending' })
    .returning()

  res.status(202).json({ jobId: job.id, fineTuneId: fineTune.id })
})

// GET /api/workspaces/:workspaceId/brand/voice/status
router.get('/voice/status', requireAuth, async (req: Request, res: Response) => {
  const { workspaceId } = req.params
  await assertMember(req.user!.id, workspaceId)

  const [fineTune] = await db
    .select()
    .from(modelFineTunes)
    .where(eq(modelFineTunes.workspaceId, workspaceId))
    .orderBy(modelFineTunes.createdAt)
    .limit(1)

  res.json(fineTune ?? null)
})

export default router
