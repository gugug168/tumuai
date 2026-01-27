/**
 * ============================================================
 * Vercel API 代理层 - 工具列表缓存
 * ============================================================
 * 功能：
 * - 服务端获取工具列表，避免客户端直连 Supabase
 * - 使用 Cache-Control 头实现 CDN 层缓存
 * - 支持分页参数
 * ============================================================
 */

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface ToolsCacheResponse {
  tools: unknown[]
  count?: number
  cached: boolean
  timestamp: string
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    // 1. 解析查询参数
    const limit = parseInt(request.query.limit as string) || 12
    const offset = parseInt(request.query.offset as string) || 0
    const includeCount = request.query.includeCount === 'true'

    // 参数验证
    if (limit > 100) {
      return response.status(400).json({
        error: 'Limit cannot exceed 100'
      })
    }

    if (offset < 0) {
      return response.status(400).json({
        error: 'Offset must be non-negative'
      })
    }

    // 2. 获取 Supabase 配置
    const supabaseUrl = process.env.VITE_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

    if (!supabaseUrl || !serviceKey) {
      console.error('Missing Supabase server config')
      return response.status(500).json({
        error: 'Server configuration error'
      })
    }

    // 3. 创建 Supabase 客户端（使用服务端密钥）
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false
      }
    })

    // 4. 并行获取数据和总数
    const [toolsResult, countResult] = await Promise.all([
      supabase
        .from('tools')
        .select('id,name,tagline,logo_url,categories,features,pricing,rating,views,upvotes,date_added')
        .eq('status', 'published')
        .order('upvotes', { ascending: false })
        .range(offset, offset + limit - 1),
      includeCount
        ? supabase
            .from('tools')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'published')
        : Promise.resolve({ count: null, error: null })
    ])

    // 5. 错误处理
    if (toolsResult.error) {
      console.error('Supabase error:', toolsResult.error)
      return response.status(500).json({
        error: 'Failed to fetch tools'
      })
    }

    if (includeCount && countResult.error) {
      console.error('Count error:', countResult.error)
    }

    // 6. 构建响应
    const result: ToolsCacheResponse = {
      tools: toolsResult.data || [],
      count: countResult.count || undefined,
      cached: false,
      timestamp: new Date().toISOString()
    }

    // 7. 设置缓存头（Vercel Edge + CDN 缓存）
    // - s-maxage: CDN 缓存 5 分钟
    // - stale-while-revalidate: 后台刷新期间可使用过期缓存 10 分钟
    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

    // 8. 添加额外的缓存优化头
    response.setHeader('CDN-Cache-Control', 'public, s-maxage=300')
    response.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=300')

    return response.status(200).json(result)

  } catch (err: unknown) {
    const error = err as Error
    console.error('Tools cache API error:', error)
    return response.status(500).json({
      error: error?.message || 'Unexpected error'
    })
  }
}

/**
 * ============================================================
 * 使用说明
 * ============================================================
 *
 * 1. 在 Vercel 部署后，此 API 自动启用 Edge Runtime
 * 2. 响应会被 Vercel Edge Network 缓存 5 分钟
 * 3. 所有用户共享同一份缓存，大幅降低数据库负载
 *
 * 调用示例：
 * GET /api/tools-cache?limit=12&offset=0&includeCount=true
 *
 * 4. 要强制刷新缓存，可以添加时间戳参数：
 * GET /api/tools-cache?limit=12&_t=1234567890
 * ============================================================
 */
