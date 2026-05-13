function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required environment variable: ${key}`)
  return val
}

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue
}

function getBoolEnv(key: string, defaultValue: boolean): boolean {
  const val = process.env[key]
  if (val === undefined) return defaultValue
  return val.toLowerCase() === 'true'
}

function getIntEnv(key: string, defaultValue: number): number {
  const val = process.env[key]
  if (!val) return defaultValue
  const parsed = parseInt(val, 10)
  if (isNaN(parsed)) throw new Error(`Env var ${key} must be an integer, got: ${val}`)
  return parsed
}

export const config = {
  // Core
  port: getIntEnv('PORT', 8090),
  nodeEnv: getEnv('NODE_ENV', 'development'),
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret: requireEnv('JWT_SECRET'),
  redisUrl: getEnv('REDIS_URL', 'redis://localhost:6379'),
  siteUrl: getEnv('SITE_URL', 'http://localhost:3000'),

  // AI Worker URLs
  llamaWorkerUrl: getEnv('LLAMA_WORKER_URL', 'http://localhost:8001'),
  sdWorkerUrl: getEnv('SD_WORKER_URL', 'http://localhost:8002'),
  cogvideoWorkerUrl: getEnv('COGVIDEO_WORKER_URL', 'http://localhost:8003'),
  animatediffWorkerUrl: getEnv('ANIMATEDIFF_WORKER_URL', 'http://localhost:8004'),
  ttsWorkerUrl: getEnv('TTS_WORKER_URL', 'http://localhost:8005'),
  ffmpegWorkerUrl: getEnv('FFMPEG_WORKER_URL', 'http://localhost:8006'),

  // Platform OAuth — Facebook
  facebookClientId: getEnv('FACEBOOK_CLIENT_ID', ''),
  facebookClientSecret: getEnv('FACEBOOK_CLIENT_SECRET', ''),

  // Platform OAuth — Instagram (shares FB app)
  instagramClientId: getEnv('INSTAGRAM_CLIENT_ID', ''),
  instagramClientSecret: getEnv('INSTAGRAM_CLIENT_SECRET', ''),

  // Platform OAuth — TikTok
  tiktokClientId: getEnv('TIKTOK_CLIENT_ID', ''),
  tiktokClientSecret: getEnv('TIKTOK_CLIENT_SECRET', ''),

  // Platform OAuth — LinkedIn
  linkedinClientId: getEnv('LINKEDIN_CLIENT_ID', ''),
  linkedinClientSecret: getEnv('LINKEDIN_CLIENT_SECRET', ''),

  // Platform OAuth — Twitter / X
  twitterClientId: getEnv('TWITTER_CLIENT_ID', ''),
  twitterClientSecret: getEnv('TWITTER_CLIENT_SECRET', ''),

  // Storage
  storageBackend: getEnv('STORAGE_BACKEND', 'local') as 'local' | 's3',
  s3Bucket: getEnv('S3_BUCKET', ''),
  awsRegion: getEnv('AWS_REGION', 'us-east-1'),

  // Feature flags
  finetuneEnabled: getBoolEnv('FINETUNE_ENABLED', false),
} as const

export type Config = typeof config
