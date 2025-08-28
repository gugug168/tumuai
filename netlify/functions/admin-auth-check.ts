import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

// 服务端权限验证函数
const handler: Handler = async (event, context) => {
  // 设置CORS头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    }
  }

  try {
    // 获取Authorization header
    const authHeader = event.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: '缺少或无效的认证令牌' }),
      }
    }

    const token = authHeader.substring(7) // 移除 "Bearer " 前缀

    // 使用service_role_key创建Supabase客户端
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: '服务器配置错误' }),
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // 验证JWT令牌并获取用户信息
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: '无效的认证令牌' }),
      }
    }

    // 检查用户是否是管理员（使用数据库验证）
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id, user_id, role, permissions, created_at, updated_at')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminUser) {
      // 用户不是管理员
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: '权限不足：您不是管理员用户',
          isAdmin: false 
        }),
      }
    }

    // 更新最后登录时间
    await supabase
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', adminUser.id)

    // 返回管理员信息
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        isAdmin: true,
        user: {
          id: adminUser.id,
          user_id: adminUser.user_id,
          email: user.email,
          role: adminUser.role,
          permissions: adminUser.permissions,
          is_super_admin: adminUser.role === 'super_admin'
        },
        message: '管理员权限验证成功'
      }),
    }

  } catch (error) {
    console.error('权限验证错误:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: '服务器内部错误',
        details: error instanceof Error ? error.message : '未知错误'
      }),
    }
  }
}

export { handler }