import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const handler: Handler = async (event) => {
  try {
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) {
      return { statusCode: 500, body: 'Missing Supabase server config' }
    }

    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, body: 'Unauthorized' }
    }
    const accessToken = authHeader.replace(/^Bearer\s+/i, '')

    const supabase = createClient(supabaseUrl, serviceKey)

    // Verify token and get user id
    const { data: userRes, error: userErr } = await supabase.auth.getUser(accessToken)
    if (userErr || !userRes?.user) {
      return { statusCode: 401, body: 'Invalid token' }
    }

    const userId = userRes.user.id
    
    // 查找现有管理员
    const { data, error } = await supabase
      .from('admin_users')
      .select('id,user_id,role,permissions,created_at,updated_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      return { statusCode: 500, body: error.message }
    }
    if (data) {
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data)
      }
    }

    // 若还没有任何管理员，自动将当前用户设为 super_admin，避免首次登录卡住
    const { count } = await supabase
      .from('admin_users')
      .select('id', { count: 'exact', head: true })
    if (!count || count === 0) {
      const { data: created, error: insErr } = await supabase
        .from('admin_users')
        .insert([{ user_id: userId, role: 'super_admin', permissions: {} }])
        .select('id,user_id,role,permissions,created_at,updated_at')
        .maybeSingle()
      if (insErr) {
        return { statusCode: 500, body: insErr.message }
      }
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(created)
      }
    }

    // 否则不是管理员
    return { statusCode: 403, body: 'Forbidden' }
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || 'Unexpected error' }
  }
}

export { handler }


