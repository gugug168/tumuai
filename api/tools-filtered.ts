/**
 * ============================================================
 * Vercel API 代理层 - 支持筛选的工具列表
 * ============================================================
 * 功能：
 * - 服务端根据筛选条件获取工具列表
 * - 支持按分类、定价、功能特性筛选
 * - 解决客户端筛选只能看到第一页数据的问题
 * ============================================================
 */

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface ToolsFilteredResponse {
  tools: unknown[]
  count: number
  cached: boolean
  timestamp: string
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    // 1. 解析查询参数
    const limit = parseInt(request.query.limit as string) || 100
    const offset = parseInt(request.query.offset as string) || 0
    const category = request.query.category as string | undefined
    const pricing = request.query.pricing as string | undefined
    const features = request.query.features as string | undefined
    const sortBy = request.query.sortBy as string | undefined
    const includeCount = request.query.includeCount !== 'false'

    // 参数验证
    if (limit > 200) {
      return response.status(400).json({
        error: 'Limit cannot exceed 200'
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

    // 4. 构建查询
    let query = supabase
      .from('tools')
      .select('id,name,tagline,logo_url,categories,features,pricing,rating,views,upvotes,date_added,description,website_url')
      .eq('status', 'published')

    // 分类筛选 - 使用 overlaps 操作符匹配数组中的任意值
    if (category) {
      query = query.overlaps('categories', [category])
    }

    // 定价筛选
    if (pricing && ['Free', 'Freemium', 'Paid', 'Trial'].includes(pricing)) {
      query = query.eq('pricing', pricing)
    }

    // 功能特性筛选 - 支持多个功能（逗号分隔）
    if (features) {
      const featureArray = features.split(',').filter(f => f.trim())
      if (featureArray.length > 0) {
        query = query.overlaps('features', featureArray)
      }
    }

    // 排序
    const sortField = sortBy === 'date_added' ? 'date_added' :
                      sortBy === 'rating' ? 'rating' :
                      sortBy === 'views' ? 'views' :
                      'upvotes'
    query = query.order(sortField, { ascending: false })

    // 应用分页
    query = query.range(offset, offset + limit - 1)

    // 5. 执行查询
    const { data: tools, error: toolsError, count } = await query

    if (toolsError) {
      console.error('Supabase error:', toolsError)
      return response.status(500).json({
        error: 'Failed to fetch tools'
      })
    }

    // 6. 构建响应
    const result: ToolsFilteredResponse = {
      tools: tools || [],
      count: count || 0,
      cached: false,
      timestamp: new Date().toISOString()
    }

    // 7. 设置缓存头（较短的缓存时间，因为筛选结果变化较多）
    response.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300')

    return response.status(200).json(result)

  } catch (err: unknown) {
    const error = err as Error
    console.error('Tools filtered API error:', error)
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
 * 支持的查询参数：
 * - category: 分类名称（如：施工管理）
 * - pricing: 定价模式（Free/Freemium/Paid/Trial）
 * - features: 功能特性（逗号分隔，如：AI优化,参数化设计）
 * - sortBy: 排序字段（upvotes/date_added/rating/views）
 * - limit: 返回数量（默认100，最大200）
 * - offset: 偏移量（用于分页）
 *
 * 调用示例：
 * GET /api/tools-filtered?category=施工管理&limit=100
 * GET /api/tools-filtered?pricing=Freemium&sortBy=rating
 * GET /api/tools-filtered?features=AI优化,云端协作
 * ============================================================
 */
