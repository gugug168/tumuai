import { Handler } from '@netlify/functions'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// 定义Tool类型
interface Tool {
  id: string
  name: string
  tagline: string
  description?: string | null
  logo_url: string | null
  categories: string[]
  features: string[]
  pricing: string
  rating: number
  views: number
  upvotes: number
  date_added: string
  status?: string
}

// 🔍 搜索缓存管理
interface SearchCacheItem {
  data: Tool[]
  timestamp: number
  ttl: number
  queryFingerprint: string
}

class SearchCache {
  private cache = new Map<string, SearchCacheItem>()
  private readonly defaultTTL = 2 * 60 * 1000 // 2分钟TTL（搜索结果变化较快）
  private readonly maxCacheSize = 100 // 最大缓存条目数
  
  get(key: string): Tool[] | null {
    const item = this.cache.get(key)
    if (!item || Date.now() > item.timestamp + item.ttl) {
      if (item) this.cache.delete(key)
      return null
    }
    return item.data
  }
  
  set(key: string, data: Tool[], customTTL?: number): void {
    // 清理过期缓存
    this.cleanup()
    
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: customTTL || this.defaultTTL,
      queryFingerprint: this.generateFingerprint(data)
    })
  }
  
  private cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.timestamp + item.ttl) {
        this.cache.delete(key)
      }
    }
  }
  
  private generateFingerprint(data: Tool[]): string {
    // 简单的数据指纹，用于验证缓存一致性
    return `${data.length}_${data[0]?.id || 'empty'}_${Date.now()}`
  }
  
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize
    }
  }
}

const searchCache = new SearchCache()

// 📊 搜索性能指标
interface SearchMetrics {
  totalSearches: number
  cacheHits: number
  averageResponseTime: number
  popularQueries: Map<string, number>
}

const searchMetrics: SearchMetrics = {
  totalSearches: 0,
  cacheHits: 0,
  averageResponseTime: 0,
  popularQueries: new Map()
}

// 🛠️ 查询优化工具函数
function normalizeSearchQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ')
}

function generateSearchCacheKey(params: {
  query: string
  categories?: string[]
  features?: string[]
  pricing?: string
  sortBy?: string
  sortOrder?: string
  limit?: number
}): string {
  const normalized = {
    ...params,
    query: normalizeSearchQuery(params.query || ''),
    categories: params.categories?.sort(),
    features: params.features?.sort()
  }
  
  return `search:${JSON.stringify(normalized)}`
}

// 🎯 智能搜索算法
async function executeOptimizedSearch(
  supabase: SupabaseClient,
  query: string,
  filters: {
    categories?: string[]
    features?: string[]
    pricing?: string
    sortBy?: string
    sortOrder?: string
    limit?: number
  }
) {
  const normalizedQuery = normalizeSearchQuery(query)
  const limit = Math.min(filters.limit || 20, 100)
  
  // 🚀 如果查询为空，返回按条件筛选的结果
  if (!normalizedQuery) {
    let queryBuilder = supabase
      .from('tools')
      .select('id,name,tagline,logo_url,categories,features,pricing,rating,views,upvotes,date_added')
      .eq('status', 'published')
    
    // 应用筛选条件
    if (filters.categories?.length) {
      queryBuilder = queryBuilder.overlaps('categories', filters.categories)
    }
    
    if (filters.features?.length) {
      queryBuilder = queryBuilder.overlaps('features', filters.features)
    }
    
    if (filters.pricing) {
      queryBuilder = queryBuilder.eq('pricing', filters.pricing)
    }
    
    // 应用排序
    const sortBy = filters.sortBy || 'upvotes'
    const sortOrder = filters.sortOrder === 'asc'
    
    queryBuilder = queryBuilder
      .order(sortBy, { ascending: sortOrder })
      .order('id', { ascending: false }) // 稳定排序
      .limit(limit)
    
    return await queryBuilder
  }
  
  // 🔍 尝试全文搜索（如果search_vector列存在）
  try {
    const { data: fullTextResults, error: fullTextError } = await supabase.rpc(
      'search_tools_optimized',
      {
        search_query: normalizedQuery,
        filter_categories: filters.categories || null,
        filter_features: filters.features || null,
        filter_pricing: filters.pricing || null,
        sort_by: filters.sortBy || 'upvotes',
        sort_order: filters.sortOrder || 'desc',
        limit_count: limit
      }
    )
    
    if (!fullTextError && fullTextResults?.length > 0) {
      return { data: fullTextResults, error: null }
    }
  } catch (fullTextError) {
    console.warn('⚠️ 全文搜索函数不可用，回退到基础搜索:', fullTextError)
  }
  
  // 🔄 回退到基础ILIKE搜索 + 三元组相似度
  const searchPattern = `%${normalizedQuery}%`
  
  let queryBuilder = supabase
    .from('tools')
    .select('id,name,tagline,logo_url,categories,features,pricing,rating,views,upvotes,date_added')
    .eq('status', 'published')
  
  // 🔍 多字段搜索条件
  if (normalizedQuery.length > 0) {
    queryBuilder = queryBuilder.or(
      `name.ilike.${searchPattern},tagline.ilike.${searchPattern},description.ilike.${searchPattern}`
    )
  }
  
  // 应用筛选条件
  if (filters.categories?.length) {
    queryBuilder = queryBuilder.overlaps('categories', filters.categories)
  }
  
  if (filters.features?.length) {
    queryBuilder = queryBuilder.overlaps('features', filters.features)
  }
  
  if (filters.pricing) {
    queryBuilder = queryBuilder.eq('pricing', filters.pricing)
  }
  
  // 应用排序
  const sortBy = filters.sortBy || 'upvotes'
  const sortOrder = filters.sortOrder === 'asc'
  
  queryBuilder = queryBuilder
    .order(sortBy, { ascending: sortOrder })
    .order('id', { ascending: false }) // 稳定排序
    .limit(limit)
  
  return await queryBuilder
}

// 🚀 主处理函数
const handler: Handler = async (event) => {
  const startTime = Date.now()
  searchMetrics.totalSearches++
  
  try {
    // 📥 解析搜索参数
    const queryParams = event.queryStringParameters || {}
    const method = event.httpMethod?.toUpperCase()
    
    // 支持POST请求的复杂搜索（从body解析）
    let searchParams: Record<string, unknown> = {}
    
    if (method === 'POST' && event.body) {
      try {
        searchParams = JSON.parse(event.body)
      } catch {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid JSON in request body' })
        }
      }
    } else {
      // GET请求从query parameters解析
      searchParams = {
        query: queryParams.q || queryParams.query || '',
        categories: queryParams.categories ? queryParams.categories.split(',') : undefined,
        features: queryParams.features ? queryParams.features.split(',') : undefined,
        pricing: queryParams.pricing || undefined,
        sortBy: queryParams.sortBy || 'upvotes',
        sortOrder: queryParams.sortOrder || 'desc',
        limit: parseInt(queryParams.limit || '20', 10)
      }
    }
    
    const {
      query = '',
      categories,
      features,
      pricing,
      sortBy = 'upvotes',
      sortOrder = 'desc',
      limit = 20
    } = searchParams
    
    // 📊 记录热门查询
    if (query) {
      const normalizedQuery = normalizeSearchQuery(query)
      if (normalizedQuery) {
        searchMetrics.popularQueries.set(
          normalizedQuery,
          (searchMetrics.popularQueries.get(normalizedQuery) || 0) + 1
        )
      }
    }
    
    // 🔑 生成缓存键
    const cacheKey = generateSearchCacheKey({
      query,
      categories,
      features,
      pricing,
      sortBy,
      sortOrder,
      limit
    })
    
    // 🎯 检查缓存
    const cachedResults = searchCache.get(cacheKey)
    if (cachedResults) {
      searchMetrics.cacheHits++
      const responseTime = Date.now() - startTime
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          'X-Cache-Status': 'HIT',
          'X-Search-Query': normalizeSearchQuery(query),
          'X-Response-Time': `${responseTime}ms`,
          'X-Results-Count': cachedResults.length.toString()
        },
        body: JSON.stringify({
          results: cachedResults,
          query: normalizeSearchQuery(query),
          total: cachedResults.length,
          cached: true,
          responseTime
        })
      }
    }
    
    // 🔧 Supabase配置
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    
    if (!supabaseUrl || !serviceKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Missing Supabase configuration' 
        })
      }
    }
    
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    })
    
    // 🔍 执行优化搜索
    const { data, error } = await executeOptimizedSearch(supabase, query, {
      categories,
      features,
      pricing,
      sortBy,
      sortOrder,
      limit: Math.min(limit, 100)
    })
    
    if (error) {
      console.error('❌ 搜索查询错误:', error)
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Search query failed',
          details: error.message
        })
      }
    }
    
    const results = data || []
    
    // 💾 存储到缓存
    searchCache.set(cacheKey, results)
    
    // 📊 更新性能指标
    const responseTime = Date.now() - startTime
    searchMetrics.averageResponseTime = 
      (searchMetrics.averageResponseTime + responseTime) / 2
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'X-Cache-Status': 'MISS',
        'X-Search-Query': normalizeSearchQuery(query),
        'X-Response-Time': `${responseTime}ms`,
        'X-Results-Count': results.length.toString(),
        'X-Search-Metrics': JSON.stringify({
          totalSearches: searchMetrics.totalSearches,
          cacheHitRate: ((searchMetrics.cacheHits / searchMetrics.totalSearches) * 100).toFixed(2) + '%',
          avgResponseTime: Math.round(searchMetrics.averageResponseTime)
        })
      },
      body: JSON.stringify({
        results,
        query: normalizeSearchQuery(query),
        total: results.length,
        cached: false,
        responseTime,
        filters: {
          categories: categories || [],
          features: features || [],
          pricing: pricing || null
        },
        sorting: {
          sortBy,
          sortOrder
        }
      })
    }
    
  } catch (err: unknown) {
    const error = err as Error
    console.error('❌ 搜索处理异常:', err)
    const responseTime = Date.now() - startTime
    
    return {
      statusCode: 500,
      headers: {
        'X-Response-Time': `${responseTime}ms`
      },
      body: JSON.stringify({
        error: 'Internal search error',
        message: error?.message || 'Unexpected error',
        timestamp: new Date().toISOString()
      })
    }
  }
}

export { handler }