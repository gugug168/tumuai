/**
 * 管理员用户列表 API
 * 按需分页获取用户列表，避免一次性加载所有用户
 */

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function getBearerToken(request: VercelRequest): string {
  const authHeader = request.headers.authorization || request.headers.Authorization
  const authHeaderStr = Array.isArray(authHeader) ? authHeader[0] : authHeader
  if (!authHeaderStr || typeof authHeaderStr !== 'string') return ''
  if (!/^Bearer\\s+/i.test(authHeaderStr)) return ''
  const token = authHeaderStr.replace(/^Bearer\\s+/i, '').trim()
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
  // CORS 支持
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (request.method === 'OPTIONS') {
    return response.status(200).end()
  }

  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

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

    const supabase = createClient(supabaseUrl, serviceKey)

    // 分页参数
    const url = new URL(request.url || '', `http://${request.headers.host}`)
    const page = parseInt(url.searchParams.get('page') || '1')
    const perPage = parseInt(url.searchParams.get('perPage') || '20')
    const search = url.searchParams.get('search') || ''

    // 获取用户总数
    const userResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
    const totalCount = 'total' in userResult.data ? (userResult.data.total || 0) : 0

    let users: unknown[] = []
    let filteredCount = totalCount || 0

    if (search) {
      // 搜索模式：需要手动筛选（Supabase auth API 不支持搜索）
      const allUsersResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const filteredUsers = (allUsersResult.data.users || []).filter(user =>
        user.email?.toLowerCase().includes(search.toLowerCase())
      )
      filteredCount = filteredUsers.length

      // 分页
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
      // 直接分页获取
      const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({
        page,
        perPage
      })

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

    // 合并管理员信息
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
  } catch (e: unknown) {
    console.error('Admin users error:', e)
    return response.status(500).json({
      error: (e as Error)?.message || 'Internal server error'
    })
  }
}
