import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const handler: Handler = async (event) => {
  try {
    // 1. 从URL路径中解析工具ID
    const pathParts = event.path.split('/')
    const toolId = pathParts[pathParts.length - 1]
    
    if (!toolId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Tool ID is required' })
      }
    }

    // 2. 获取Supabase配置
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    
    if (!supabaseUrl || !serviceKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing Supabase server config' })
      }
    }

    // 3. 创建Supabase客户端并获取工具详情
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .eq('id', toolId)
      .eq('status', 'published')  // 只返回已发布的工具
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Tool not found' })
        }
      }
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      }
    }

    // 4. 返回工具详情数据
    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=300'  // 5分钟缓存
      },
      body: JSON.stringify(data)
    }
  } catch (err: unknown) {
    const error = err as Error
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error?.message || 'Unexpected error' })
    }
  }
}

export { handler }