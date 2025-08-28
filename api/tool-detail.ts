import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    // 1. 从查询参数中获取工具ID (Vercel格式)
    const toolId = request.query.id as string
    
    if (!toolId) {
      return response.status(400).json({ error: 'Tool ID is required' })
    }

    // 2. 获取Supabase配置
    const supabaseUrl = process.env.VITE_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    
    if (!supabaseUrl || !serviceKey) {
      return response.status(500).json({ error: 'Missing Supabase server config' })
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
        return response.status(404).json({ error: 'Tool not found' })
      }
      return response.status(500).json({ error: error.message })
    }

    // 4. 返回工具详情数据
    response.setHeader('Cache-Control', 'public, max-age=300') // 5分钟缓存
    return response.status(200).json(data)
  } catch (err: unknown) {
    const error = err as Error
    return response.status(500).json({ 
      error: error?.message || 'Unexpected error' 
    })
  }
}