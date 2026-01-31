import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export interface DuplicateCheckTool {
  id: string
  name: string
  tagline?: string | null
  website_url: string
  status?: string | null
  logo_url?: string | null
  created_at?: string | null
  categories?: string[] | null
}

export interface DuplicateCheckResult {
  exists: boolean
  tool?: DuplicateCheckTool
  cached: boolean
  processing_time_ms?: number
  normalized_url?: string
  display_url?: string
}

type ErrorResponse = {
  error: string
  code: string
  processing_time_ms?: number
}

function normalizeWebsiteUrl(raw: string): { normalized: string; display: string } {
  const trimmed = (raw || '').trim()
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const url = new URL(withProto)

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  let path = url.pathname || ''
  if (path === '/') path = ''
  else path = path.replace(/\/+$/, '')

  const normalized = `${host}${path}`.toLowerCase()
  return { normalized, display: normalized || host }
}

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function isMissingTableOrColumn(err: unknown, pattern: RegExp): boolean {
  const msg = (err as { message?: string })?.message || ''
  return pattern.test(msg)
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const start = Date.now()
  setCors(response)

  if (request.method === 'OPTIONS') {
    return response.status(200).end()
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' } satisfies ErrorResponse)
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) {
      return response.status(500).json({
        error: 'Missing Supabase server config',
        code: 'SERVER_CONFIG_ERROR',
        processing_time_ms: Date.now() - start,
      } satisfies ErrorResponse)
    }

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : (request.body || {})
    const inputUrl = (body?.url as string | undefined) || ''
    if (!inputUrl || typeof inputUrl !== 'string') {
      return response.status(400).json({
        error: 'Invalid input: url is required',
        code: 'INVALID_INPUT',
        processing_time_ms: Date.now() - start,
      } satisfies ErrorResponse)
    }

    let normalized: string
    let display: string
    try {
      ;({ normalized, display } = normalizeWebsiteUrl(inputUrl))
    } catch {
      return response.status(400).json({
        error: 'Invalid URL format',
        code: 'INVALID_URL_FORMAT',
        processing_time_ms: Date.now() - start,
      } satisfies ErrorResponse)
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    // 1) Try cache table (optional)
    const nowIso = new Date().toISOString()
    try {
      const cacheRes = await supabase
        .from('website_duplicate_cache')
        .select('exists,existing_tool_id,expires_at')
        .eq('normalized_url', normalized)
        .gt('expires_at', nowIso)
        .maybeSingle()

      if (!cacheRes.error && cacheRes.data) {
        let tool: DuplicateCheckTool | undefined
        if (cacheRes.data.exists && cacheRes.data.existing_tool_id) {
          const toolRes = await supabase
            .from('tools')
            .select('id,name,tagline,website_url,status,logo_url,created_at,categories')
            .eq('id', cacheRes.data.existing_tool_id)
            .maybeSingle()

          if (!toolRes.error && toolRes.data) {
            tool = toolRes.data as DuplicateCheckTool
          }
        }

        const result: DuplicateCheckResult = {
          exists: !!cacheRes.data.exists,
          tool,
          cached: true,
          processing_time_ms: Date.now() - start,
          normalized_url: normalized,
          display_url: display,
        }

        // Fire-and-forget perf log (optional)
        void (async () => {
          try {
            await supabase.from('api_performance_logs').insert([{
              endpoint: 'check-website-duplicate',
              processing_time_ms: result.processing_time_ms || 0,
              cache_hit: true,
              result_exists: result.exists,
              has_error: false,
              metadata: { source: 'cache' },
              created_at: new Date().toISOString(),
            }])
          } catch {
            // ignore
          }
        })()

        return response.status(200).json(result)
      }
    } catch {
      // Cache table may not exist; ignore.
    }

    // 2) Query tools by normalized_url (preferred)
    let tool: DuplicateCheckTool | undefined
    let exists = false

    const toolByNormalized = await supabase
      .from('tools')
      .select('id,name,tagline,website_url,status,logo_url,created_at,categories')
      .eq('normalized_url', normalized)
      .in('status', ['published', 'pending'])
      .maybeSingle()

    if (!toolByNormalized.error && toolByNormalized.data) {
      tool = toolByNormalized.data as DuplicateCheckTool
      exists = true
    }

    // Fallback: older schema without normalized_url
    if (toolByNormalized.error && isMissingTableOrColumn(toolByNormalized.error, /column\\s+\"normalized_url\"\\s+does not exist/i)) {
      const host = normalized.split('/')[0]
      const fallback = await supabase
        .from('tools')
        .select('id,name,tagline,website_url,status,logo_url,created_at,categories')
        .or(`website_url.ilike.%://${host}%,website_url.ilike.%://${'www.' + host}%`)
        .in('status', ['published', 'pending'])
        .maybeSingle()

      if (!fallback.error && fallback.data) {
        tool = fallback.data as DuplicateCheckTool
        exists = true
      }
    }

    // 3) Upsert cache (best-effort)
    try {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      await supabase
        .from('website_duplicate_cache')
        .upsert([{
          original_url: inputUrl,
          normalized_url: normalized,
          exists,
          existing_tool_id: tool?.id || null,
          cached_at: new Date().toISOString(),
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }], { onConflict: 'normalized_url' })
    } catch {
      // Cache table may not exist; ignore.
    }

    const result: DuplicateCheckResult = {
      exists,
      tool,
      cached: false,
      processing_time_ms: Date.now() - start,
      normalized_url: normalized,
      display_url: display,
    }

    // Perf log (optional)
    try {
      await supabase.from('api_performance_logs').insert([{
        endpoint: 'check-website-duplicate',
        processing_time_ms: result.processing_time_ms || 0,
        cache_hit: false,
        result_exists: result.exists,
        has_error: false,
        metadata: { source: 'db' },
        created_at: new Date().toISOString(),
      }])
    } catch {
      // Table may not exist; ignore.
    }

    return response.status(200).json(result)
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message || 'Internal error'
    return response.status(500).json({
      error: message,
      code: 'INTERNAL_ERROR',
      processing_time_ms: Date.now() - start,
    } satisfies ErrorResponse)
  }
}
