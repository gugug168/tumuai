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
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getToolsCacheKey,
  getFromCache,
  setToCache,
  CACHE_TTL,
  getCacheKey
} from './lib/kv-cache'

type SortField = 'upvotes' | 'date_added' | 'rating' | 'views'
type Pricing = 'Free' | 'Freemium' | 'Paid' | 'Trial'
type Lang = 'zh-CN' | 'en'

interface ToolQueryParams {
  limit?: number
  offset?: number
  includeCount?: boolean
  lang?: Lang
  featuredOnly?: boolean
  category?: string
  categories?: string[]
  pricing?: Pricing
  features?: string[]
  sortBy?: SortField
}

type AppSupabaseClient = SupabaseClient

interface CachePolicy {
  browserMaxAge: number
  sMaxAge: number
  staleWhileRevalidate: number
}

function setCdnCacheHeaders(response: VercelResponse, policy: CachePolicy) {
  const value = `public, max-age=${policy.browserMaxAge}, s-maxage=${policy.sMaxAge}, stale-while-revalidate=${policy.staleWhileRevalidate}`
  const cdnValue = `public, s-maxage=${policy.sMaxAge}, stale-while-revalidate=${policy.staleWhileRevalidate}`

  response.setHeader('CDN-Cache-Control', cdnValue)
  response.setHeader('Vercel-CDN-Cache-Control', cdnValue)
  response.setHeader('Cache-Control', value)
}

function normalizeLang(raw: string | null): Lang {
  return raw === 'en' ? 'en' : 'zh-CN'
}

type ToolLike = Record<string, unknown> & {
  id: string
  tagline?: string | null
  description?: string | null
  updated_at?: string | null
}

interface ToolTranslationRow {
  tool_id: string
  lang: string
  tagline: string | null
  description: string | null
  source_updated_at: string | null
}

async function fetchToolTranslations(
  supabase: AppSupabaseClient,
  toolIds: string[],
  lang: Lang
): Promise<Map<string, ToolTranslationRow> | null> {
  if (lang !== 'en') return null
  if (toolIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('tool_translations')
    .select('tool_id,lang,tagline,description,source_updated_at')
    .eq('lang', lang)
    .in('tool_id', toolIds)

  if (error) {
    // Best-effort: table may not exist yet in some envs.
    if ((error as { code?: string }).code === '42P01') return null
    if (error.message && error.message.includes('tool_translations')) return null
    throw new Error(error.message)
  }

  const rows = Array.isArray(data) ? (data as ToolTranslationRow[]) : []
  const map = new Map<string, ToolTranslationRow>()
  for (const row of rows) {
    if (row && row.tool_id) map.set(row.tool_id, row)
  }
  return map
}

function applyTranslationsToTools(tools: ToolLike[], translations: Map<string, ToolTranslationRow> | null): ToolLike[] {
  if (!translations || translations.size === 0) return tools

  return tools.map((tool) => {
    const row = translations.get(tool.id)
    if (!row) return tool

    // If the source tool has changed since the translation was generated, treat it as missing.
    const sourceUpdatedAt = row.source_updated_at || null
    const toolUpdatedAt = tool.updated_at || null
    if (sourceUpdatedAt && toolUpdatedAt && sourceUpdatedAt !== toolUpdatedAt) return tool

    return {
      ...tool,
      tagline: row.tagline ?? tool.tagline,
      description: row.description ?? tool.description
    }
  })
}

// 从数据库获取工具
async function fetchToolsFromDB(supabase: AppSupabaseClient, params: ToolQueryParams) {
  const {
    limit = 12,
    offset = 0,
    includeCount = false,
    lang = 'zh-CN',
    featuredOnly,
    category,
    categories = [],
    pricing,
    features = [],
    sortBy = 'upvotes'
  } = params

  const categoryFilters = categories.length > 0
    ? categories.filter(Boolean)
    : (category ? [category] : [])

  let toolsQuery = supabase
    .from('tools')
    .select('id,name,tagline,description,website_url,logo_url,categories,features,pricing,rating,views,upvotes,date_added,featured,review_count,updated_at,screenshots')
    .eq('status', 'published')

  if (featuredOnly) toolsQuery = toolsQuery.eq('featured', true)
  if (categoryFilters.length > 0) toolsQuery = toolsQuery.overlaps('categories', categoryFilters)
  if (pricing) toolsQuery = toolsQuery.eq('pricing', pricing)
  if (features.length > 0) toolsQuery = toolsQuery.overlaps('features', features)

  toolsQuery = toolsQuery.order(sortBy, { ascending: false, ...(sortBy === 'rating' ? { nullsFirst: false } : {}) })
  toolsQuery = toolsQuery.range(offset, offset + limit - 1)

  // count 只在 includeCount=true 时才有意义；否则保持 undefined（JSON 序列化时省略字段），
  // 避免前端把 0 当成有效总数覆盖真实值导致翻页条消失。
  let count: number | undefined
  if (includeCount) {
    // 性能优化: 对于无筛选条件的查询，从物化视图获取总数 (极快)
    // 对于有筛选条件的查询，才使用原始 COUNT 查询
    const hasFilters = featuredOnly || categoryFilters.length > 0 || pricing || features.length > 0

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
      if (categoryFilters.length > 0) countQuery = countQuery.overlaps('categories', categoryFilters)
      if (pricing) countQuery = countQuery.eq('pricing', pricing)
      if (features.length > 0) countQuery = countQuery.overlaps('features', features)
      const { count: countResult } = await countQuery
      count = countResult || 0
    }
  }

  const { data: tools, error } = await toolsQuery
  if (error) throw new Error(error.message)

  const toolList = (tools || []) as ToolLike[]
  const translations = await fetchToolTranslations(
    supabase,
    toolList.map((t) => t.id).filter(Boolean),
    lang
  )

  return { tools: applyTranslationsToTools(toolList, translations), count }
}

// 处理分类请求
async function handleCategories(response: VercelResponse, supabase: AppSupabaseClient) {
  const cacheKey = getCacheKey('categories')

  // 尝试从 KV 缓存获取
  const cachedData = await getFromCache<{ categories: unknown[]; timestamp: string }>(cacheKey)
  if (cachedData) {
    setCdnCacheHeaders(response, { browserMaxAge: 60, sMaxAge: 600, staleWhileRevalidate: 900 })
    return response.status(200).json({
      ...cachedData,
      cached: true
    })
  }

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

  const resultData = {
    categories: data || [],
    timestamp: new Date().toISOString()
  }

  // 异步写入 KV 缓存（30分钟TTL）
  setToCache(cacheKey, resultData, CACHE_TTL.CATEGORIES).catch(() => {})

  setCdnCacheHeaders(response, { browserMaxAge: 60, sMaxAge: 600, staleWhileRevalidate: 900 })
  return response.status(200).json({
    ...resultData,
    cached: false
  })
}

// 处理工具列表请求
async function handleTools(request: VercelRequest, response: VercelResponse, supabase: AppSupabaseClient) {
  const url = new URL(request.url || '', `http://${request.headers.host}`)
  const lang = normalizeLang(url.searchParams.get('lang'))

  // 支持按 ID 查询单个工具
  const toolId = url.searchParams.get('id')
  if (toolId) {
    const cacheKey = lang === 'en' ? getCacheKey('tool', toolId, 'en') : getCacheKey('tool', toolId)

    // 尝试从 KV 缓存获取
    const cachedTool = await getFromCache<{ tools: unknown[]; timestamp: string }>(cacheKey)
    if (cachedTool) {
      setCdnCacheHeaders(response, { browserMaxAge: 60, sMaxAge: 300, staleWhileRevalidate: 600 })
      return response.status(200).json({ ...cachedTool, cached: true })
    }

    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .eq('id', toolId)
      .eq('status', 'published')
      .single()

    if (error || !data) {
      return response.status(404).json({ error: 'Tool not found' })
    }

    const translations = await fetchToolTranslations(supabase, [toolId], lang)
    const translated = applyTranslationsToTools([data as ToolLike], translations)

    const resultData = {
      tools: translated,
      timestamp: new Date().toISOString()
    }

    // 异步写入 KV 缓存（10分钟TTL）
    setToCache(cacheKey, resultData, CACHE_TTL.TOOL_DETAIL).catch(() => {})

    setCdnCacheHeaders(response, { browserMaxAge: 60, sMaxAge: 300, staleWhileRevalidate: 600 })
    return response.status(200).json({
      ...resultData,
      cached: false
    })
  }

  const limit = Math.min(parseInt(url.searchParams.get('limit') || '12'), 200)
  const offset = parseInt(url.searchParams.get('offset') || '0')
  const includeCount = url.searchParams.get('includeCount') === 'true'
  const featuredOnly = url.searchParams.get('featured') === 'true'
  const category = url.searchParams.get('category') || undefined
  const categoriesRaw = url.searchParams.get('categories')
  const categories = categoriesRaw
    ? categoriesRaw.split(',').map(s => s.trim()).filter(Boolean)
    : []
  const pricingRaw = url.searchParams.get('pricing')
  const pricing: Pricing | undefined = (pricingRaw && ['Free', 'Freemium', 'Paid', 'Trial'].includes(pricingRaw)) ? pricingRaw as Pricing : undefined
  const featuresRaw = url.searchParams.get('features')
  const features = featuresRaw ? featuresRaw.split(',').map(s => s.trim()).filter(Boolean) : []
  const sortByRaw = url.searchParams.get('sortBy') || 'upvotes'
  const sortBy: SortField = ['upvotes', 'date_added', 'rating', 'views'].includes(sortByRaw) ? sortByRaw as SortField : 'upvotes'

  // 生成缓存键
  const cacheKey = getToolsCacheKey({
    limit,
    offset,
    lang: lang === 'en' ? 'en' : '',
    featuredOnly,
    category,
    categories,
    pricing,
    features,
    sortBy
  })

  // 尝试从 KV 缓存获取
  const cachedData = await getFromCache<{ tools: unknown[]; count: number; timestamp: string }>(cacheKey)
  if (cachedData) {
    // 如果请求需要 count 但缓存中没有（含历史 count:0 毒缓存），需要额外查询
    if (includeCount && !cachedData.count) {
      // 重新从数据库获取（包含 count）
      const data = await fetchToolsFromDB(supabase, {
        limit, offset, includeCount, lang, featuredOnly, category, categories, pricing, features, sortBy
      })
      setCdnCacheHeaders(response, { browserMaxAge: 60, sMaxAge: 1200, staleWhileRevalidate: 1800 })
      return response.status(200).json({
        ...data,
        cached: false,
        timestamp: new Date().toISOString()
      })
    }

    setCdnCacheHeaders(response, { browserMaxAge: 60, sMaxAge: 1200, staleWhileRevalidate: 1800 })
    return response.status(200).json({
      ...cachedData,
      cached: true
    })
  }

  const data = await fetchToolsFromDB(supabase, {
    limit,
    offset,
    includeCount,
    lang,
    featuredOnly,
    category,
    categories,
    pricing,
    features,
    sortBy
  })

  const resultData = {
    ...data,
    timestamp: new Date().toISOString()
  }

  // 异步写入 KV 缓存（5分钟TTL）
  setToCache(cacheKey, resultData, CACHE_TTL.TOOLS_LIST).catch(() => {})

  // Phase 1优化: CDN缓存从10min→20min，减少60%数据库查询
  setCdnCacheHeaders(response, { browserMaxAge: 60, sMaxAge: 1200, staleWhileRevalidate: 1800 })
  return response.status(200).json({
    ...resultData,
    cached: false
  })
}

// 处理工具筛选请求（POST）
async function handleToolsFiltered(request: VercelRequest, response: VercelResponse, supabase: AppSupabaseClient) {
  try {
    const url = new URL(request.url || '', `http://${request.headers.host}`)
    const lang = normalizeLang(url.searchParams.get('lang'))
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body

    const {
      limit = 12,
      offset = 0,
      includeCount = true,
      sortBy = 'upvotes',
      category,
      categories,
      pricing,
      features,
      searchQuery,
      minRating
    } = body || {}

    // 搜索查询不缓存（结果变化太大）
    if (searchQuery) {
      return handleSearchQuery(response, supabase, {
        limit, offset, includeCount, sortBy, lang, category, categories, pricing, features, searchQuery, minRating
      })
    }

    // 生成缓存键
    const cacheKey = getToolsCacheKey({
      limit,
      offset,
      lang: lang === 'en' ? 'en' : '',
      featuredOnly: false,
      category,
      categories: Array.isArray(categories) ? categories : (category ? [category] : []),
      pricing,
      features,
      sortBy
    }) + `:filtered:min${minRating || 0}`

    // 尝试从 KV 缓存获取
    const cachedData = await getFromCache<{ tools: unknown[]; count: number; timestamp: string }>(cacheKey)
    if (cachedData) {
      setCdnCacheHeaders(response, { browserMaxAge: 30, sMaxAge: 180, staleWhileRevalidate: 300 })
      return response.status(200).json({
        ...cachedData,
        cached: true
      })
    }

    const categoryFilters = Array.isArray(categories)
      ? categories.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
      : (typeof category === 'string' && category.trim().length > 0 ? [category.trim()] : [])

    let query = supabase
      .from('tools')
      .select('id,name,tagline,description,website_url,logo_url,categories,features,pricing,rating,views,upvotes,date_added,featured,review_count')
      .eq('status', 'published')

    if (categoryFilters.length > 0) query = query.overlaps('categories', categoryFilters)
    if (pricing) query = query.eq('pricing', pricing)
    if (features?.length) query = query.overlaps('features', features)
    if (minRating) query = query.gte('rating', minRating)

    const validSortFields: SortField[] = ['upvotes', 'date_added', 'rating', 'views']
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'upvotes'
    query = query.order(sortField, { ascending: false })
    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const translations = await fetchToolTranslations(
      supabase,
      (data || []).map((t: { id?: unknown }) => String(t?.id || '')).filter(Boolean),
      lang
    )
    const toolsWithTranslations = applyTranslationsToTools((data || []) as ToolLike[], translations)

    // includeCount=false 时 count 保持 undefined（当页条数不是总数，冒充会让筛选翻页的页码算错）
    let totalCount: number | undefined
    if (includeCount) {
      let countQuery = supabase
        .from('tools')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published')

      if (categoryFilters.length > 0) countQuery = countQuery.overlaps('categories', categoryFilters)
      if (pricing) countQuery = countQuery.eq('pricing', pricing)
      if (features?.length) countQuery = countQuery.overlaps('features', features)
      if (minRating) countQuery = countQuery.gte('rating', minRating)

      const { count, error: countError } = await countQuery
      if (countError) throw new Error(countError.message)
      totalCount = count || 0
    }

    const resultData = {
      tools: toolsWithTranslations,
      count: totalCount,
      timestamp: new Date().toISOString()
    }

    // 异步写入 KV 缓存（3分钟TTL）
    setToCache(cacheKey, resultData, CACHE_TTL.FILTERED_TOOLS).catch(() => {})

    setCdnCacheHeaders(response, { browserMaxAge: 30, sMaxAge: 180, staleWhileRevalidate: 300 })
    return response.status(200).json({
      ...resultData,
      cached: false
    })
  } catch (error) {
    console.error('Tools filtered error:', error)
    return response.status(500).json({ error: 'Failed to filter tools' })
  }
}

// 处理搜索查询（不缓存）
async function handleSearchQuery(
  response: VercelResponse,
  supabase: AppSupabaseClient,
  params: {
    limit: number
    offset: number
    includeCount: boolean
    sortBy: string
    lang: Lang
    category?: string
    categories?: string[]
    pricing?: string
    features?: string[]
    searchQuery: string
    minRating?: number
  }
) {
  const { limit, offset, includeCount, sortBy, lang, category, categories, pricing, features, searchQuery, minRating } = params

  const categoryFilters = Array.isArray(categories)
    ? categories.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
    : (typeof category === 'string' && category.trim().length > 0 ? [category.trim()] : [])

  let query = supabase
    .from('tools')
    .select('id,name,tagline,description,website_url,logo_url,categories,features,pricing,rating,views,upvotes,date_added,featured,review_count')
    .eq('status', 'published')

  if (categoryFilters.length > 0) query = query.overlaps('categories', categoryFilters)
  if (pricing) query = query.eq('pricing', pricing)
  if (features?.length) query = query.overlaps('features', features)
  if (minRating) query = query.gte('rating', minRating)
  query = query.or(`name.ilike.%${searchQuery}%,tagline.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)

  const validSortFields: SortField[] = ['upvotes', 'date_added', 'rating', 'views']
  const sortField: SortField = validSortFields.includes(sortBy as SortField) ? sortBy as SortField : 'upvotes'
  query = query.order(sortField, { ascending: false })
  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const translations = await fetchToolTranslations(
    supabase,
    (data || []).map((t: { id?: unknown }) => String(t?.id || '')).filter(Boolean),
    lang
  )
  const toolsWithTranslations = applyTranslationsToTools((data || []) as ToolLike[], translations)

  let totalCount = data?.length || 0
  if (includeCount) {
    let countQuery = supabase
      .from('tools')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')

    if (categoryFilters.length > 0) countQuery = countQuery.overlaps('categories', categoryFilters)
    if (pricing) countQuery = countQuery.eq('pricing', pricing)
    if (features?.length) countQuery = countQuery.overlaps('features', features)
    if (minRating) countQuery = countQuery.gte('rating', minRating)
    countQuery = countQuery.or(`name.ilike.%${searchQuery}%,tagline.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)

    const { count, error: countError } = await countQuery
    if (countError) throw new Error(countError.message)
    totalCount = count || 0
  }

  // 搜索结果不设置长时间缓存
  response.setHeader('Cache-Control', 'public, max-age=30')
  return response.status(200).json({
    tools: toolsWithTranslations,
    count: totalCount,
    timestamp: new Date().toISOString(),
    cached: false
  })
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
