import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function handler(event: any, _context: any) {
  // 处理OPTIONS预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS'
      },
      body: ''
    }
  }

  try {
    const { data } = JSON.parse(event.body || '{}')
    const authHeader = event.headers.authorization
    
    // 验证管理员权限
    if (!authHeader) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: '未提供认证信息' })
      }
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !userData.user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: '无效的认证信息' })
      }
    }

    // 检查是否是管理员
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', userData.user.id)
      .single()

    if (adminError || !adminData) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: '无管理员权限' })
      }
    }

    let result

    switch (event.httpMethod) {
      case 'GET': {
        // 获取工具列表
        const { data: tools, error: toolsError } = await supabase
          .from('tools')
          .select(`
            *,
            categories!inner(name, color, icon)
          `)
          .order('created_at', { ascending: false })
        
        if (toolsError) throw toolsError
        result = tools
        break
      }

      case 'POST': {
        // 创建新工具
        const { data: newTool, error: createError } = await supabase
          .from('tools')
          .insert([{
            name: data.name,
            tagline: data.tagline,
            description: data.description,
            website_url: data.website_url,
            logo_url: data.logo_url,
            categories: data.categories,
            features: data.features,
            pricing: data.pricing,
            category_id: data.category_id,
            status: data.status || 'published',
            upvotes: 0,
            views: 0,
            favorites_count: 0,
            reviews_count: 0,
            comments_count: 0
          }])
          .select(`
            *,
            categories!inner(name, color, icon)
          `)
          .single()
        
        if (createError) throw createError
        result = newTool
        break
      }

      case 'PUT': {
        // 更新工具
        const { data: updatedTool, error: updateError } = await supabase
          .from('tools')
          .update({
            name: data.name,
            tagline: data.tagline,
            description: data.description,
            website_url: data.website_url,
            logo_url: data.logo_url,
            categories: data.categories,
            features: data.features,
            pricing: data.pricing,
            category_id: data.category_id,
            status: data.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.id)
          .select(`
            *,
            categories!inner(name, color, icon)
          `)
          .single()
        
        if (updateError) throw updateError
        result = updatedTool
        break
      }

      case 'DELETE': {
        // 删除工具
        const { error: deleteError } = await supabase
          .from('tools')
          .delete()
          .eq('id', data.id)
        
        if (deleteError) throw deleteError
        result = { success: true, id: data.id }
        break
      }

      default:
        return {
          statusCode: 405,
          body: JSON.stringify({ error: 'Method not allowed' })
        }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS'
      },
      body: JSON.stringify({ success: true, data: result })
    }

  } catch (error) {
    console.error('管理员工具操作错误:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: '服务器内部错误', 
        details: error.message 
      })
    }
  }
}

