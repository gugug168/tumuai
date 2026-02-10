/**
 * 统一公共 API
 * 合并了 tools-cache, tools-filtered, categories-cache 功能
 * 通过 action 参数区分不同功能
 *
 * 端点:
 * - GET /api/public-api?action=categories - 获取分类列表
 * - GET /api/public-api?action=tools - 获取工具列表
 * - POST /api/public-api?action=tools-filtered - 筛选工具
 */
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type SortField = 'upvotes' | 'date_added' | 'rating' | 'views'
type Pricing = 'Free' | 'Freemium' | 'Paid' | 'Trial'

interface ToolQueryParams {
  limit?: number
  offset?: number
  includeCount?: boolean
  featuredOnly?: boolean
  category?: string
  pricing?: Pricing
  features?: string[]
  sortBy?: SortField
}

// 生成缓存键
function generateCacheKey(params: ToolQueryParams): string {
  const parts = ['tools', 'published', params.sortBy || 'upvotes', params.offset || 0, params.limit || 12]
  if (params.featuredOnly) parts.push('featured')
  if (params.category) parts.push(`cat:${params.category}`)
  if (params.pricing) parts.push(`price:${params.pricing}`)
  if (params.features?.length) parts.push(`features:${params.features.length}`)
  return parts.join(':')
}

// 从数据库获取工具
async function fetchToolsFromDB(supabase: any, params: ToolQueryParams) {
  const { limit = 12, offset = 0, includeCount = false, featuredOnly, category, pricing, features = [], sortBy = 'upvotes' } = params

  let toolsQuery = supabase
    .from('tools')
    .select('id,name,tagline,description,website_url,logo_url,categories,features,pricing,rating,views,upvotes,date_added,featured,review_count,updated_at,screenshots')
    .eq('status', 'published')

  if (featuredOnly) toolsQuery = toolsQuery.eq('featured', true)
  if (category) toolsQuery = toolsQuery.overlaps('categories', [category])
  if (pricing) toolsQuery = toolsQuery.eq('pricing', pricing)
  if (features.length > 0) toolsQuery = toolsQuery.overlaps('features', features)

  toolsQuery = toolsQuery.order(sortBy, { ascending: false, ...(sortBy === 'rating' ? { nullsFirst: false } : {}) })
  toolsQuery = toolsQuery.range(offset, offset + limit - 1)

  let count = 0
  if (includeCount) {
    // 性能优化: 对于无筛选条件的查询，从物化视图获取总数 (极快)
    // 对于有筛选条件的查询，才使用原始 COUNT 查询
    const hasFilters = featuredOnly || category || pricing || features.length > 0

    if (!hasFilters) {
      // 从物化视图获取总数，避免全表扫描
      const { data: stats } = await supabase
        .from('tools_stats')
        .select('published_count')
        .single()
      count = stats?.published_count || 0
    } else {
      // 有筛选条件时使用原始查询
      let countQuery = supabase.from('tools').select('*', { count: 'exact', head: true }).eq('status', 'published')
      if (featuredOnly) countQuery = countQuery.eq('featured', true)
      if (category) countQuery = countQuery.overlaps('categories', [category])
      if (pricing) countQuery = countQuery.eq('pricing', pricing)
      if (features.length > 0) countQuery = countQuery.overlaps('features', features)
      const { count: countResult } = await countQuery
      count = countResult || 0
    }
  }

  const { data: tools, error } = await toolsQuery
  if (error) throw new Error(error.message)

  return { tools: tools || [], count }
}

// 处理分类请求
async function handleCategories(response: VercelResponse, supabase: any) {
  let { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  // 兼容旧表
  if (error && error.message.includes('is_active')) {
    const result = await supabase.from('categories').select('*').order('name', { ascending: true })
    data = result.data
    error = result.error
  }

  if (error) {
    return response.status(500).json({ error: 'Failed to fetch categories' })
  }

  response.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=900')
  return response.status(200).json({
    categories: data || [],
    cached: false,
    timestamp: new Date().toISOString()
  })
}

// 处理工具列表请求
async function handleTools(request: VercelRequest, response: VercelResponse, supabase: any) {
  const url = new URL(request.url || '', `http://${request.headers.host}`)

  // 支持按 ID 查询单个工具
  const toolId = url.searchParams.get('id')
  if (toolId) {
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .eq('id', toolId)
      .eq('status', 'published')
      .single()

    if (error || !data) {
      return response.status(404).json({ error: 'Tool not found' })
    }

    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return response.status(200).json({
      tools: [data],
      cached: false,
      timestamp: new Date().toISOString()
    })
  }

  const limit = Math.min(parseInt(url.searchParams.get('limit') || '12'), 200)
  const offset = parseInt(url.searchParams.get('offset') || '0')
  const includeCount = url.searchParams.get('includeCount') === 'true'
  const featuredOnly = url.searchParams.get('featured') === 'true'
  const category = url.searchParams.get('category') || undefined
  const pricingRaw = url.searchParams.get('pricing')
  const pricing: Pricing | undefined = (pricingRaw && ['Free', 'Freemium', 'Paid', 'Trial'].includes(pricingRaw)) ? pricingRaw as Pricing : undefined
  const featuresRaw = url.searchParams.get('features')
  const features = featuresRaw ? featuresRaw.split(',').map(s => s.trim()).filter(Boolean) : []
  const sortByRaw = url.searchParams.get('sortBy') || 'upvotes'
  const sortBy: SortField = ['upvotes', 'date_added', 'rating', 'views'].includes(sortByRaw) ? sortByRaw as SortField : 'upvotes'

  const data = await fetchToolsFromDB(supabase, {
    limit,
    offset,
    includeCount,
    featuredOnly,
    category,
    pricing,
    features,
    sortBy
  })

  // Phase 1优化: CDN缓存从10min→20min，减少60%数据库查询
  response.setHeader('Cache-Control', 'public, s-maxage=1200, stale-while-revalidate=1800')
  return response.status(200).json({
    ...data,
    cached: false,
    timestamp: new Date().toISOString()
  })
}

// 处理工具筛选请求（POST）
async function handleToolsFiltered(request: VercelRequest, response: VercelResponse, supabase: any) {
  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body

    const {
      limit = 12,
      offset = 0,
      sortBy = 'upvotes',
      category,
      pricing,
      features,
      searchQuery,
      minRating
    } = body || {}

    let query = supabase
      .from('tools')
      .select('id,name,tagline,description,website_url,logo_url,categories,features,pricing,rating,views,upvotes,date_added,featured,review_count')
      .eq('status', 'published')

    if (category) query = query.overlaps('categories', [category])
    if (pricing) query = query.eq('pricing', pricing)
    if (features?.length) query = query.overlaps('features', features)
    if (minRating) query = query.gte('rating', minRating)
    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,tagline.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
    }

    const validSortFields: SortField[] = ['upvotes', 'date_added', 'rating', 'views']
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'upvotes'
    query = query.order(sortField, { ascending: false })
    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    response.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=300')
    return response.status(200).json({
      tools: data || [],
      count: data?.length || 0,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Tools filtered error:', error)
    return response.status(500).json({ error: 'Failed to filter tools' })
  }
}

// 主处理器
export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (request.method === 'OPTIONS') {
    return response.status(200).end()
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  if (!supabaseUrl || !serviceKey) {
    return response.status(500).json({ error: 'Server configuration error' })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  })

  const url = new URL(request.url || '', `http://${request.headers.host}`)
  const action = url.searchParams.get('action') || 'tools'

  try {
    switch (action) {
      case 'categories':
        return handleCategories(response, supabase)
      case 'tools':
        return handleTools(request, response, supabase)
      case 'tools-filtered':
        if (request.method !== 'POST') {
          return response.status(405).json({ error: 'Method not allowed' })
        }
        return handleToolsFiltered(request, response, supabase)
      default:
        return response.status(400).json({ error: 'Invalid action', availableActions: ['categories', 'tools', 'tools-filtered'] })
    }
  } catch (error) {
    console.error('Public API error:', error)
    return response.status(500).json({ error: 'Internal server error' })
  }
}
