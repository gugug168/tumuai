import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

// 安全响应头配置
const getSecurityHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache'
})

const handler: Handler = async (event) => {
  const startTime = Date.now()
  console.log('🔐 开始管理员权限验证...')
  
  try {
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) {
      return { statusCode: 500, headers: getSecurityHeaders(), body: JSON.stringify({ error: 'Missing Supabase server config' }) }
    }

    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, headers: getSecurityHeaders(), body: JSON.stringify({ error: 'Unauthorized' }) }
    }
    const accessToken = authHeader.replace(/^Bearer\s+/i, '')

    const supabase = createClient(supabaseUrl, serviceKey)

    // 验证JWT令牌格式和基本安全
    const tokenParts = accessToken.split('.')
    if (tokenParts.length !== 3) {
      console.log('⚠️ 无效的JWT令牌格式')
      return { statusCode: 401, headers: getSecurityHeaders(), body: JSON.stringify({ error: 'Invalid token format' }) }
    }
    
    // Verify token and get user id
    const authStartTime = Date.now()
    console.log('🔎 验证用户token...')
    const { data: userRes, error: userErr } = await supabase.auth.getUser(accessToken)
    console.log(`✅ Token验证完成: ${Date.now() - authStartTime}ms`)
    if (userErr || !userRes?.user) {
      console.log(`⚠️ Token验证失败: ${userErr?.message}`)
      return { statusCode: 401, headers: getSecurityHeaders(), body: JSON.stringify({ error: 'Invalid token' }) }
    }
    
    // 检查令牌是否即将过期（30分钟内）
    const tokenExp = userRes.user.app_metadata?.exp || userRes.user.user_metadata?.exp
    if (tokenExp && (tokenExp * 1000) < Date.now() + 30 * 60 * 1000) {
      console.log('⚠️ 令牌即将过期')
    }

    const userId = userRes.user.id
    
    // 并行执行两个查询以提高性能
    const dbStartTime = Date.now()
    console.log('📊 执行并行数据库查询...')
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
    console.log(`⚙️ 并行查询完成: ${Date.now() - dbStartTime}ms`)

    const { data, error } = adminResult
    if (error) {
      return { statusCode: 500, headers: getSecurityHeaders(), body: JSON.stringify({ error: error.message }) }
    }
    if (data) {
      const totalTime = Date.now() - startTime
      console.log(`✅ 管理员权限验证成功: ${totalTime}ms`)
      return {
        statusCode: 200,
        headers: getSecurityHeaders(),
        body: JSON.stringify({ ...data, _performance: { totalTime, hasParallelQuery: true } })
      }
    }

    const { count } = countResult
    
    // 如果管理员表为空，或者当前用户是授权管理员邮箱，则自动创建管理员
    const userEmail = userRes.user.email
    const adminEmail = process.env.E2E_ADMIN_USER
    
    // 额外安全检查：确保管理员邮箱已配置且用户邮箱已验证
    if (!adminEmail) {
      console.error('❌ 管理员邮箱未配置')
      return { statusCode: 500, headers: getSecurityHeaders(), body: JSON.stringify({ error: 'Admin configuration missing' }) }
    }
    
    if (!userRes.user.email_confirmed_at) {
      console.log('⚠️ 用户邮箱未验证，拒绝管理员权限')
      return { statusCode: 403, headers: getSecurityHeaders(), body: JSON.stringify({ error: 'Email verification required' }) }
    }
    
    const shouldCreateAdmin = (!count || count === 0) || (userEmail === adminEmail)
    
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
            return { statusCode: 500, headers: getSecurityHeaders(), body: JSON.stringify({ error: updateErr.message }) }
          }
          const totalTime = Date.now() - startTime
          console.log(`✅ 更新管理员成功: ${totalTime}ms`)
          return {
            statusCode: 200,
            headers: getSecurityHeaders(),
            body: JSON.stringify({ ...updated, _performance: { totalTime, wasUpdated: true } })
          }
        }
        return { statusCode: 500, headers: getSecurityHeaders(), body: JSON.stringify({ error: insErr.message }) }
      }
      const totalTime = Date.now() - startTime
      console.log(`✅ 创建管理员成功: ${totalTime}ms`)
      return {
        statusCode: 200,
        headers: getSecurityHeaders(),
        body: JSON.stringify({ ...created, _performance: { totalTime, wasCreated: true } })
      }
    }

    // 否则不是管理员
    return { statusCode: 403, headers: getSecurityHeaders(), body: JSON.stringify({ error: 'Forbidden' }) }
  } catch (e: unknown) {
    const totalTime = Date.now() - startTime
    console.error(`❌ 管理员验证失败: ${totalTime}ms`, e)
    return { statusCode: 500, headers: getSecurityHeaders(), body: JSON.stringify({ error: (e as Error)?.message || 'Unexpected error' }) }
  }
}

export { handler }


