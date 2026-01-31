import type { VercelRequest, VercelResponse } from '@vercel/node'

type Pricing = 'Free' | 'Freemium' | 'Paid' | 'Trial'

interface AIAnalysisResult {
  name: string
  tagline: string
  description: string
  features: string[]
  pricing: Pricing
  categories: string[]
  confidence: number
  reasoning: string
}

interface AISmartFillResponse {
  success: boolean
  data?: AIAnalysisResult
  error?: {
    code: string
    message: string
    retryable: boolean
  }
  apiUsage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cost: number
  }
  metadata: {
    analysisTime: number
    timestamp: string
    websiteContentFetched: boolean
    apiVersion: string
  }
}

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function safeTrim(input: unknown, maxLen: number): string {
  const str = typeof input === 'string' ? input : ''
  return str.replace(/\s+/g, ' ').trim().slice(0, maxLen)
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function extractMeta(html: string) {
  const pick = (re: RegExp): string => {
    const m = html.match(re)
    return m?.[1] ? decodeHtmlEntities(m[1]).trim() : ''
  }

  const title = pick(/<title[^>]*>([^<]{1,200})<\/title>/i)
  const ogTitle = pick(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']{1,200})["'][^>]*>/i)
  const twTitle = pick(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']{1,200})["'][^>]*>/i)

  const desc = pick(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']{1,500})["'][^>]*>/i)
  const ogDesc = pick(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']{1,500})["'][^>]*>/i)
  const twDesc = pick(/<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']{1,500})["'][^>]*>/i)

  return {
    title,
    ogTitle,
    twTitle,
    description: desc || ogDesc || twDesc,
  }
}

function splitTitle(t: string): { name: string; rest: string } {
  const raw = safeTrim(t, 200)
  if (!raw) return { name: '', rest: '' }
  const parts = raw.split(/\s*(?:\||-|—|·|•)\s*/).filter(Boolean)
  if (parts.length === 1) return { name: parts[0], rest: '' }
  return { name: parts[0], rest: parts.slice(1).join(' - ') }
}

function guessPricing(text: string): Pricing {
  const t = text.toLowerCase()
  if (/(free\s+trial|trial\s+period|start\s+trial|try\s+free)/i.test(text)) return 'Trial'
  if (/(pricing|subscribe|subscription|\$|€|¥|per\s+month|per\s+year)/i.test(text)) return 'Paid'
  if (/\bfree\b/i.test(text) && /(upgrade|pro|premium|paid)/i.test(text)) return 'Freemium'
  if (/\bfree\b/i.test(text)) return 'Free'
  return 'Freemium'
}

function guessTags(text: string): { categories: string[]; features: string[] } {
  const t = text.toLowerCase()
  const categories: string[] = []
  const features: string[] = []

  const has = (re: RegExp) => re.test(t)

  if (has(/bim|revit|ifc/)) categories.push('BIM软件')
  if (has(/structure|structural|finite element|fea|analysis|etabs|sap2000|midas|ansys/)) categories.push('结构计算')
  if (has(/drawing|cad|autocad|draft/)) categories.push('图纸生成')
  if (has(/ai|llm|gpt|copilot|agent/)) categories.push('AI结构设计')
  if (has(/productivity|workflow|automation|效率|协作/)) categories.push('效率工具')

  if (has(/ai|gpt|llm/)) features.push('AI优化')
  if (has(/parametric|参数化/)) features.push('参数化设计')
  if (has(/collaboration|协作|cloud|云/)) features.push('云端协作')
  if (has(/analysis|simulate|simulation|计算/)) features.push('智能分析')

  // Keep output small and stable
  return {
    categories: Array.from(new Set(categories)).slice(0, 3),
    features: Array.from(new Set(features)).slice(0, 6),
  }
}

function okResponse(data: AIAnalysisResult, analysisTime: number, fetched: boolean): AISmartFillResponse {
  return {
    success: true,
    data,
    apiUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 },
    metadata: {
      analysisTime,
      timestamp: new Date().toISOString(),
      websiteContentFetched: fetched,
      apiVersion: 'heuristic-1.0',
    },
  }
}

function errResponse(code: string, message: string, retryable: boolean, analysisTime: number, fetched: boolean): AISmartFillResponse {
  return {
    success: false,
    error: { code, message, retryable },
    apiUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 },
    metadata: {
      analysisTime,
      timestamp: new Date().toISOString(),
      websiteContentFetched: fetched,
      apiVersion: 'heuristic-1.0',
    },
  }
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const text = await resp.text()
    return text.length > 1_000_000 ? text.slice(0, 1_000_000) : text
  } finally {
    clearTimeout(timeoutId)
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const start = Date.now()
  setCors(response)

  if (request.method === 'OPTIONS') {
    return response.status(200).end()
  }

  if (request.method === 'GET') {
    const health = request.query.health === 'true'
    if (health) {
      return response.status(200).json({
        ok: true,
        apiVersion: 'heuristic-1.0',
        timestamp: new Date().toISOString(),
      })
    }
    return response.status(405).json({ error: 'Method not allowed' })
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const body = typeof request.body === 'string' ? JSON.parse(request.body) : (request.body || {})
  const websiteUrlRaw = body?.websiteUrl as string | undefined
  const websiteUrlTrimmed = safeTrim(websiteUrlRaw, 2048)

  if (!websiteUrlTrimmed) {
    return response.status(400).json(errResponse('INVALID_INPUT', 'websiteUrl is required', false, Date.now() - start, false))
  }

  let websiteUrl: string
  try {
    const withProto = /^https?:\/\//i.test(websiteUrlTrimmed) ? websiteUrlTrimmed : `https://${websiteUrlTrimmed}`
    websiteUrl = new URL(withProto).toString()
  } catch {
    return response.status(400).json(errResponse('INVALID_URL_FORMAT', 'Invalid websiteUrl format', false, Date.now() - start, false))
  }

  // Fetch + extract
  try {
    const html = await fetchHtml(websiteUrl, 12_000)
    const meta = extractMeta(html)
    const titleCandidate = meta.ogTitle || meta.twTitle || meta.title
    const split = splitTitle(titleCandidate)

    const name = safeTrim(split.name || titleCandidate, 80) || new URL(websiteUrl).hostname.replace(/^www\./i, '')
    const tagline = safeTrim(meta.description || split.rest, 100) || `来自 ${new URL(websiteUrl).hostname} 的工具`
    const description = safeTrim(meta.description || `${name} - ${tagline}`, 800) || `${name}：${tagline}`

    const combined = `${titleCandidate}\n${meta.description}\n${html.slice(0, 20_000)}`
    const pricing = guessPricing(combined)
    const guessed = guessTags(combined)
    const categories = guessed.categories.length > 0 ? guessed.categories : ['效率工具']

    // Simple confidence heuristic
    const confidenceBase = (meta.description ? 0.55 : 0.35) + (titleCandidate ? 0.2 : 0)
    const confidence = Math.min(0.95, Math.max(0.2, confidenceBase))

    const result: AIAnalysisResult = {
      name,
      tagline,
      description,
      features: guessed.features,
      pricing,
      categories,
      confidence,
      reasoning: meta.description
        ? 'Heuristic extraction from meta title/description.'
        : 'Heuristic extraction from page title and limited content.',
    }

    return response.status(200).json(okResponse(result, Date.now() - start, true))
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message || 'Failed to fetch website content'
    return response.status(502).json(errResponse('FETCH_FAILED', message, true, Date.now() - start, false))
  }
}

