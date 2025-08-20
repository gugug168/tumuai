import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

async function verifyAdmin(supabaseUrl: string, serviceKey: string, accessToken?: string) {
  const supabase = createClient(supabaseUrl, serviceKey)
  if (!accessToken) return null
  const { data: userRes } = await supabase.auth.getUser(accessToken)
  const userId = userRes?.user?.id
  const email = userRes?.user?.email || ''
  if (!userId) return null
  // 尝试获取管理员
  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id,user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (adminRow) return { userId }
  // 自动引导：如果还没有任何管理员，则将当前用户设为 super_admin
  const { count } = await supabase
    .from('admin_users')
    .select('id', { count: 'exact', head: true })
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

    const [{ count: totalTools }, { count: totalUsers }, { count: pendingSubmissions }, { data: reviews }, { count: commentsCount }, { count: totalFavorites }] = await Promise.all([
      supabase.from('tools').select('id', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('tool_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('tool_reviews').select('rating'),
      supabase.from('tool_comments').select('id', { count: 'exact', head: true }),
      supabase.from('tool_favorites').select('id', { count: 'exact', head: true })
    ])

    const reviewCount = reviews?.length || 0
    const averageRating = reviewCount > 0 ? (reviews!.reduce((s, r: any) => s + (r.rating || 0), 0) / reviewCount) : 0

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        totalTools: totalTools || 0,
        totalUsers: totalUsers || 0,
        pendingSubmissions: pendingSubmissions || 0,
        totalReviews: reviewCount,
        averageRating: Math.round(averageRating * 10) / 10,
        totalFavorites: totalFavorites || 0,
        commentsCount: commentsCount || 0
      })
    }
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || 'Unexpected error' }
  }
}

export { handler }


