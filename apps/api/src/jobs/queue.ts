import { Queue, Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { config } from '../config'

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null })

// ─── Queues ──────────────────────────────────────────────────────────────────

export const generationQueue = new Queue('ad-generation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
})

export const schedulerQueue = new Queue('scheduler', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
})

export const learningQueue = new Queue('performance-learning', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
})

// ─── Worker Initialisation ───────────────────────────────────────────────────

export async function initWorkers(): Promise<void> {
  // Import handlers lazily to avoid circular deps at module load time
  const { processAdGenerationJob } = await import('../services/campaign-generator')
  const { publish } = await import('../services/publisher')
  const { analyzeWorkspacePerformance } = await import('../services/performance-learner')

  // Ad generation worker — long timeout for video jobs
  new Worker(
    'ad-generation',
    async (job: Job) => {
      if (job.name === 'generate-ad') {
        await processAdGenerationJob(job.data.jobId as string)
      } else if (job.name === 'finetune') {
        // Fine-tune jobs are handled by the Llama worker directly; just log
        console.log(`[GenerationWorker] Fine-tune job for workspace ${job.data.workspaceId as string}`)
      }
    },
    {
      connection,
      concurrency: 4,
      lockDuration: 10 * 60 * 1000, // 10 min for video jobs
    },
  )

  // Scheduler / publisher worker
  new Worker(
    'scheduler',
    async (job: Job) => {
      if (job.name === 'PUBLISH_POST') {
        await publish(job.data.scheduledPostId as string)
      }
    },
    {
      connection,
      concurrency: 8,
      lockDuration: 2 * 60 * 1000,
    },
  )

  // Performance learning worker
  new Worker(
    'performance-learning',
    async (job: Job) => {
      if (job.name === 'analyze-workspace') {
        await analyzeWorkspacePerformance(job.data.workspaceId as string)
      }
    },
    {
      connection,
      concurrency: 2,
      lockDuration: 5 * 60 * 1000,
    },
  )

  console.log('[BullMQ] Workers started for queues: ad-generation, scheduler, performance-learning')
}
