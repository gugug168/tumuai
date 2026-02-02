/**
 * ============================================================
 * Vercel API 代理层 - 工具列表缓存
 * ============================================================
 * 功能：
 * - 服务端获取工具列表，避免客户端直连 Supabase
 * - 使用 Cache-Control 头实现 CDN 层缓存
 * - 支持分页参数
 * Runtime: Edge (更快的冷启动和全球部署)
 * ============================================================
 */

// 指定使用 Edge Runtime 以获得更快的冷启动
export const config = {
  runtime: 'edge',
}

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface ToolsCacheResponse {
  tools: unknown[]
  count?: number
  cached: boolean
  timestamp: string
  version?: string  // 数据版本号
}

type SortField = 'upvotes' | 'date_added' | 'rating' | 'views'
type Pricing = 'Free' | 'Freemium' | 'Paid' | 'Trial'

// 数据版本号 - 当工具数据更新时需要修改此版本号
const DATA_VERSION = 'v1.0.7'  // 当前有106个工具

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    // 1. 解析查询参数
    const toolId = typeof request.query.id === 'string' ? request.query.id : undefined
    const limit = parseInt(request.query.limit as string) || 12
    const offset = parseInt(request.query.offset as string) || 0
    const includeCount = request.query.includeCount === 'true'
    const bypassCache = request.query.bypass === 'true'  // 强制绕过缓存
    const featuredOnly = request.query.featured === 'true'
    const category = typeof request.query.category === 'string' ? request.query.category : undefined
    const pricingRaw = typeof request.query.pricing === 'string' ? request.query.pricing : undefined
    const pricing: Pricing | undefined = (pricingRaw && (['Free', 'Freemium', 'Paid', 'Trial'] as const).includes(pricingRaw as Pricing))
      ? (pricingRaw as Pricing)
      : undefined
    const featuresRaw = typeof request.query.features === 'string' ? request.query.features : undefined
    const features = featuresRaw
      ? featuresRaw.split(',').map(s => s.trim()).filter(Boolean)
      : []
    const sortByRaw = (request.query.sortBy as string) || 'upvotes'
    const sortBy: SortField = (['upvotes', 'date_added', 'rating', 'views'] as const).includes(sortByRaw as SortField)
      ? (sortByRaw as SortField)
      : 'upvotes'

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

    // Fast path: fetch a single tool by id (used for tool detail pages).
    if (toolId) {
      const selectColumns = 'id,name,tagline,description,website_url,logo_url,categories,features,pricing,rating,views,upvotes,date_added,featured,review_count,updated_at'
      const { data, error } = await supabase
        .from('tools')
        .select(selectColumns)
        .eq('status', 'published')
        .eq('id', toolId)
        .maybeSingle()

      if (error) {
        console.error('Supabase error:', error)
        return response.status(500).json({ error: 'Failed to fetch tool' })
      }

      if (!data) {
        return response.status(404).json({ error: 'Tool not found' })
      }

      const result: ToolsCacheResponse = {
        tools: [data],
        cached: false,
        timestamp: new Date().toISOString(),
        version: DATA_VERSION
      }

      if (bypassCache) {
        response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        response.setHeader('Pragma', 'no-cache')
        response.setHeader('Expires', '0')
      } else {
        response.setHeader('Cache-Tag', ['tools', `tools-v${DATA_VERSION}`, `tool-${toolId}`].join(', '))
        response.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800')
        response.setHeader('CDN-Cache-Control', 'public, s-maxage=600')
        response.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=600')
      }

      return response.status(200).json(result)
    }

    const hasFilters = featuredOnly || !!category || !!pricing || features.length > 0

    // 4. 构建查询（可选 featured/category/pricing/features + 排序）
    let toolsQuery = supabase
      .from('tools')
      .select('id,name,tagline,description,website_url,logo_url,categories,features,pricing,rating,views,upvotes,date_added,featured,review_count,updated_at')
      .eq('status', 'published')

    if (featuredOnly) {
      toolsQuery = toolsQuery.eq('featured', true)
    }

    // 分类筛选（数组 overlaps）
    if (category) {
      toolsQuery = toolsQuery.overlaps('categories', [category])
    }

    // 定价筛选
    if (pricing) {
      toolsQuery = toolsQuery.eq('pricing', pricing)
    }

    // 功能特性筛选（多个 feature）
    if (features.length > 0) {
      toolsQuery = toolsQuery.overlaps('features', features)
    }

    // 排序字段白名单，避免任意字段注入
    toolsQuery = toolsQuery.order(sortBy, {
      ascending: false,
      ...(sortBy === 'rating' ? { nullsFirst: false } : {})
    })

    // 应用分页
    toolsQuery = toolsQuery.range(offset, offset + limit - 1)

    let countQuery = supabase
      .from('tools')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')

    if (featuredOnly) {
      countQuery = countQuery.eq('featured', true)
    }

    if (category) {
      countQuery = countQuery.overlaps('categories', [category])
    }

    if (pricing) {
      countQuery = countQuery.eq('pricing', pricing)
    }

    if (features.length > 0) {
      countQuery = countQuery.overlaps('features', features)
    }

    // 4. 并行获取数据和总数
    const [toolsResult, countResult] = await Promise.all([
      toolsQuery,
      includeCount
        ? countQuery
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
      timestamp: new Date().toISOString(),
      version: DATA_VERSION
    }

    // 7. 设置缓存头（Vercel Edge + CDN 缓存）
    // 如果 bypassCache=true，则不缓存
    if (bypassCache) {
      response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      response.setHeader('Pragma', 'no-cache')
      response.setHeader('Expires', '0')
    } else {
      // 使用 Cache-Tag 进行精确缓存控制
      const tags = [
        'tools',
        `tools-v${DATA_VERSION}`,
        hasFilters ? 'tools-filtered' : undefined,
        featuredOnly ? 'tools-featured' : undefined,
        sortBy !== 'upvotes' ? `tools-sort-${sortBy}` : undefined
      ].filter(Boolean)
      response.setHeader('Cache-Tag', tags.join(', '))

      if (hasFilters) {
        // 筛选结果变化更频繁：较短缓存
        response.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300')
        response.setHeader('CDN-Cache-Control', 'public, s-maxage=120')
        response.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=120')
      } else {
        // s-maxage: CDN 缓存 10 分钟（更容易命中缓存，首屏更快）
        // stale-while-revalidate: 后台刷新期间可使用过期缓存 30 分钟
        response.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800')
        response.setHeader('CDN-Cache-Control', 'public, s-maxage=600')
        response.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=600')
      }
    }

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
 * 2. 响应会被 Vercel Edge Network 缓存 2 分钟
 * 3. 所有用户共享同一份缓存，大幅降低数据库负载
 * 4. 数据版本控制：当工具数据更新时，修改 DATA_VERSION 常量
 *
 * 调用示例：
 * GET /api/tools-cache?limit=12&offset=0&includeCount=true
 *
 * 强制绕过缓存（用于调试）：
 * GET /api/tools-cache?limit=12&bypass=true
 *
 * 缓存失效方式：
 * - 修改 DATA_VERSION（推荐，最稳定）
 * - 或在 Vercel 控制台对缓存进行刷新/失效操作
 * ============================================================
 */
