import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(request: VercelRequest, response: VercelResponse) {
  // 设置CORS头
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS')

  // 处理OPTIONS预检请求
  if (request.method === 'OPTIONS') {
    return response.status(200).end()
  }

  try {
    const authHeader = request.headers.authorization
    
    // 验证管理员权限
    if (!authHeader) {
      return response.status(401).json({ error: '未提供认证信息' })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !userData.user) {
      return response.status(401).json({ error: '无效的认证信息' })
    }

    // 检查是否是管理员
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', userData.user.id)
      .single()

    if (adminError || !adminData) {
      return response.status(403).json({ error: '无管理员权限' })
    }

    let result

    switch (request.method) {
      case 'GET': {
        // 获取工具列表
        const { data: tools, error: toolsError } = await supabase
          .from('tools')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (toolsError) throw toolsError
        result = { tools: tools || [] }
        break
      }

      case 'POST': {
        // 创建新工具
        const toolData = request.body
        const { data: newTool, error: createError } = await supabase
          .from('tools')
          .insert([{
            name: toolData.name,
            tagline: toolData.tagline,
            description: toolData.description,
            website_url: toolData.website_url,
            logo_url: toolData.logo_url,
            categories: toolData.categories || [],
            features: toolData.features || [],
            pricing: toolData.pricing || 'Free',
            status: toolData.status || 'published',
            upvotes: 0,
            views: 0,
            rating: 0,
            review_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            date_added: new Date().toISOString()
          }])
          .select()
          .single()
        
        if (createError) throw createError
        result = { tool: newTool }
        break
      }

      case 'PUT': {
        // 更新工具
        const toolData = request.body
        const toolId = request.query.id
        
        if (!toolId) {
          return response.status(400).json({ error: '缺少工具ID' })
        }

        const { data: updatedTool, error: updateError } = await supabase
          .from('tools')
          .update({
            name: toolData.name,
            tagline: toolData.tagline,
            description: toolData.description,
            website_url: toolData.website_url,
            logo_url: toolData.logo_url,
            categories: toolData.categories,
            features: toolData.features,
            pricing: toolData.pricing,
            status: toolData.status,
            featured: toolData.featured,
            updated_at: new Date().toISOString()
          })
          .eq('id', toolId)
          .select()
          .single()
        
        if (updateError) throw updateError
        result = { tool: updatedTool }
        break
      }

      case 'DELETE': {
        // 删除工具
        const toolId = request.query.id
        
        if (!toolId) {
          return response.status(400).json({ error: '缺少工具ID' })
        }

        const { error: deleteError } = await supabase
          .from('tools')
          .delete()
          .eq('id', toolId)
        
        if (deleteError) throw deleteError
        result = { message: '工具删除成功' }
        break
      }

      default:
        return response.status(405).json({ error: '不支持的请求方法' })
    }

    return response.status(200).json(result)

  } catch (error) {
    console.error('Admin tools CRUD error:', error)
    return response.status(500).json({ 
      error: '服务器内部错误',
      details: error instanceof Error ? error.message : '未知错误'
    })
  }
}