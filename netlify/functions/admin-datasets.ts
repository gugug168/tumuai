import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

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

const handler: Handler = async (event) => {
  try {
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) return { statusCode: 500, body: 'Missing Supabase server config' }

    const authHeader = event.headers.authorization || event.headers.Authorization
    const accessToken = authHeader?.replace(/^Bearer\s+/i, '')
    const admin = await verifyAdmin(supabaseUrl, serviceKey, accessToken)
    if (!admin) return { statusCode: 403, body: 'Forbidden' }

    const supabase = createClient(supabaseUrl, serviceKey)

    const [submissions, users, tools, logs, categories, stats] = await Promise.all([
      supabase.from('tool_submissions').select('*').order('created_at', { ascending: false }).limit(50),
      // 兼容不一致的列结构，避免因某列缺失而导致整个查询返回错误
      supabase.from('user_profiles').select('*').limit(50),
      // 使用 * 避免列名不一致导致查询失败
      supabase.from('tools').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('admin_logs').select('id,admin_id,action,target_type,target_id,details,ip_address,user_agent,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      // 获取统计信息
      supabase.from('tools').select('id', { count: 'exact', head: true }),
    ])

    // 获取额外的统计数据
    const [userCount, submissionCount, pendingCount, categoryCount] = await Promise.all([
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('tool_submissions').select('id', { count: 'exact', head: true }),
      supabase.from('tool_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('categories').select('id', { count: 'exact', head: true })
    ])

    const body = {
      submissions: submissions.data || [],
      users: users.data || [],
      tools: (tools.data || []).map((t: any) => ({
        ...t,
        reviews_count: (t as any).reviews_count ?? (t as any).review_count ?? 0,
        review_count: (t as any).review_count ?? (t as any).reviews_count ?? 0,
      })),
      logs: logs.data || [],
      categories: categories.data || [],
      stats: {
        totalTools: stats.count || 0,
        totalUsers: userCount.count || 0,
        totalSubmissions: submissionCount.count || 0,
        pendingSubmissions: pendingCount.count || 0,
        totalCategories: categoryCount.count || 0,
        totalLogs: logs.data?.length || 0
      }
    }

    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
  } catch (e: any) {
    console.error('Admin datasets error:', e)
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || 'Internal server error' }) }
  }
}

export { handler }


