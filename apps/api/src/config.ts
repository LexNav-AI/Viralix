export const config = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/viralix',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  awsRegion: process.env.AWS_REGION ?? 'us-east-1',
  s3Bucket: process.env.S3_BUCKET ?? 'viralix-media',
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiSecret: process.env.API_SECRET ?? 'dev-secret',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
}
