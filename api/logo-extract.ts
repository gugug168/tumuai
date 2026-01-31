import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type ErrorResponse = { error: string }

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function toUrl(input: string): URL {
  const trimmed = (input || '').trim()
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return new URL(withProto)
}

async function headOk(url: string, timeoutMs: number): Promise<boolean> {
  try {
    const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(timeoutMs) })
    if (resp.ok) return true
    // Some origins disallow HEAD; try a cheap GET.
    if (resp.status === 405) {
      const getResp = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) })
      return getResp.ok
    }
    return false
  } catch {
    return false
  }
}

async function extractLogoQuick(websiteUrl: string): Promise<string | null> {
  try {
    const u = toUrl(websiteUrl)
    const origin = u.origin
    const domain = u.hostname.replace(/^www\./i, '')

    const candidates = [
      `${origin}/apple-touch-icon.png`,
      `${origin}/apple-touch-icon-precomposed.png`,
      `${origin}/favicon.svg`,
      `${origin}/favicon.png`,
      `${origin}/favicon.ico`,
    ]

    for (const cand of candidates) {
      // Keep it fast for batch runs.
      // If the origin blocks HEAD, the helper falls back to GET.
      // A 1500ms timeout per candidate caps worst-case time.
      // eslint-disable-next-line no-await-in-loop
      if (await headOk(cand, 1500)) return cand
    }

    // Fallback: predictable external icon service
    return `https://cdn2.iconhorse.com/icons/${domain}.png`
  } catch {
    return null
  }
}

async function extractLogoFull(websiteUrl: string): Promise<string | null> {
  // Try quick candidates first.
  const quick = await extractLogoQuick(websiteUrl)
  if (quick) return quick

  // Last resort: fetch origin HTML and parse <link rel="icon">, og:image etc.
  try {
    const u = toUrl(websiteUrl)
    const origin = u.origin
    const domain = u.hostname.replace(/^www\./i, '')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    let html = ''
    try {
      const resp = await fetch(origin, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      html = await resp.text()
    } finally {
      clearTimeout(timeoutId)
    }

    const linkRegex = /<link\s+([^>]*?)>/gi
    const candidates: Array<{ url: string; quality: number }> = []
    let match

    while ((match = linkRegex.exec(html)) !== null) {
      const linkAttrs = match[1]
      const relMatch = linkAttrs.match(/rel=["']([^"']+)["']/i)
      const hrefMatch = linkAttrs.match(/href=["']([^"']+)["']/i)
      if (!relMatch || !hrefMatch) continue

      const rel = relMatch[1].toLowerCase()
      let href = hrefMatch[1]

      const iconRels = ['icon', 'shortcut icon', 'apple-touch-icon', 'mask-icon', 'fluid-icon']
      if (!iconRels.some(r => rel.includes(r))) continue

      if (!href.startsWith('http') && !href.startsWith('//')) {
        href = new URL(href, origin).href
      } else if (href.startsWith('//')) {
        href = 'https:' + href
      }

      let quality = 50
      if (rel.includes('apple-touch-icon')) quality = 95
      else if (href.endsWith('.svg')) quality = 100

      candidates.push({ url: href, quality })
    }

    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    if (ogMatch?.[1]) {
      let ogImg = ogMatch[1]
      if (!ogImg.startsWith('http') && !ogImg.startsWith('//')) ogImg = new URL(ogImg, origin).href
      else if (ogImg.startsWith('//')) ogImg = 'https:' + ogImg
      candidates.push({ url: ogImg, quality: 70 })
    }

    candidates.sort((a, b) => b.quality - a.quality)

    for (const cand of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await headOk(cand.url, 2500)) return cand.url
    }

    return `https://cdn2.iconhorse.com/icons/${domain}.png`
  } catch {
    return null
  }
}

async function verifyAdmin(supabaseUrl: string, serviceKey: string, accessToken?: string): Promise<boolean> {
  if (!accessToken) return false
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: userRes, error: userErr } = await supabase.auth.getUser(accessToken)
  if (userErr || !userRes?.user?.id) return false
  const { data: adminRow } = await supabase.from('admin_users').select('id').eq('user_id', userRes.user.id).maybeSingle()
  return !!adminRow
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  setCors(response)

  if (request.method === 'OPTIONS') {
    return response.status(200).end()
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' } satisfies ErrorResponse)
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  if (!supabaseUrl || !serviceKey) {
    return response.status(500).json({ error: 'Missing Supabase server config' } satisfies ErrorResponse)
  }

  const body = typeof request.body === 'string' ? JSON.parse(request.body) : (request.body || {})
  const action = body?.action as string | undefined

  if (action === 'extract_from_url') {
    const websiteUrl = body?.websiteUrl as string | undefined
    if (!websiteUrl) {
      return response.status(400).json({ error: 'websiteUrl is required' } satisfies ErrorResponse)
    }

    const logoUrl = await extractLogoFull(websiteUrl)
    return response.status(200).json({ success: true, logoUrl })
  }

  if (action === 'extract_batch') {
    const authHeader = request.headers.authorization || request.headers.Authorization
    const accessToken = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\\s+/i, '') : ''
    const isAdmin = await verifyAdmin(supabaseUrl, serviceKey, accessToken)
    if (!isAdmin) {
      return response.status(403).json({ error: 'Forbidden' } satisfies ErrorResponse)
    }

    const toolIds = (body?.toolIds as unknown) || []
    if (!Array.isArray(toolIds) || toolIds.length === 0) {
      return response.status(400).json({ error: 'toolIds must be a non-empty array' } satisfies ErrorResponse)
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data: tools, error } = await supabase
      .from('tools')
      .select('id,website_url')
      .in('id', toolIds)

    if (error) {
      return response.status(500).json({ error: error.message } satisfies ErrorResponse)
    }

    const results: Array<{ toolId: string; logoUrl?: string; error?: string }> = []
    let updated = 0

    // Small concurrency to stay within function time limits.
    const concurrency = 6
    let cursor = 0
    const toolList = tools || []

    async function worker(): Promise<void> {
      while (cursor < toolList.length) {
        const idx = cursor++
        const tool = toolList[idx]
        if (!tool?.id || !tool.website_url) {
          results.push({ toolId: tool?.id || 'unknown', error: 'Missing website_url' })
          continue
        }

        const logoUrl = await extractLogoQuick(tool.website_url)
        if (!logoUrl) {
          results.push({ toolId: tool.id, error: 'Failed to extract logo' })
          continue
        }

        const upd = await supabase
          .from('tools')
          .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
          .eq('id', tool.id)

        if (upd.error) {
          results.push({ toolId: tool.id, error: upd.error.message })
          continue
        }

        updated += 1
        results.push({ toolId: tool.id, logoUrl })
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, toolList.length) }, () => worker())
    await Promise.all(workers)

    return response.status(200).json({
      success: true,
      total: toolList.length,
      updated,
      results,
    })
  }

  return response.status(400).json({ error: 'Unknown action' } satisfies ErrorResponse)
}

