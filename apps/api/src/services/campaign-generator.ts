import { eq, and } from 'drizzle-orm'
import { db, ads, campaigns, campaignBriefs, brandVoices, generationJobs, workspaces } from '../db'
import { generationQueue } from '../jobs/queue'
import * as llamaClient from './ai/llama-client'
import * as sdClient from './ai/sd-client'
import * as cogvideoClient from './ai/cogvideo-client'
import * as ttsClient from './ai/tts-client'
import * as ffmpegClient from './ai/ffmpeg-client'
import { getTopPerformingExamples } from './performance-learner'

type AdFormat =
  | 'instagram_post'
  | 'instagram_story'
  | 'instagram_reel'
  | 'facebook_feed'
  | 'facebook_story'
  | 'tiktok_video'
  | 'linkedin_post'
  | 'twitter_post'
  | 'youtube_pre_roll'
  | 'display_banner_728x90'
  | 'display_banner_300x250'
  | 'display_banner_160x600'
  | 'display_banner_320x50'
  | 'pinterest_pin'

type Platform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'twitter'
  | 'youtube'
  | 'pinterest'

interface FormatSpec {
  width: number
  height: number
  isVideo: boolean
  platform: Platform
}

const FORMAT_SPECS: Record<AdFormat, FormatSpec> = {
  instagram_post: { width: 1080, height: 1080, isVideo: false, platform: 'instagram' },
  instagram_story: { width: 1080, height: 1920, isVideo: false, platform: 'instagram' },
  instagram_reel: { width: 1080, height: 1920, isVideo: true, platform: 'instagram' },
  facebook_feed: { width: 1200, height: 628, isVideo: false, platform: 'facebook' },
  facebook_story: { width: 1080, height: 1920, isVideo: false, platform: 'facebook' },
  tiktok_video: { width: 1080, height: 1920, isVideo: true, platform: 'tiktok' },
  linkedin_post: { width: 1200, height: 627, isVideo: false, platform: 'linkedin' },
  twitter_post: { width: 1200, height: 675, isVideo: false, platform: 'twitter' },
  youtube_pre_roll: { width: 1920, height: 1080, isVideo: true, platform: 'youtube' },
  display_banner_728x90: { width: 728, height: 90, isVideo: false, platform: 'facebook' },
  display_banner_300x250: { width: 300, height: 250, isVideo: false, platform: 'facebook' },
  display_banner_160x600: { width: 160, height: 600, isVideo: false, platform: 'facebook' },
  display_banner_320x50: { width: 320, height: 50, isVideo: false, platform: 'facebook' },
  pinterest_pin: { width: 1000, height: 1500, isVideo: false, platform: 'pinterest' },
}

const BATCH_FORMATS: AdFormat[] = [
  'instagram_post',
  'instagram_story',
  'instagram_reel',
  'facebook_feed',
  'facebook_story',
  'tiktok_video',
  'linkedin_post',
  'twitter_post',
  'youtube_pre_roll',
  'display_banner_728x90',
  'display_banner_300x250',
  'display_banner_160x600',
  'display_banner_320x50',
  'pinterest_pin',
]

interface GenerateSingleAdParams {
  format: AdFormat
  platform: Platform
  campaignId?: string
  brief: {
    productName: string
    productDescription: string
    callToAction: string
    targetAudience: string
  }
}

export async function generateAdBatch(
  workspaceId: string,
  campaignId: string | null,
  count: number = 14,
): Promise<string[]> {
  const formatsToUse = BATCH_FORMATS.slice(0, count)
  const jobIds: string[] = []

  // Load campaign brief if available
  let brief: GenerateSingleAdParams['brief'] | null = null
  if (campaignId) {
    const [cb] = await db
      .select()
      .from(campaignBriefs)
      .where(eq(campaignBriefs.campaignId, campaignId))
      .limit(1)
    if (cb) {
      brief = {
        productName: cb.productName,
        productDescription: cb.productDescription,
        callToAction: cb.callToAction,
        targetAudience: cb.targetAudience,
      }
    }
  }

  if (!brief) {
    // Fall back to workspace name as minimal brief
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)
    brief = {
      productName: ws?.name ?? 'Product',
      productDescription: `Marketing ad for ${ws?.name ?? 'our product'}`,
      callToAction: 'Learn More',
      targetAudience: ws?.targetAudience ?? 'General audience',
    }
  }

  for (const format of formatsToUse) {
    const spec = FORMAT_SPECS[format]
    const jobId = await generateSingleAd(workspaceId, {
      format,
      platform: spec.platform,
      campaignId: campaignId ?? undefined,
      brief,
    })
    jobIds.push(jobId)
  }

  return jobIds
}

export async function generateSingleAd(
  workspaceId: string,
  params: GenerateSingleAdParams,
): Promise<string> {
  // Create placeholder ad record
  const [ad] = await db
    .insert(ads)
    .values({
      workspaceId,
      campaignId: params.campaignId ?? null,
      format: params.format,
      platform: params.platform,
      status: 'generating',
    })
    .returning()

  // Create generation job record
  const [job] = await db
    .insert(generationJobs)
    .values({
      workspaceId,
      campaignId: params.campaignId ?? null,
      adId: ad.id,
      format: params.format,
      platform: params.platform,
      brief: params.brief,
      status: 'pending',
    })
    .returning()

  // Link ad to job
  await db
    .update(ads)
    .set({ generationJobId: job.id })
    .where(eq(ads.id, ad.id))

  // Enqueue BullMQ job
  const spec = FORMAT_SPECS[params.format]
  const timeout = spec.isVideo ? 10 * 60 * 1000 : 2 * 60 * 1000
  await generationQueue.add(
    'generate-ad',
    { jobId: job.id },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      jobId: job.id,
      // BullMQ timeout via lock duration is set at worker level
    },
  )

  return job.id
}

export async function processAdGenerationJob(jobId: string): Promise<void> {
  // 1. Load job payload
  const [job] = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1)

  if (!job) throw new Error(`Generation job not found: ${jobId}`)
  if (job.status === 'completed') return

  // Mark as started
  await db
    .update(generationJobs)
    .set({ status: 'writing_copy', startedAt: new Date() })
    .where(eq(generationJobs.id, jobId))

  try {
    const brief = job.brief as {
      productName: string
      productDescription: string
      callToAction: string
      targetAudience: string
    }

    const format = job.format as AdFormat
    const spec = FORMAT_SPECS[format] ?? { width: 1080, height: 1080, isVideo: false, platform: job.platform }

    // 2. Load brand voice
    const [voice] = await db
      .select()
      .from(brandVoices)
      .where(and(eq(brandVoices.workspaceId, job.workspaceId), eq(brandVoices.isActive, true)))
      .limit(1)

    // 3. Load top 5 best performers as examples
    const topExamples = await getTopPerformingExamples(job.workspaceId, 5)
    const exampleStrings = topExamples.map(
      (e) => `Headline: "${e.headline}" | Body: "${e.bodyText}" (CTR: ${(e.ctr * 100).toFixed(2)}%)`,
    )

    // 4. Generate ad copy
    const copyRequest: llamaClient.AdCopyRequest = {
      format: job.format,
      platform: job.platform,
      productName: brief.productName,
      productDescription: brief.productDescription,
      tone: voice?.tone ?? 'professional',
      keywords: (voice?.keywords as string[]) ?? [],
      forbiddenWords: (voice?.forbiddenWords as string[]) ?? [],
      callToAction: brief.callToAction,
      targetAudience: brief.targetAudience,
      examples: exampleStrings,
    }
    const copy = await llamaClient.generateAdCopy(copyRequest)

    let imageUrl: string | null = null
    let videoUrl: string | null = null
    let thumbnailUrl: string | null = null
    let audioUrl: string | null = null

    if (!spec.isVideo) {
      // 5a. Generate static image
      await db
        .update(generationJobs)
        .set({ status: 'generating_image' })
        .where(eq(generationJobs.id, jobId))

      const imgPrompt = `High-quality advertising visual for "${brief.productName}". ${brief.productDescription}. Style: photorealistic, professional ad photography. Platform: ${job.platform}.`
      const img = await sdClient.generateImage({
        prompt: imgPrompt,
        negativePrompt: 'blurry, low quality, watermark, text overlay, distorted',
        format: job.format,
        width: spec.width,
        height: spec.height,
        style: 'photorealistic',
      })
      imageUrl = img.imageUrl
    } else {
      // 5b. Generate video
      await db
        .update(generationJobs)
        .set({ status: 'generating_image' })
        .where(eq(generationJobs.id, jobId))

      const videoPrompt = `Cinematic advertising video for "${brief.productName}". ${brief.productDescription}. Professional, eye-catching, ${job.platform} style.`
      const vid = await cogvideoClient.generateVideo({
        prompt: videoPrompt,
        duration: 6,
        width: spec.width,
        height: spec.height,
        fps: 24,
      })
      videoUrl = vid.videoUrl
      thumbnailUrl = vid.thumbnailUrl

      // 6. Generate TTS voiceover
      await db
        .update(generationJobs)
        .set({ status: 'adding_audio' })
        .where(eq(generationJobs.id, jobId))

      const voiceoverText = `${copy.headline}. ${copy.bodyText} ${copy.ctaText}`
      const tts = await ttsClient.generateVoiceover({
        text: voiceoverText,
        voice: 'af_heart',
        speed: 1.0,
        format: 'mp3',
      })
      audioUrl = tts.audioUrl

      // 7. Mux voiceover into video
      await db
        .update(generationJobs)
        .set({ status: 'compositing' })
        .where(eq(generationJobs.id, jobId))

      const assembled = await ffmpegClient.addVoiceover(videoUrl, audioUrl)
      videoUrl = assembled.videoUrl
    }

    // 8. Update ad record
    await db
      .update(ads)
      .set({
        headline: copy.headline,
        bodyText: copy.bodyText,
        ctaText: copy.ctaText,
        imageUrl,
        videoUrl,
        thumbnailUrl,
        audioUrl,
        status: 'ready',
        updatedAt: new Date(),
      })
      .where(eq(ads.id, job.adId!))

    // 9. Mark job completed
    await db
      .update(generationJobs)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(generationJobs.id, jobId))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[CampaignGenerator] Job ${jobId} failed:`, message)

    await db
      .update(generationJobs)
      .set({ status: 'failed', errorMessage: message })
      .where(eq(generationJobs.id, jobId))

    if (job.adId) {
      await db
        .update(ads)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(ads.id, job.adId))
    }

    throw err
  }
}
