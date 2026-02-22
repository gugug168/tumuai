import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type ToolRow = {
  id: string
  name: string | null
  tagline: string | null
  description: string | null
  updated_at: string | null
}

type TranslationRow = {
  tool_id: string
  lang: 'en'
  source_updated_at: string | null
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env: ${name}`)
  return value
}

function isAuthorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Best-effort: allow Vercel Cron header or local/dev runs.
    return req.headers['x-vercel-cron'] === '1' || process.env.NODE_ENV !== 'production'
  }

  const auth = String(req.headers.authorization || '')
  return auth === `Bearer ${secret}`
}

function cleanText(value: unknown): string {
  return String(value || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim()
}

function splitIntoChunks(text: string, maxLen: number): string[] {
  const t = text.trim()
  if (!t) return []
  if (t.length <= maxLen) return [t]

  const parts: string[] = []
  const paragraphs = t.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean)
  for (const p of paragraphs) {
    if (p.length <= maxLen) {
      parts.push(p)
      continue
    }

    // Fallback: split long paragraphs by sentences.
    const sentences = p.split(/(?<=[.!?。！？])\s+/g).map((s) => s.trim()).filter(Boolean)
    let buf = ''
    for (const s of sentences) {
      const next = buf ? `${buf} ${s}` : s
      if (next.length <= maxLen) {
        buf = next
      } else {
        if (buf) parts.push(buf)
        buf = s.length <= maxLen ? s : s.slice(0, maxLen)
      }
    }
    if (buf) parts.push(buf)
  }
  return parts.filter(Boolean)
}

async function translateGoogle(text: string, target: string): Promise<string> {
  const url = new URL('https://translate.googleapis.com/translate_a/single')
  url.searchParams.set('client', 'gtx')
  url.searchParams.set('sl', 'auto')
  url.searchParams.set('tl', target)
  url.searchParams.set('dt', 't')
  url.searchParams.set('q', text)

  const res = await fetch(url.toString(), { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`google translate http ${res.status}`)
  const data = await res.json()
  const segs = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : []
  return segs.map((s: unknown) => (Array.isArray(s) ? String(s[0] || '') : '')).join('')
}

async function translateToEn(text: string): Promise<string> {
  const t = cleanText(text)
  if (!t) return ''

  // Google endpoint is best-effort and rate-limited; keep chunks reasonably small.
  const chunks = splitIntoChunks(t, 1200)
  const out: string[] = []
  for (const chunk of chunks) {
    out.push(await translateGoogle(chunk, 'en'))
  }
  return cleanText(out.join('\n\n'))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const supabaseUrl = getRequiredEnv('VITE_SUPABASE_URL')
    const serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const limit = Number.isFinite(Number(req.query.limit)) ? Number(req.query.limit) : 30
    const scanLimit = Number.isFinite(Number(req.query.scanLimit)) ? Number(req.query.scanLimit) : 250

    const { data: tools, error: toolsError } = await supabase
      .from('tools')
      .select('id,name,tagline,description,updated_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: false })
      .limit(Math.min(scanLimit, 1000))

    if (toolsError) throw new Error(toolsError.message)
    const toolRows: ToolRow[] = Array.isArray(tools) ? (tools as ToolRow[]) : []
    const toolIds = toolRows.map((t) => t.id).filter(Boolean)

    const { data: existing, error: existingError } = await supabase
      .from('tool_translations')
      .select('tool_id,lang,source_updated_at')
      .eq('lang', 'en')
      .in('tool_id', toolIds)

    if (existingError) throw new Error(existingError.message)
    const existingRows: TranslationRow[] = Array.isArray(existing) ? (existing as TranslationRow[]) : []
    const existingMap = new Map<string, TranslationRow>()
    for (const row of existingRows) existingMap.set(row.tool_id, row)

    const candidates = toolRows.filter((tool) => {
      const prev = existingMap.get(tool.id)
      if (!prev) return true
      const src = tool.updated_at || null
      const translatedSrc = prev.source_updated_at || null
      if (!translatedSrc) return true
      if (!src) return false
      return translatedSrc !== src
    })

    const target = candidates.slice(0, Math.max(0, Math.min(limit, 200)))
    let updated = 0
    const skipped = toolRows.length - candidates.length
    let failed = 0

    for (const tool of target) {
      try {
        const taglineEn = tool.tagline ? await translateToEn(tool.tagline) : null
        const descriptionEn = tool.description ? await translateToEn(tool.description) : null

        const now = new Date().toISOString()
        const { error: upsertError } = await supabase
          .from('tool_translations')
          .upsert(
            {
              tool_id: tool.id,
              lang: 'en',
              tagline: taglineEn,
              description: descriptionEn,
              source_updated_at: tool.updated_at,
              updated_at: now
            },
            { onConflict: 'tool_id,lang' }
          )

        if (upsertError) throw new Error(upsertError.message)
        updated += 1
      } catch {
        failed += 1
      }
    }

    return res.status(200).json({
      scanned: toolRows.length,
      candidates: candidates.length,
      processed: target.length,
      updated,
      skipped,
      failed
    })
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }
}
