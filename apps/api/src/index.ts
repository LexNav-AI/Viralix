import express from 'express'
import cors from 'cors'
import { config } from './config'
import { startGenerationWorker } from './workers/generation'

// --- Existing feature routes ---
import authRouter from './routes/auth'
import workspacesRouter from './routes/workspaces'
import brandsRouter from './routes/brands'
import workspaceCampaignsRouter from './routes/campaigns'
import workspaceAdsRouter from './routes/ads'
import analyticsRouter from './routes/analytics'
import calendarRouter from './routes/calendar'
import publishingRouter from './routes/publishing'
import connectionsRouter from './routes/connections'
import abTestingRouter from './routes/ab-testing'

// --- New scraper-campaign routes ---
import scraperCampaignsRouter from './routes/scraper-campaigns'
import scraperAdsRouter from './routes/scraper-ads'
import scheduleRouter from './routes/schedule'
import adAnalyticsRouter from './routes/ad-analytics'

const app = express()

app.use(cors({ origin: config.frontendUrl }))
app.use(express.json())

// Existing routes
app.use('/api/auth', authRouter)
app.use('/api/workspaces', workspacesRouter)
app.use('/api/brands', brandsRouter)
app.use('/api/ws-campaigns', workspaceCampaignsRouter)
app.use('/api/ws-ads', workspaceAdsRouter)
app.use('/api/analytics', analyticsRouter)
app.use('/api/calendar', calendarRouter)
app.use('/api/publishing', publishingRouter)
app.use('/api/connections', connectionsRouter)
app.use('/api/ab-testing', abTestingRouter)

// New scraper-campaign routes (dashboard-facing)
app.use('/api/campaigns', scraperCampaignsRouter)
app.use('/api/ads', scraperAdsRouter)
app.use('/api/schedule', scheduleRouter)
app.use('/api/ad-analytics', adAnalyticsRouter)

app.get('/api/health', (_req, res) => res.json({ ok: true, version: '2.0' }))

app.listen(config.port, () => {
  console.log(`Viralix API running on port ${config.port}`)
  startGenerationWorker()
})
