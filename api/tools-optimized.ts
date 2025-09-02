import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// 🚀 内存缓存实现（适合Netlify Functions短时间缓存）
interface CacheItem {
  data: unknown
  timestamp: number
  ttl: number
}

class MemoryCache {
  private cache = new Map<string, CacheItem>()
  
  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null
    
    if (Date.now() > item.timestamp + item.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return item.data as T
  }
  
  set<T>(key: string, data: T, ttl: number = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
    
    // 🧹 清理过期项（防止内存泄漏）
    this.cleanup()
  }
  
  private cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.timestamp + item.ttl * 2) {
        this.cache.delete(key)
      }
    }
  }
  
  clear(): void {
    this.cache.clear()
  }
  
  size(): number {
    return this.cache.size
  }
}

// 全局缓存实例
const cache = new MemoryCache()

// 📊 缓存配置
const CACHE_CONFIG = {
  DEFAULT_TTL: 60 * 1000,      // 60秒
  STALE_WHILE_REVALIDATE: 300, // 5分钟
  MAX_AGE: 60                  // 1分钟
}

// 🎯 生成缓存键
function generateCacheKey(params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key]
      return acc
    }, {} as Record<string, unknown>)
  
  return `tools:${JSON.stringify(sortedParams)}`
}

// 📈 性能监控
interface PerformanceMetrics {
  cacheHits: number
  cacheMisses: number
  totalRequests: number
  averageResponseTime: number
}

const metrics: PerformanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  totalRequests: 0,
  averageResponseTime: 0
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const startTime = Date.now()
  metrics.totalRequests++
  
  try {
    // 📥 解析请求参数
    const queryParams = request.query || {}
    const limit = Math.min(parseInt(Array.isArray(queryParams.limit) ? queryParams.limit[0] || '60' : queryParams.limit || '60', 10), 200)
    const sortBy = queryParams.sortBy || 'upvotes'
    const sortOrder = queryParams.sortOrder || 'desc'
    const category = queryParams.category
    const pricing = queryParams.pricing
    const featured = queryParams.featured === 'true'
    
    // 🔑 生成缓存键
    const cacheKey = generateCacheKey({
      limit,
      sortBy,
      sortOrder,
      category,
      pricing,
      featured
    })
    
    // 🎯 检查缓存
    const cachedData = cache.get(cacheKey)
    if (cachedData) {
      metrics.cacheHits++
      const responseTime = Date.now() - startTime
      metrics.averageResponseTime = (metrics.averageResponseTime + responseTime) / 2
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_CONFIG.MAX_AGE}, stale-while-revalidate=${CACHE_CONFIG.STALE_WHILE_REVALIDATE}`,
          'X-Cache-Status': 'HIT',
          'X-Cache-Key': cacheKey,
          'X-Response-Time': `${responseTime}ms`,
          'X-Cache-Metrics': JSON.stringify({
            hits: metrics.cacheHits,
            misses: metrics.cacheMisses,
            hitRate: (metrics.cacheHits / metrics.totalRequests * 100).toFixed(2) + '%'
          })
        },
        body: JSON.stringify(cachedData)
      }
    }
    
    metrics.cacheMisses++
    
    // 🔧 Supabase客户端配置
    const supabaseUrl = process.env.VITE_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    
    if (!supabaseUrl || !serviceKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Missing Supabase server config',
          timestamp: new Date().toISOString()
        })
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false
      }
    })

    // 🚀 构建优化查询
    let queryBuilder = supabase
      .from('tools')
      .select('id,name,tagline,logo_url,categories,features,pricing,rating,views,upvotes,date_added,updated_at')
      .eq('status', 'published')
    
    // 🔍 应用过滤条件
    if (category) {
      queryBuilder = queryBuilder.contains('categories', [category])
    }
    
    if (pricing) {
      queryBuilder = queryBuilder.eq('pricing', pricing)
    }
    
    if (featured) {
      queryBuilder = queryBuilder.eq('featured', true)
    }
    
    // 🎯 应用排序（使用优化后的索引）
    switch (sortBy) {
      case 'views':
        queryBuilder = queryBuilder.order('views', { ascending: sortOrder === 'asc' })
        break
      case 'rating':
        queryBuilder = queryBuilder.order('rating', { ascending: sortOrder === 'asc' })
        break
      case 'date_added':
        queryBuilder = queryBuilder.order('date_added', { ascending: sortOrder === 'asc' })
        break
      case 'name':
        queryBuilder = queryBuilder.order('name', { ascending: sortOrder === 'asc' })
        break
      default: // upvotes
        queryBuilder = queryBuilder.order('upvotes', { ascending: sortOrder === 'asc' })
        break
    }
    
    // 添加稳定排序
    queryBuilder = queryBuilder.order('id', { ascending: false })
    
    // 应用限制
    queryBuilder = queryBuilder.limit(limit)

    // 📊 执行查询
    const { data, error } = await queryBuilder

    if (error) {
      console.error('❌ Database query error:', error)
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Database query failed',
          details: error.message,
          timestamp: new Date().toISOString()
        })
      }
    }

    // 💾 存储到缓存
    cache.set(cacheKey, data || [], CACHE_CONFIG.DEFAULT_TTL)
    
    // 📊 性能指标
    const responseTime = Date.now() - startTime
    metrics.averageResponseTime = (metrics.averageResponseTime + responseTime) / 2

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CACHE_CONFIG.MAX_AGE}, stale-while-revalidate=${CACHE_CONFIG.STALE_WHILE_REVALIDATE}`,
        'X-Cache-Status': 'MISS',
        'X-Cache-Key': cacheKey,
        'X-Response-Time': `${responseTime}ms`,
        'X-Database-Rows': (data?.length || 0).toString(),
        'X-Cache-Size': cache.size().toString(),
        'X-Cache-Metrics': JSON.stringify({
          hits: metrics.cacheHits,
          misses: metrics.cacheMisses,
          hitRate: (metrics.cacheHits / metrics.totalRequests * 100).toFixed(2) + '%'
        })
      },
      body: JSON.stringify(data || [])
    }
  } catch (err: unknown) {
    const error = err as Error
    console.error('❌ Unexpected error:', err)
    const responseTime = Date.now() - startTime
    
    return {
      statusCode: 500,
      headers: {
        'X-Response-Time': `${responseTime}ms`
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error?.message || 'Unexpected error',
        timestamp: new Date().toISOString()
      })
    }
  }
}

// Exported as default function