import { Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { config } from '../config'
import { processAdGenerationJob } from '../services/campaign-generator'

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null })

export const generationWorker = new Worker(
  'ad-generation',
  async (job: Job) => {
    if (job.name === 'generate-ad') {
      const { jobId } = job.data as { jobId: string }
      console.log(`[GenerationWorker] Processing job ${jobId}`)
      await processAdGenerationJob(jobId)
      console.log(`[GenerationWorker] Completed job ${jobId}`)
    } else if (job.name === 'finetune') {
      console.log(`[GenerationWorker] Fine-tune job for workspace ${(job.data as { workspaceId: string }).workspaceId}`)
    }
  },
  {
    connection,
    concurrency: 4,
    lockDuration: 10 * 60 * 1000,
  },
)

generationWorker.on('failed', (job, err) => {
  console.error(`[GenerationWorker] Job ${job?.id ?? 'unknown'} failed:`, err)
})
