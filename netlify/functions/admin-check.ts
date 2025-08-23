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
    
    // 并行执行两个查询以提高性能
    const [adminResult, countResult] = await Promise.all([
      // 查找现有管理员
      supabase
        .from('admin_users')
        .select('id,user_id,role,permissions,created_at,updated_at')
        .eq('user_id', userId)
        .maybeSingle(),
      // 检查管理员总数
      supabase
        .from('admin_users')
        .select('id', { count: 'exact', head: true })
    ])

    const { data, error } = adminResult
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

    const { count } = countResult
    
    // 如果管理员表为空，或者当前用户是admin@civilaihub.com，则自动创建管理员
    const userEmail = userRes.user.email
    const shouldCreateAdmin = (!count || count === 0) || (userEmail === 'admin@civilaihub.com')
    
    if (shouldCreateAdmin) {
      const permissions = {
        manage_tools: true,
        manage_users: true,
        manage_submissions: true,
        manage_admins: true,
        view_analytics: true,
        system_settings: true
      }
      
      const { data: created, error: insErr } = await supabase
        .from('admin_users')
        .insert([{ user_id: userId, role: 'super_admin', permissions }])
        .select('id,user_id,role,permissions,created_at,updated_at')
        .maybeSingle()
      if (insErr) {
        // 如果是因为冲突（用户已存在），尝试更新
        if (insErr.code === '23505') {
          const { data: updated, error: updateErr } = await supabase
            .from('admin_users')
            .update({ role: 'super_admin', permissions, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .select('id,user_id,role,permissions,created_at,updated_at')
            .maybeSingle()
          if (updateErr) {
            return { statusCode: 500, body: updateErr.message }
          }
          return {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(updated)
          }
        }
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
  } catch (e: unknown) {
    return { statusCode: 500, body: (e as Error)?.message || 'Unexpected error' }
  }
}

export { handler }


