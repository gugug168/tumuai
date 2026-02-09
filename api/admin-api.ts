/**
 * 统一管理员 API
 * 合并了 admin-check 和 admin-users 功能
 *
 * 端点:
 * - GET /api/admin-api?action=check - 验证管理员权限
 * - GET /api/admin-api?action=users - 获取用户列表
 * - GET /api/admin-api?action=datasets - 获取数据统计
 */
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// 安全响应头配置
const SECURITY_HEADERS = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache'
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
  const { data: adminRow } = await supabase.from('admin_users').select('id,user_id,role,permissions,created_at,updated_at').eq('user_id', userId).limit(1).maybeSingle()
  if (adminRow) return { userId, admin: adminRow }
  const { count } = await supabase.from('admin_users').select('id', { count: 'exact', head: true })
  if (!count || count === 0) {
    const permissions = {
      manage_tools: true,
      manage_users: true,
      manage_submissions: true,
      manage_admins: true,
      view_analytics: true,
      system_settings: true
    }
    const { data: created } = await supabase.from('admin_users').insert([{ user_id: userId, role: 'super_admin', permissions }]).select('id,user_id,role,permissions,created_at,updated_at').maybeSingle()
    if (created) return { userId, admin: created }
  }
  return null
}

// 处理管理员权限检查
async function handleCheck(request: VercelRequest, response: VercelResponse, accessToken: string, supabaseUrl: string, serviceKey: string) {
  const startTime = Date.now()

  try {
    const supabase = createClient(supabaseUrl, serviceKey)

    // 验证JWT令牌格式
    const tokenParts = accessToken.split('.')
    if (tokenParts.length !== 3) {
      return response.status(401).json({ error: 'Invalid token format' })
    }

    const { data: userRes, error: userErr } = await supabase.auth.getUser(accessToken)
    if (userErr || !userRes?.user) {
      return response.status(401).json({ error: 'Invalid token' })
    }

    const userId = userRes.user.id

    // 并行查询
    const [adminResult, countResult] = await Promise.all([
      supabase.from('admin_users').select('id,user_id,role,permissions,created_at,updated_at').eq('user_id', userId).limit(1).maybeSingle(),
      supabase.from('admin_users').select('id', { count: 'exact', head: true })
    ])

    const { data, error } = adminResult
    if (error) {
      return response.status(500).json({ error: error.message })
    }
    if (data) {
      return response.status(200).json({ ...data })
    }

    const { count } = countResult
    const userEmail = userRes.user.email
    const superAdminEmail = (process.env.VITE_SUPER_ADMIN_EMAIL || '').trim()
    const adminEmails = (process.env.VITE_ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean)
    const hasAnyConfiguredAdmin = !!superAdminEmail || adminEmails.length > 0

    if (!userRes.user.email_confirmed_at) {
      return response.status(403).json({ error: 'Email verification required' })
    }

    const shouldCreateAdmin = (!count || count === 0) || (hasAnyConfiguredAdmin && (userEmail === superAdminEmail || adminEmails.includes(userEmail || '')))

    if (shouldCreateAdmin) {
      const permissions = {
        manage_tools: true,
        manage_users: true,
        manage_submissions: true,
        manage_admins: true,
        view_analytics: true,
        system_settings: true
      }

      const { data: created, error: insErr } = await supabase.from('admin_users').insert([{ user_id: userId, role: 'super_admin', permissions }]).select('id,user_id,role,permissions,created_at,updated_at').maybeSingle()
      if (insErr) {
        if (insErr.code === '23505') {
          const { data: updated } = await supabase.from('admin_users').update({ role: 'super_admin', permissions, updated_at: new Date().toISOString() }).eq('user_id', userId).select('id,user_id,role,permissions,created_at,updated_at').maybeSingle()
          if (updated) return response.status(200).json({ ...updated })
        }
        return response.status(500).json({ error: insErr.message })
      }
      return response.status(200).json({ ...created })
    }

    return response.status(403).json({ error: 'Forbidden' })
  } catch (e: unknown) {
    console.error('Admin check error:', e)
    return response.status(500).json({ error: (e as Error)?.message || 'Unexpected error' })
  }
}

// 处理用户列表
async function handleUsers(request: VercelRequest, response: VercelResponse, accessToken: string, supabaseUrl: string, serviceKey: string) {
  const admin = await verifyAdmin(supabaseUrl, serviceKey, accessToken)
  if (!admin) {
    return response.status(403).json({ error: 'Forbidden' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const url = new URL(request.url || '', `http://${request.headers.host}`)
  const page = parseInt(url.searchParams.get('page') || '1')
  const perPage = Math.min(parseInt(url.searchParams.get('perPage') || '20'), 50) // 限制最大50
  const search = url.searchParams.get('search') || ''

  // 获取用户总数
  const userResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
  const totalCount = 'total' in userResult.data ? (userResult.data.total || 0) : 0

  let users: unknown[] = []
  let filteredCount = totalCount || 0

  if (search) {
    // 搜索模式 - 限制加载量
    const allUsersResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const filteredUsers = (allUsersResult.data.users || []).filter(user =>
      user.email?.toLowerCase().includes(search.toLowerCase())
    )
    filteredCount = filteredUsers.length

    const start = (page - 1) * perPage
    users = filteredUsers.slice(start, start + perPage).map(user => ({
      id: user.id,
      email: user.email || `用户-${user.id.slice(0, 8)}`,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      email_confirmed_at: user.email_confirmed_at,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata
    }))
  } else {
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ page, perPage })
    users = (authUsers || []).map(user => ({
      id: user.id,
      email: user.email || `用户-${user.id.slice(0, 8)}`,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      email_confirmed_at: user.email_confirmed_at,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata
    }))
  }

  // 获取管理员角色信息
  const { data: adminUsers } = await supabase
    .from('admin_users')
    .select('user_id, role, is_active, created_at, last_login')
    .in('user_id', users.map((u: any) => u.id))

  const adminMap = new Map((adminUsers || []).map((au: any) => [au.user_id, au]))

  users = users.map((user: any) => ({
    ...user,
    role: adminMap.get(user.id)?.role || 'user',
    is_active: adminMap.get(user.id)?.is_active ?? true,
    last_login: adminMap.get(user.id)?.last_login || user.last_sign_in_at
  }))

  return response.status(200).json({
    users,
    pagination: {
      page,
      perPage,
      total: filteredCount || 0,
      totalPages: Math.ceil((filteredCount || 0) / perPage)
    }
  })
}

// 处理数据集统计
async function handleDatasets(request: VercelRequest, response: VercelResponse, accessToken: string, supabaseUrl: string, serviceKey: string) {
  const admin = await verifyAdmin(supabaseUrl, serviceKey, accessToken)
  if (!admin) {
    return response.status(403).json({ error: 'Forbidden' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const url = new URL(request.url || '', `http://${request.headers.host}`)
  const sections = url.searchParams.get('sections')?.split(',') || ['all']
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)

  const data: Record<string, unknown> = {}

  try {
    // 工具统计
    if (sections.includes('all') || sections.includes('tools')) {
      const [toolsCount, pendingCount, featuredCount] = await Promise.all([
        supabase.from('tools').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('tool_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('tools').select('id', { count: 'exact', head: true }).eq('featured', true)
      ])
      data.tools = { total: toolsCount.count || 0, pending: pendingCount.count || 0, featured: featuredCount.count || 0 }
    }

    // 用户统计
    if (sections.includes('all') || sections.includes('users')) {
      const usersCount = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
      const adminsCount = await supabase.from('admin_users').select('id', { count: 'exact', head: true })
      data.users = { total: ('total' in usersCount.data) ? usersCount.data.total || 0 : 0, admins: adminsCount.count || 0 }
    }

    // 最近工具
    if (sections.includes('all') || sections.includes('tools')) {
      const { data: recentTools } = await supabase.from('tools').select('id,name,status,created_at').order('created_at', { ascending: false }).limit(limit)
      data.recentTools = recentTools || []
    }

    return response.status(200).json(data)
  } catch (error) {
    console.error('Datasets error:', error)
    return response.status(500).json({ error: 'Failed to fetch datasets' })
  }
}

// 主处理器
export default async function handler(request: VercelRequest, response: VercelResponse) {
  // 设置安全响应头
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.setHeader(key, value)
  })
  response.setHeader('Access-Control-Allow-Origin', '*')

  // CORS
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return response.status(200).end()
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  if (!supabaseUrl || !serviceKey) {
    return response.status(500).json({ error: 'Missing Supabase server config' })
  }

  // 获取 action 参数
  const url = new URL(request.url || '', `http://${request.headers.host}`)
  const action = url.searchParams.get('action') || (request.body ? JSON.parse(request.body as string)?.action : 'check')

  const accessToken = getBearerToken(request)
  if (!accessToken) {
    return response.status(401).json({ error: 'Unauthorized' })
  }

  switch (action) {
    case 'check':
      return handleCheck(request, response, accessToken, supabaseUrl, serviceKey)
    case 'users':
      return handleUsers(request, response, accessToken, supabaseUrl, serviceKey)
    case 'datasets':
      return handleDatasets(request, response, accessToken, supabaseUrl, serviceKey)
    default:
      return response.status(400).json({ error: 'Invalid action', availableActions: ['check', 'users', 'datasets'] })
  }
}
