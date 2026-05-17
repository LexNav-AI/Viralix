import { Router, Request, Response } from 'express'
import axios from 'axios'
import { and, eq } from 'drizzle-orm'
import { db, platformConnections, workspaceMembers } from '../db'
import { requireAuth } from '../middleware/auth'
import { AppError } from '../middleware/error-handler'
import { config } from '../config'

const router = Router({ mergeParams: true })

async function assertMember(userId: string, workspaceId: string): Promise<void> {
  const [m] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1)
  if (!m) throw new AppError(403, 'Access denied', 'FORBIDDEN')
}

type SupportedPlatform = 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'twitter'

interface OAuthConfig {
  authUrl: string
  tokenUrl: string
  clientId: string
  clientSecret: string
  scopes: string[]
}

function getOAuthConfig(platform: SupportedPlatform, redirectUri: string): OAuthConfig {
  switch (platform) {
    case 'facebook':
    case 'instagram':
      return {
        authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
        tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
        clientId: platform === 'instagram' ? config.instagramClientId : config.facebookClientId,
        clientSecret: platform === 'instagram' ? config.instagramClientSecret : config.facebookClientSecret,
        scopes:
          platform === 'instagram'
            ? ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement']
            : ['pages_manage_posts', 'pages_read_engagement', 'ads_management'],
      }
    case 'tiktok':
      return {
        authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
        tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
        clientId: config.tiktokClientId,
        clientSecret: config.tiktokClientSecret,
        scopes: ['user.info.basic', 'video.publish', 'video.upload'],
      }
    case 'linkedin':
      return {
        authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
        tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
        clientId: config.linkedinClientId,
        clientSecret: config.linkedinClientSecret,
        scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social'],
      }
    case 'twitter':
      return {
        authUrl: 'https://twitter.com/i/oauth2/authorize',
        tokenUrl: 'https://api.twitter.com/2/oauth2/token',
        clientId: config.twitterClientId,
        clientSecret: config.twitterClientSecret,
        scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      }
    default:
      throw new AppError(400, `Unsupported platform: ${platform}`, 'UNSUPPORTED_PLATFORM')
  }
}

function buildRedirectUri(platform: string): string {
  return `${config.siteUrl}/api/workspaces/oauth/callback/${platform}`
}

// GET /api/workspaces/:workspaceId/connections
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string
  await assertMember(req.user!.id, workspaceId)

  const connections = await db
    .select({
      id: platformConnections.id,
      platform: platformConnections.platform,
      accountId: platformConnections.accountId,
      accountName: platformConnections.accountName,
      isActive: platformConnections.isActive,
      tokenExpiresAt: platformConnections.tokenExpiresAt,
      connectedAt: platformConnections.connectedAt,
    })
    .from(platformConnections)
    .where(eq(platformConnections.workspaceId, workspaceId))

  res.json(connections)
})

// GET /api/workspaces/:workspaceId/connections/:platform/oauth-url
router.get('/:platform/oauth-url', requireAuth, async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string
  const platform = req.params.platform as string
  await assertMember(req.user!.id, workspaceId)

  const redirectUri = buildRedirectUri(platform)
  const oauthCfg = getOAuthConfig(platform as SupportedPlatform, redirectUri)

  const state = Buffer.from(JSON.stringify({ workspaceId, platform })).toString('base64')

  const params = new URLSearchParams({
    client_id: oauthCfg.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: oauthCfg.scopes.join(' '),
    state,
  })

  res.json({ url: `${oauthCfg.authUrl}?${params.toString()}` })
})

// POST /api/workspaces/:workspaceId/connections/:platform/callback
router.post('/:platform/callback', requireAuth, async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string
  const platform = req.params.platform as string
  await assertMember(req.user!.id, workspaceId)

  const { code } = req.body as { code: string }
  if (!code) throw new AppError(400, 'Missing OAuth authorization code', 'MISSING_CODE')

  const redirectUri = buildRedirectUri(platform)
  const oauthCfg = getOAuthConfig(platform as SupportedPlatform, redirectUri)

  // Exchange code for tokens
  let tokenData: {
    access_token: string
    refresh_token?: string
    expires_in?: number
    scope?: string
  }

  if (platform === 'twitter') {
    const basicAuth = Buffer.from(`${oauthCfg.clientId}:${oauthCfg.clientSecret}`).toString('base64')
    const response = await axios.post<typeof tokenData>(
      oauthCfg.tokenUrl,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: 'challenge',
      }),
      { headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' } },
    )
    tokenData = response.data
  } else {
    const response = await axios.post<typeof tokenData>(oauthCfg.tokenUrl, null, {
      params: {
        client_id: oauthCfg.clientId,
        client_secret: oauthCfg.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      },
    })
    tokenData = response.data
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null

  // Fetch account info
  let accountId: string = ''
  let accountName: string | null = null

  try {
    if (platform === 'facebook' || platform === 'instagram') {
      const meRes = await axios.get<{ id: string; name: string }>(
        'https://graph.facebook.com/v19.0/me',
        { params: { access_token: tokenData.access_token, fields: 'id,name' } },
      )
      accountId = meRes.data.id
      accountName = meRes.data.name
    } else if (platform === 'linkedin') {
      const meRes = await axios.get<{ id: string; localizedFirstName: string; localizedLastName: string }>(
        'https://api.linkedin.com/v2/me',
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
      )
      accountId = meRes.data.id
      accountName = `${meRes.data.localizedFirstName} ${meRes.data.localizedLastName}`
    } else if (platform === 'twitter') {
      const meRes = await axios.get<{ data: { id: string; name: string } }>(
        'https://api.twitter.com/2/users/me',
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
      )
      accountId = meRes.data.data.id
      accountName = meRes.data.data.name
    } else if (platform === 'tiktok') {
      const meRes = await axios.get<{ data: { user: { open_id: string; display_name: string } } }>(
        'https://open.tiktokapis.com/v2/user/info/',
        {
          params: { fields: 'open_id,display_name' },
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        },
      )
      accountId = meRes.data.data.user.open_id
      accountName = meRes.data.data.user.display_name
    }
  } catch {
    console.warn(`[Connections] Could not fetch account info for ${platform}`)
  }

  // Upsert connection
  const existing = await db
    .select()
    .from(platformConnections)
    .where(and(eq(platformConnections.workspaceId, workspaceId), eq(platformConnections.platform, platform as SupportedPlatform)))
    .limit(1)

  let connection
  if (existing.length > 0) {
    ;[connection] = await db
      .update(platformConnections)
      .set({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        tokenExpiresAt: expiresAt,
        accountId: accountId || existing[0].accountId,
        accountName,
        isActive: true,
      })
      .where(eq(platformConnections.id, existing[0].id))
      .returning()
  } else {
    ;[connection] = await db
      .insert(platformConnections)
      .values({
        workspaceId,
        platform: platform as SupportedPlatform,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        tokenExpiresAt: expiresAt,
        accountId: accountId || 'unknown',
        accountName,
        isActive: true,
      })
      .returning()
  }

  // Return without sensitive token fields
  res.json({
    id: connection.id,
    platform: connection.platform,
    accountId: connection.accountId,
    accountName: connection.accountName,
    isActive: connection.isActive,
    tokenExpiresAt: connection.tokenExpiresAt,
    connectedAt: connection.connectedAt,
  })
})

// DELETE /api/workspaces/:workspaceId/connections/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string
  const id = req.params.id as string
  await assertMember(req.user!.id, workspaceId)

  const [connection] = await db
    .select()
    .from(platformConnections)
    .where(and(eq(platformConnections.id, id), eq(platformConnections.workspaceId, workspaceId)))
    .limit(1)

  if (!connection) throw new AppError(404, 'Connection not found', 'NOT_FOUND')

  await db.delete(platformConnections).where(eq(platformConnections.id, id))

  res.json({ success: true })
})

// POST /api/workspaces/:workspaceId/connections/:id/refresh
router.post('/:id/refresh', requireAuth, async (req: Request, res: Response) => {
  const workspaceId = req.params.workspaceId as string
  const id = req.params.id as string
  await assertMember(req.user!.id, workspaceId)

  const [connection] = await db
    .select()
    .from(platformConnections)
    .where(and(eq(platformConnections.id, id), eq(platformConnections.workspaceId, workspaceId)))
    .limit(1)

  if (!connection) throw new AppError(404, 'Connection not found', 'NOT_FOUND')
  if (!connection.refreshToken) throw new AppError(400, 'No refresh token stored for this connection', 'NO_REFRESH_TOKEN')

  const oauthCfg = getOAuthConfig(connection.platform as SupportedPlatform, buildRedirectUri(connection.platform))

  const response = await axios.post<{ access_token: string; expires_in?: number; refresh_token?: string }>(
    oauthCfg.tokenUrl,
    null,
    {
      params: {
        client_id: oauthCfg.clientId,
        client_secret: oauthCfg.clientSecret,
        refresh_token: connection.refreshToken,
        grant_type: 'refresh_token',
      },
    },
  )

  const tokenData = response.data
  const expiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null

  const [updated] = await db
    .update(platformConnections)
    .set({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? connection.refreshToken,
      tokenExpiresAt: expiresAt,
    })
    .where(eq(platformConnections.id, id))
    .returning()

  res.json({
    id: updated.id,
    platform: updated.platform,
    accountId: updated.accountId,
    accountName: updated.accountName,
    isActive: updated.isActive,
    tokenExpiresAt: updated.tokenExpiresAt,
  })
})

export default router
