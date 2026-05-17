import axios from 'axios'
import * as cheerio from 'cheerio'

export interface ScrapedData {
  title: string
  description: string
  headlines: string[]
  features: string[]
  pricing: string[]
  ctas: string[]
  brandColors: string[]
  tone: string
  logoUrl: string | null
  ogImage: string | null
}

export async function scrapeUrl(url: string): Promise<ScrapedData> {
  const { data: html } = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Viralix-Scraper/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  })

  const $ = cheerio.load(html)

  // Remove script/style tags
  $('script, style, nav, footer, [aria-hidden="true"]').remove()

  const title = $('title').text().trim() ||
    $('meta[property="og:title"]').attr('content') || ''

  const description = $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') || ''

  const ogImage = $('meta[property="og:image"]').attr('content') || null

  // Headlines: h1, h2, h3
  const headlines: string[] = []
  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().trim()
    if (text.length > 5 && text.length < 200) headlines.push(text)
  })

  // Features: look for lists near "feature" / "benefit" sections
  const features: string[] = []
  $('ul li, ol li').each((_, el) => {
    const text = $(el).text().trim()
    if (text.length > 10 && text.length < 150) features.push(text)
  })

  // Pricing: look for $ signs
  const pricing: string[] = []
  $('*').each((_, el) => {
    const text = $(el).clone().children().remove().end().text().trim()
    if (/\$[\d,]+/.test(text) && text.length < 100) pricing.push(text)
  })

  // CTAs: buttons and prominent links
  const ctas: string[] = []
  $('button, a[class*="btn"], a[class*="cta"], a[class*="button"]').each((_, el) => {
    const text = $(el).text().trim()
    if (text.length > 2 && text.length < 60) ctas.push(text)
  })

  // Brand colors: meta theme-color, inline styles with color/background
  const brandColors: string[] = []
  const themeColor = $('meta[name="theme-color"]').attr('content')
  if (themeColor) brandColors.push(themeColor)

  // Logo
  const logoUrl = $('img[class*="logo"], img[alt*="logo"], img[src*="logo"]').first().attr('src') || null

  // Infer tone from copy
  const allText = $('p').text().toLowerCase()
  let tone = 'professional'
  if (/fun|exciting|amazing|love|awesome/.test(allText)) tone = 'energetic'
  else if (/trusted|reliable|proven|expert|leader/.test(allText)) tone = 'authoritative'
  else if (/you|your|help|support|care/.test(allText)) tone = 'friendly'
  else if (/save|cheap|free|deal|discount/.test(allText)) tone = 'value-focused'

  return {
    title,
    description,
    headlines: [...new Set(headlines)].slice(0, 10),
    features: [...new Set(features)].slice(0, 15),
    pricing: [...new Set(pricing)].slice(0, 5),
    ctas: [...new Set(ctas)].slice(0, 8),
    brandColors,
    tone,
    logoUrl,
    ogImage,
  }
}
