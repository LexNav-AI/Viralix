import { Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { config } from '../config'
import { publish } from '../services/publisher'

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null })

export const schedulerWorker = new Worker(
  'scheduler',
  async (job: Job) => {
    if (job.name === 'PUBLISH_POST') {
      const { scheduledPostId } = job.data as { scheduledPostId: string }
      console.log(`[SchedulerWorker] Publishing post ${scheduledPostId}`)
      await publish(scheduledPostId)
      console.log(`[SchedulerWorker] Published post ${scheduledPostId}`)
    }
  },
  {
    connection,
    concurrency: 8,
    lockDuration: 2 * 60 * 1000,
  },
)

schedulerWorker.on('failed', (job, err) => {
  console.error(`[SchedulerWorker] Job ${job?.id ?? 'unknown'} failed:`, err)
})
