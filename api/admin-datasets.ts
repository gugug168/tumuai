import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface ToolDataset {
  reviews_count?: number
  review_count?: number
  [key: string]: unknown
}

async function verifyAdmin(supabaseUrl: string, serviceKey: string, accessToken?: string) {
  const supabase = createClient(supabaseUrl, serviceKey)
  if (!accessToken) return null
  const { data: userRes } = await supabase.auth.getUser(accessToken)
  const userId = userRes?.user?.id
  if (!userId) return null
  const { data: adminRow } = await supabase.from('admin_users').select('id,user_id').eq('user_id', userId).maybeSingle()
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

    const authHeader = request.headers.authorization || request.headers.Authorization
    const accessToken = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : ''
    const admin = await verifyAdmin(supabaseUrl, serviceKey, accessToken)
    if (!admin) {
      return response.status(403).json({ error: 'Forbidden' })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // 获取真实的认证用户数据
    const { data: { users: authUsers }, error: usersError } = await supabase.auth.admin.listUsers()
    
    const [submissions, tools, logs, categories, stats] = await Promise.all([
      supabase.from('tool_submissions').select('*').order('created_at', { ascending: false }).limit(50),
      // 使用 * 避免列名不一致导致查询失败
      supabase.from('tools').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('admin_logs').select('id,admin_id,action,target_type,target_id,details,ip_address,user_agent,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      // 获取统计信息
      supabase.from('tools').select('id', { count: 'exact', head: true }),
    ])
    
    // 处理用户数据 - 确保显示真实邮箱和正确的注册时间
    const users = usersError ? [] : (authUsers || []).map(user => ({
      id: user.id,
      email: user.email || `用户-${user.id.slice(0, 8)}`,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      email_confirmed_at: user.email_confirmed_at,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata
    }))

    // 获取额外的统计数据
    const [submissionCount, pendingCount, categoryCount] = await Promise.all([
      supabase.from('tool_submissions').select('id', { count: 'exact', head: true }),
      supabase.from('tool_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('categories').select('id', { count: 'exact', head: true })
    ])
    
    // 用户数量基于真实认证用户
    const actualUserCount = users.length

    const body = {
      submissions: submissions.data || [],
      users: users || [], // 使用处理后的认证用户数据
      tools: (tools.data || []).map((t: ToolDataset) => ({
        ...t,
        reviews_count: t.reviews_count ?? t.review_count ?? 0,
        review_count: t.review_count ?? t.reviews_count ?? 0,
      })),
      logs: logs.data || [],
      categories: categories.data || [],
      stats: {
        totalTools: stats.count || 0,
        totalUsers: actualUserCount, // 使用真实的认证用户数量
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