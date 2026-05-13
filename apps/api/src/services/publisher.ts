import axios from 'axios'
import { eq } from 'drizzle-orm'
import { db, scheduledPosts, ads, platformConnections } from '../db'
import { AppError } from '../middleware/error-handler'

type Platform = 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'twitter' | 'youtube' | 'pinterest'

interface PlatformConnectionRow {
  id: string
  workspaceId: string
  platform: string
  accessToken: string
  refreshToken: string | null
  tokenExpiresAt: Date | null
  accountId: string | null
  accountName: string | null
  isActive: boolean
}

interface AdRow {
  id: string
  headline: string | null
  bodyText: string | null
  ctaText: string | null
  imageUrl: string | null
  videoUrl: string | null
  thumbnailUrl: string | null
  audioUrl: string | null
  format: string
  platform: string
}

export async function publish(scheduledPostId: string): Promise<void> {
  const [post] = await db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.id, scheduledPostId))
    .limit(1)

  if (!post) throw new AppError(404, 'Scheduled post not found', 'NOT_FOUND')
  if (post.status !== 'scheduled') {
    console.warn(`[Publisher] Post ${scheduledPostId} status is ${post.status}, skipping`)
    return
  }

  const [ad] = await db.select().from(ads).where(eq(ads.id, post.adId)).limit(1)
  if (!ad) throw new AppError(404, 'Ad not found', 'NOT_FOUND')

  const [connection] = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.workspaceId, post.workspaceId))
    // Match platform
    .limit(100)

  const platformConn = [connection].flat().find(
    (c) => c && c.platform === post.platform && c.isActive,
  )

  if (!platformConn) {
    await db
      .update(scheduledPosts)
      .set({
        status: 'failed',
        errorMessage: `No active connection found for platform ${post.platform}`,
      })
      .where(eq(scheduledPosts.id, scheduledPostId))
    return
  }

  try {
    let externalPostId: string

    switch (post.platform as Platform) {
      case 'facebook':
        externalPostId = await publishToFacebook(platformConn, ad)
        break
      case 'instagram':
        externalPostId = await publishToInstagram(platformConn, ad)
        break
      case 'tiktok':
        externalPostId = await publishToTikTok(platformConn, ad)
        break
      case 'linkedin':
        externalPostId = await publishToLinkedIn(platformConn, ad)
        break
      case 'twitter':
        externalPostId = await publishToTwitter(platformConn, ad)
        break
      default:
        throw new Error(`Unsupported platform: ${post.platform}`)
    }

    await db
      .update(scheduledPosts)
      .set({
        status: 'published',
        externalPostId,
        publishedAt: new Date(),
      })
      .where(eq(scheduledPosts.id, scheduledPostId))

    await db
      .update(ads)
      .set({ status: 'published', updatedAt: new Date() })
      .where(eq(ads.id, ad.id))

    console.log(`[Publisher] Post ${scheduledPostId} published to ${post.platform} — external ID: ${externalPostId}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Publisher] Failed to publish post ${scheduledPostId}:`, message)
    await db
      .update(scheduledPosts)
      .set({ status: 'failed', errorMessage: message })
      .where(eq(scheduledPosts.id, scheduledPostId))
    throw err
  }
}

export async function publishToFacebook(
  connection: PlatformConnectionRow,
  ad: AdRow,
): Promise<string> {
  const pageId = connection.accountId
  const caption = [ad.headline, ad.bodyText, ad.ctaText].filter(Boolean).join('\n\n')

  if (ad.videoUrl) {
    const response = await axios.post<{ id: string }>(
      `https://graph.facebook.com/v19.0/${pageId}/videos`,
      {
        file_url: ad.videoUrl,
        description: caption,
        access_token: connection.accessToken,
      },
    )
    return response.data.id
  } else {
    const response = await axios.post<{ id: string }>(
      `https://graph.facebook.com/v19.0/${pageId}/photos`,
      {
        url: ad.imageUrl,
        caption,
        access_token: connection.accessToken,
      },
    )
    return response.data.id
  }
}

export async function publishToInstagram(
  connection: PlatformConnectionRow,
  ad: AdRow,
): Promise<string> {
  const igAccountId = connection.accountId
  const caption = [ad.headline, ad.bodyText, ad.ctaText].filter(Boolean).join('\n\n')

  // Step 1: create media container
  const mediaType = ad.videoUrl ? 'REELS' : 'IMAGE'
  const containerPayload: Record<string, string> = {
    media_type: mediaType,
    caption,
    access_token: connection.accessToken,
  }
  if (ad.videoUrl) {
    containerPayload.video_url = ad.videoUrl
  } else {
    containerPayload.image_url = ad.imageUrl ?? ''
  }

  const containerRes = await axios.post<{ id: string }>(
    `https://graph.facebook.com/v19.0/${igAccountId}/media`,
    containerPayload,
  )
  const containerId = containerRes.data.id

  // Step 2: publish container
  const publishRes = await axios.post<{ id: string }>(
    `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
    { creation_id: containerId, access_token: connection.accessToken },
  )
  return publishRes.data.id
}

export async function publishToTikTok(
  connection: PlatformConnectionRow,
  ad: AdRow,
): Promise<string> {
  const caption = [ad.headline, ad.bodyText].filter(Boolean).join(' ')

  // TikTok Content Posting API v2
  const initRes = await axios.post<{ data: { publish_id: string } }>(
    'https://open.tiktokapis.com/v2/post/publish/video/init/',
    {
      post_info: {
        title: caption.substring(0, 150),
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: ad.videoUrl ?? ad.imageUrl,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
    },
  )

  return initRes.data.data.publish_id
}

export async function publishToLinkedIn(
  connection: PlatformConnectionRow,
  ad: AdRow,
): Promise<string> {
  const authorUrn = `urn:li:person:${connection.accountId}`
  const text = [ad.headline, ad.bodyText, ad.ctaText].filter(Boolean).join('\n\n')

  const shareContent: Record<string, unknown> = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: ad.imageUrl ? 'IMAGE' : 'NONE',
        media: ad.imageUrl
          ? [
              {
                status: 'READY',
                originalUrl: ad.imageUrl,
              },
            ]
          : [],
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  }

  const response = await axios.post<{ id: string }>(
    'https://api.linkedin.com/v2/ugcPosts',
    shareContent,
    {
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    },
  )

  const locationHeader = response.headers['x-restli-id'] as string | undefined
  return locationHeader ?? response.data.id
}

export async function publishToTwitter(
  connection: PlatformConnectionRow,
  ad: AdRow,
): Promise<string> {
  const text = [ad.headline, ad.ctaText].filter(Boolean).join(' — ').substring(0, 280)

  const tweetPayload: Record<string, unknown> = { text }

  // Upload media first if present
  if (ad.imageUrl) {
    // Twitter v2 media upload is done via v1.1 endpoint
    const mediaRes = await axios.post<{ media_id_string: string }>(
      'https://upload.twitter.com/1.1/media/upload.json',
      { media_url: ad.imageUrl },
      {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
      },
    )
    tweetPayload.media = { media_ids: [mediaRes.data.media_id_string] }
  }

  const response = await axios.post<{ data: { id: string } }>(
    'https://api.twitter.com/2/tweets',
    tweetPayload,
    {
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  )

  return response.data.data.id
}
