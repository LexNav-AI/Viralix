import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config'
import type { ScrapedData } from './scraper'

const client = new Anthropic({ apiKey: config.anthropicApiKey })

const PLATFORM_SPECS: Record<string, { maxChars: number; style: string }> = {
  instagram: { maxChars: 125, style: 'visual, aspirational, emoji-friendly' },
  facebook: { maxChars: 150, style: 'conversational, community-focused' },
  tiktok: { maxChars: 100, style: 'trendy, casual, hook-first' },
  youtube: { maxChars: 120, style: 'informative, benefit-driven' },
  twitter: { maxChars: 100, style: 'punchy, witty, concise' },
  linkedin: { maxChars: 150, style: 'professional, value-driven' },
  pinterest: { maxChars: 100, style: 'inspiring, lifestyle-focused' },
  snapchat: { maxChars: 80, style: 'youthful, fun, urgent' },
}

const CTAS = ['Try Now Free', 'Learn More', 'Check It Out', 'Get Started']

export interface GeneratedAdCopy {
  headline: string
  body: string
  cta: string
  hashtags: string[]
}

export async function generateAdCopy(
  scraped: ScrapedData,
  platform: string,
  campaignUrl: string,
  variant: number = 0,
): Promise<GeneratedAdCopy> {
  const spec = PLATFORM_SPECS[platform] ?? PLATFORM_SPECS.instagram
  const cta = CTAS[variant % CTAS.length]

  const prompt = `You are an expert ad copywriter. Generate a high-converting ad for ${platform}.

BRAND INFO:
- Name: ${scraped.title}
- Description: ${scraped.description}
- Key headlines from site: ${scraped.headlines.slice(0, 3).join(' | ')}
- Features/benefits: ${scraped.features.slice(0, 5).join(', ')}
- Brand tone: ${scraped.tone}
- Pricing signals: ${scraped.pricing.slice(0, 2).join(', ') || 'not specified'}

PLATFORM: ${platform}
STYLE: ${spec.style}
MAX HEADLINE: 60 chars
MAX BODY: ${spec.maxChars} chars
CTA (use exactly): "${cta}"

Return ONLY a JSON object:
{
  "headline": "...",
  "body": "...",
  "cta": "${cta}",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in Claude response')

  const parsed = JSON.parse(jsonMatch[0]) as GeneratedAdCopy
  parsed.cta = cta
  return parsed
}
