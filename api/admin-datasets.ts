import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface ToolDataset {
  reviews_count?: number
  review_count?: number
  [key: string]: unknown
}

type ExistingToolMatchType = 'exact' | 'host'

interface ExistingToolMatch {
  id: string
  name: string
  website_url: string
  match_type: ExistingToolMatchType
}

type SubmissionStatusFilter = 'all' | 'pending' | 'unapproved' | 'reviewed' | 'approved' | 'rejected'

function normalizeSubmissionStatusFilter(input: string | null): SubmissionStatusFilter {
  const v = (input || '').trim().toLowerCase()
  if (v === 'pending' || v === 'unapproved' || v === 'approved' || v === 'rejected' || v === 'reviewed') return v
  return 'all'
}

function escapePostgrestOrValue(value: string) {
  // PostgREST `or` filter uses commas/parentheses as syntax; escape to avoid query breakage.
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function normalizeWebsiteUrl(raw: string): { normalized: string; host: string } {
  const trimmed = (raw || '').trim()
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const url = new URL(withProto)

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  let path = url.pathname || ''
  if (path === '/') path = ''
  else path = path.replace(/\/+$/, '')

  const normalized = `${host}${path}`.toLowerCase()
  return { normalized, host }
}

function isMissingTableOrColumn(err: unknown, pattern: RegExp): boolean {
  const msg = (err as { message?: string })?.message || ''
  return pattern.test(msg)
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function getBearerToken(request: VercelRequest): string {
  const authHeader = request.headers.authorization || request.headers.Authorization
  const authHeaderStr = Array.isArray(authHeader) ? authHeader[0] : authHeader
  if (!authHeaderStr || typeof authHeaderStr !== 'string') return ''
  if (!/^Bearer\s+/i.test(authHeaderStr)) return ''
  const token = authHeaderStr.replace(/^Bearer\s+/i, '').trim()
  if (!token || token === 'null' || token === 'undefined') return ''
  return token
}

async function verifyAdmin(supabaseUrl: string, serviceKey: string, accessToken?: string) {
  const supabase = createClient(supabaseUrl, serviceKey)
  if (!accessToken) return null
  const { data: userRes } = await supabase.auth.getUser(accessToken)
  const userId = userRes?.user?.id
  if (!userId) return null
  const { data: adminRow } = await supabase.from('admin_users').select('id,user_id').eq('user_id', userId).limit(1).maybeSingle()
  if (adminRow) return { userId }
  const { count } = await supabase.from('admin_users').select('id', { count: 'exact', head: true })
  if (!count || count === 0) {
    await supabase.from('admin_users').insert([{ user_id: userId, role: 'super_admin', permissions: {} }])
    return { userId }
  }
  return null
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) {
      return response.status(500).json({ error: 'Missing Supabase server config' })
    }

    const accessToken = getBearerToken(request)
    if (!accessToken) {
      return response.status(401).json({ error: 'Unauthorized' })
    }
    const admin = await verifyAdmin(supabaseUrl, serviceKey, accessToken)
    if (!admin) {
      return response.status(403).json({ error: 'Forbidden' })
    }

    // 解析查询参数 - 支持按需获取数据
    const url = new URL(request.url || '', `http://${request.headers.host}`)
    const sections = url.searchParams.get('sections') || 'all'
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const submissionStatus = normalizeSubmissionStatusFilter(url.searchParams.get('submissionStatus') || url.searchParams.get('status'))
    const submissionQuery = (url.searchParams.get('q') || '').trim()
    const requestedSections = sections === 'all'
      ? ['stats', 'submissions', 'tools', 'categories', 'logs']
      : sections.split(',')

    const supabase = createClient(supabaseUrl, serviceKey)
    const safePage = Number.isFinite(page) && page > 0 ? page : 1
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 50
    const from = (safePage - 1) * safeLimit
    const to = from + safeLimit - 1

    // 只请求需要的数据部分
    const [submissions, tools, logs, categories, stats, submissionCount, pendingCount, categoryCount] = await Promise.all([
      // 只在请求时获取 submissions
      requestedSections.includes('submissions')
        ? (() => {
            let q = supabase
              .from('tool_submissions')
              .select('*', { count: 'exact' })
              .order('created_at', { ascending: false })
              .range(from, to)

            if (submissionStatus === 'pending' || submissionStatus === 'approved' || submissionStatus === 'rejected') {
              q = q.eq('status', submissionStatus)
            } else if (submissionStatus === 'unapproved') {
              q = q.in('status', ['pending', 'rejected'])
            } else if (submissionStatus === 'reviewed') {
              q = q.in('status', ['approved', 'rejected'])
            }

            if (submissionQuery) {
              const v = escapePostgrestOrValue(submissionQuery)
              const pattern = `%${v}%`
              q = q.or(
                [
                  `tool_name.ilike.${pattern}`,
                  `tagline.ilike.${pattern}`,
                  `description.ilike.${pattern}`,
                  `submitter_email.ilike.${pattern}`,
                  `website_url.ilike.${pattern}`
                ].join(',')
              )
            }

            return q
          })()
        : Promise.resolve({ data: [], count: 0 }),
      // 只在请求时获取 tools
      requestedSections.includes('tools')
        ? supabase.from('tools').select('*').order('created_at', { ascending: false }).limit(limit)
        : Promise.resolve({ data: [] }),
      // 只在请求时获取 logs
      requestedSections.includes('logs')
        ? supabase.from('admin_logs').select('id,admin_id,action,target_type,target_id,details,ip_address,user_agent,created_at').order('created_at', { ascending: false }).limit(100)
        : Promise.resolve({ data: [] }),
      // 只在请求时获取 categories
      requestedSections.includes('categories')
        ? supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true })
        : Promise.resolve({ data: [] }),
      // 始终获取基本统计信息（轻量级）
      supabase.from('tools').select('id', { count: 'exact', head: true }),
      // 额外统计
      supabase.from('tool_submissions').select('id', { count: 'exact', head: true }),
      supabase.from('tool_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('categories').select('id', { count: 'exact', head: true })
    ])

    // Enrich submissions with "already exists in tools" hints (best-effort)
    let enrichedSubmissions: unknown[] = submissions.data || []
    if (requestedSections.includes('submissions') && Array.isArray(submissions.data) && submissions.data.length > 0) {
      const submissionRows = submissions.data as Array<{ id: string; website_url?: string; tool_name?: string }>
      const submissionKeys = new Map<string, { normalized: string; host: string }>()
      const normalizedList: string[] = []
      const hostList: string[] = []

      for (const s of submissionRows) {
        try {
          const { normalized, host } = normalizeWebsiteUrl(String(s.website_url || ''))
          submissionKeys.set(s.id, { normalized, host })
          if (normalized) normalizedList.push(normalized)
          if (host) hostList.push(host)
        } catch {
          // ignore malformed urls
        }
      }

      const uniqueNormalized = Array.from(new Set(normalizedList)).slice(0, 200)
      const uniqueHosts = Array.from(new Set(hostList)).slice(0, 200)

      const toolsBySubmissionId = new Map<string, ExistingToolMatch[]>()

      if (uniqueNormalized.length > 0) {
        const normalizedToolsRes = await supabase
          .from('tools')
          .select('id,name,website_url,normalized_url,status')
          .in('normalized_url', uniqueNormalized)
          .in('status', ['published', 'pending'])

        if (!normalizedToolsRes.error && Array.isArray(normalizedToolsRes.data) && normalizedToolsRes.data.length > 0) {
          const toolsRows = normalizedToolsRes.data as Array<{ id: string; name: string; website_url: string; normalized_url?: string | null }>
          const toolsByNormalized = new Map<string, ExistingToolMatch[]>()
          for (const t of toolsRows) {
            const key = String(t.normalized_url || '').toLowerCase()
            if (!key) continue
            const list = toolsByNormalized.get(key) || []
            list.push({ id: t.id, name: t.name, website_url: t.website_url, match_type: 'exact' })
            toolsByNormalized.set(key, list)
          }

          for (const s of submissionRows) {
            const k = submissionKeys.get(s.id)
            if (!k?.normalized) continue
            const matches = toolsByNormalized.get(k.normalized) || []
            if (matches.length > 0) toolsBySubmissionId.set(s.id, matches.slice(0, 3))
          }
        }

        // Fallback if normalized_url column doesn't exist
        if (
          normalizedToolsRes.error &&
          isMissingTableOrColumn(normalizedToolsRes.error, /column\\s+\"normalized_url\"\\s+does not exist/i) &&
          uniqueHosts.length > 0
        ) {
          const toolCandidates: Array<{ id: string; name: string; website_url: string }> = []

          // Chunk to avoid overly long OR filters
          for (const hostChunk of chunk(uniqueHosts, 25)) {
            const orParts: string[] = []
            for (const host of hostChunk) {
              const safeHost = escapePostgrestOrValue(host)
              orParts.push(`website_url.ilike.%://${safeHost}%`)
              orParts.push(`website_url.ilike.%://${escapePostgrestOrValue('www.' + host)}%`)
            }

            const res = await supabase
              .from('tools')
              .select('id,name,website_url,status')
              .or(orParts.join(','))
              .in('status', ['published', 'pending'])
              .limit(500)

            if (!res.error && Array.isArray(res.data)) {
              for (const t of res.data as Array<{ id: string; name: string; website_url: string }>) {
                toolCandidates.push({ id: t.id, name: t.name, website_url: t.website_url })
              }
            }
          }

          const candidatesByHost = new Map<string, Array<{ id: string; name: string; website_url: string; normalized: string; host: string }>>()
          for (const t of toolCandidates) {
            try {
              const { normalized, host } = normalizeWebsiteUrl(String(t.website_url || ''))
              const list = candidatesByHost.get(host) || []
              list.push({ ...t, normalized, host })
              candidatesByHost.set(host, list)
            } catch {
              // ignore
            }
          }

          for (const s of submissionRows) {
            const k = submissionKeys.get(s.id)
            if (!k?.host) continue
            const candidates = candidatesByHost.get(k.host) || []
            if (candidates.length === 0) continue
            const matches: ExistingToolMatch[] = candidates.map(c => ({
              id: c.id,
              name: c.name,
              website_url: c.website_url,
              match_type: c.normalized === k.normalized ? 'exact' : 'host'
            }))
            matches.sort((a, b) => (a.match_type === b.match_type ? 0 : a.match_type === 'exact' ? -1 : 1))
            toolsBySubmissionId.set(s.id, matches.slice(0, 3))
          }
        }
      }

      enrichedSubmissions = submissionRows.map(s => {
        const existing = toolsBySubmissionId.get(s.id) || []
        return {
          ...s,
          already_in_tools: existing.length > 0,
          existing_tools: existing.length > 0 ? existing : undefined,
        }
      })
    }

    // 获取用户数量（不获取完整用户列表）
    const userResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
    const userCount = 'total' in userResult.data ? (userResult.data.total || 0) : 0

    const submissionsTotal = typeof submissions.count === 'number' ? submissions.count : 0

    const body = {
      submissions: enrichedSubmissions,
      users: [], // 不再返回完整用户列表，按需获取
      tools: (tools.data || []).map((t: ToolDataset) => ({
        ...t,
        reviews_count: t.reviews_count ?? t.review_count ?? 0,
        review_count: t.review_count ?? t.reviews_count ?? 0,
      })),
      logs: logs.data || [],
      categories: categories.data || [],
      submissionsPagination: requestedSections.includes('submissions')
        ? {
            page: safePage,
            perPage: safeLimit,
            total: submissionsTotal,
            totalPages: Math.max(1, Math.ceil(submissionsTotal / safeLimit))
          }
        : undefined,
      submissionsQuery: requestedSections.includes('submissions')
        ? { status: submissionStatus, q: submissionQuery }
        : undefined,
      stats: {
        totalTools: stats.count || 0,
        totalUsers: userCount || 0,
        totalSubmissions: submissionCount.count || 0,
        pendingSubmissions: pendingCount.count || 0,
        totalCategories: categoryCount.count || 0,
        totalLogs: logs.data?.length || 0
      }
    }

    return response.status(200).json(body)
  } catch (e: unknown) {
    console.error('Admin datasets error:', e)
    return response.status(500).json({
      error: (e as Error)?.message || 'Internal server error'
    })
  }
}
