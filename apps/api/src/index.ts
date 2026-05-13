import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import cron from 'node-cron'
import { config } from './config'
import { errorHandler } from './middleware/error-handler'
import authRouter from './routes/auth'
import workspacesRouter from './routes/workspaces'
import brandsRouter from './routes/brands'
import campaignsRouter from './routes/campaigns'
import adsRouter from './routes/ads'
import analyticsRouter from './routes/analytics'
import calendarRouter from './routes/calendar'
import publishingRouter from './routes/publishing'
import connectionsRouter from './routes/connections'
import abTestingRouter from './routes/ab-testing'
import { initWorkers } from './jobs/queue'
import { runDailyBatchGeneration, processScheduledPosts } from './services/scheduler'
import { analyzeAllWorkspaces } from './services/performance-learner'

const app = express()

app.set('trust proxy', 1)

app.use(cors({
  origin: config.siteUrl,
  credentials: true,
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}))

app.use('/api/auth', authRouter)
app.use('/api/workspaces', workspacesRouter)
app.use('/api/workspaces/:workspaceId/brand', brandsRouter)
app.use('/api/workspaces/:workspaceId/campaigns', campaignsRouter)
app.use('/api/workspaces/:workspaceId/ads', adsRouter)
app.use('/api/workspaces/:workspaceId/analytics', analyticsRouter)
app.use('/api/workspaces/:workspaceId/calendar', calendarRouter)
app.use('/api/workspaces/:workspaceId/publishing', publishingRouter)
app.use('/api/workspaces/:workspaceId/connections', connectionsRouter)
app.use('/api/workspaces/:workspaceId/ab-tests', abTestingRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

app.use(errorHandler)

// Scheduled jobs
cron.schedule('0 2 * * *', async () => {
  console.log('[cron] Running daily batch generation')
  await runDailyBatchGeneration()
})

cron.schedule('*/5 * * * *', async () => {
  await processScheduledPosts()
})

cron.schedule('0 6 * * *', async () => {
  console.log('[cron] Running performance analysis')
  await analyzeAllWorkspaces()
})

initWorkers()

app.listen(config.port, () => {
  console.log(`Viralix API running on port ${config.port} [${config.nodeEnv}]`)
})

export default app
