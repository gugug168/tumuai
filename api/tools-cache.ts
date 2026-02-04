/**
 * ============================================================
 * Vercel API 代理层 - 工具列表缓存 (集成 KV 缓存)
 * ============================================================
 * 功能：
 * - 使用 Vercel KV 缓存频繁访问的数据
 * - 降低数据库查询压力
 * - 提升响应速度
 * ============================================================
 */

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getKVClient,
  getOrSetCache,
  deleteCacheByPattern,
  CACHE_KEYS,
  CACHE_TTL,
} from '../src/lib/kv-cache'

interface ToolsCacheResponse {
  tools: unknown[]
  count?: number
  cached: boolean
  timestamp: string
  version?: string
  fromKV?: boolean
}

type SortField = 'upvotes' | 'date_added' | 'rating' | 'views'
type Pricing = 'Free' | 'Freemium' | 'Paid' | 'Trial'

const DATA_VERSION = 'v1.1.0'  // 2026-02-03 KV 缓存集成

/**
 * 生成缓存键
 */
function generateCacheKey(params: {
  limit: number
  offset: number
  sortBy: SortField
  hasFilters: boolean
  featuredOnly?: boolean
  category?: string
  pricing?: Pricing
  featureCount?: number
}): string {
  const parts = [
    CACHE_KEYS.TOOLS_LIST,
    'published',
    params.sortBy,
    params.offset,
    params.limit,
  ]

  if (params.featuredOnly) parts.push('featured')
  if (params.category) parts.push(`cat:${params.category}`)
  if (params.pricing) parts.push(`price:${params.pricing}`)
  if (params.featureCount && params.featureCount > 0) {
    parts.push(`features:${params.featureCount}`)
  }

  return parts.join(':')
}

/**
 * 从数据库获取工具列表
 */
async function fetchToolsFromDB(
  supabase: any,
  params: {
    limit: number
    offset: number
    includeCount: boolean
    featuredOnly?: boolean
    category?: string
    pricing?: Pricing
    features: string[]
    sortBy: SortField
  }
) {
  const { limit, offset, includeCount, featuredOnly, category, pricing, features, sortBy } = params

  let toolsQuery = supabase
    .from('tools')
    .select('id,name,tagline,description,website_url,logo_url,categories,features,pricing,rating,views,upvotes,date_added,featured,review_count,updated_at,screenshots')
    .eq('status', 'published')

  if (featuredOnly) {
    toolsQuery = toolsQuery.eq('featured', true)
  }

  if (category) {
    toolsQuery = toolsQuery.overlaps('categories', [category])
  }

  if (pricing) {
    toolsQuery = toolsQuery.eq('pricing', pricing)
  }

  if (features.length > 0) {
    toolsQuery = toolsQuery.overlaps('features', features)
  }

  toolsQuery = toolsQuery.order(sortBy, {
    ascending: false,
    ...(sortBy === 'rating' ? { nullsFirst: false } : {})
  })

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

  const [toolsResult, countResult] = await Promise.all([
    toolsQuery,
    includeCount
      ? countQuery
      : Promise.resolve({ count: null, error: null })
  ])

  if (toolsResult.error) {
    throw new Error(toolsResult.error.message)
  }

  return {
    tools: toolsResult.data || [],
    count: countResult.count || undefined,
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    // 解析参数
    const limit = parseInt(request.query.limit as string) || 12
    const offset = parseInt(request.query.offset as string) || 0
    const includeCount = request.query.includeCount === 'true'
    const bypassCache = request.query.bypass === 'true'
    const refreshCache = request.query.refresh === 'true'
    const featuredOnly = request.query.featured === 'true'
    const category = typeof request.query.category === 'string' ? request.query.category : undefined
    const pricingRaw = typeof request.query.pricing === 'string' ? request.query.pricing : undefined
    const pricing: Pricing | undefined = (pricingRaw && (['Free', 'Freemium', 'Paid', 'Trial'] as const).includes(pricingRaw as Pricing))
      ? (pricingRaw as Pricing)
      : undefined
    const featuresRaw = typeof request.query.features === 'string' ? request.query.features : undefined
    const features = featuresRaw ? featuresRaw.split(',').map(s => s.trim()).filter(Boolean) : []
    const sortByRaw = (request.query.sortBy as string) || 'upvotes'
    const sortBy: SortField = (['upvotes', 'date_added', 'rating', 'views'] as const).includes(sortByRaw as SortField)
      ? (sortByRaw as SortField)
      : 'upvotes'

    // 参数验证
    if (limit > 200) {
      return response.status(400).json({ error: 'Limit cannot exceed 200' })
    }

    if (offset < 0) {
      return response.status(400).json({ error: 'Offset must be non-negative' })
    }

    // 获取 Supabase 配置
    const supabaseUrl = process.env.VITE_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

    if (!supabaseUrl || !serviceKey) {
      console.error('Missing Supabase server config')
      return response.status(500).json({ error: 'Server configuration error' })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    })

    const kv = getKVClient()
    const hasKV = kv !== null

    // 生成缓存键
    const cacheKey = generateCacheKey({
      limit,
      offset,
      sortBy,
      hasFilters: featuredOnly || !!category || !!pricing || features.length > 0,
      featuredOnly,
      category,
      pricing,
      featureCount: features.length,
    })

    // 如果需要刷新缓存，先删除
    if (refreshCache && hasKV) {
      await deleteCacheByPattern(`${CACHE_KEYS.TOOLS_LIST}:*`)
    }

    // 尝试从 KV 缓存获取 (如果启用且未绕过)
    if (hasKV && !bypassCache && !refreshCache) {
      const cached = await getOrSetCache(
        cacheKey,
        () => fetchToolsFromDB(supabase, {
          limit,
          offset,
          includeCount,
          featuredOnly,
          category,
          pricing,
          features,
          sortBy,
        }),
        CACHE_TTL.TOOLS_LIST
      )

      if (cached) {
        const result: ToolsCacheResponse = {
          ...cached,
          cached: true,
          timestamp: new Date().toISOString(),
          version: DATA_VERSION,
          fromKV: true,
        }

        // 设置 CDN 缓存头
        response.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600')
        response.setHeader('CDN-Cache-Control', 'public, s-maxage=900')
        return response.status(200).json(result)
      }
    }

    // 直接从数据库获取
    const data = await fetchToolsFromDB(supabase, {
      limit,
      offset,
      includeCount,
      featuredOnly,
      category,
      pricing,
      features,
      sortBy,
    })

    const result: ToolsCacheResponse = {
      ...data,
      cached: false,
      timestamp: new Date().toISOString(),
      version: DATA_VERSION,
      fromKV: false,
    }

    // 设置缓存头
    response.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600')
    response.setHeader('CDN-Cache-Control', 'public, s-maxage=900')

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
 * 环境变量配置
 * ============================================================
 *
 * 在 Vercel Dashboard 中添加以下环境变量:
 * - KV_REST_API_URL: Vercel KV REST API URL
 * - KV_REST_API_TOKEN: Vercel KV REST API Token
 *
 * 创建 KV 数据库:
 * 1. 进入 Vercel Dashboard -> 项目 -> Storage
 * 2. 点击 "Create Database" -> "KV"
 * 3. 选择区域并创建
 * 4. 自动注入环境变量
 *
 * ============================================================
 */
