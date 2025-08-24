import { createClient } from '@supabase/supabase-js'
import type { Tool, ToolSearchFilters } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true
  }
})

// 🚀 客户端缓存管理器
class ClientCache {
  private cache = new Map<string, {
    data: unknown
    timestamp: number
    ttl: number
    stale: boolean
  }>()
  
  private readonly defaultTTL = 60 * 1000 // 60秒
  private readonly staleTime = 5 * 60 * 1000 // 5分钟过期标记
  
  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null
    
    const now = Date.now()
    
    // 标记为过期但仍可用（stale-while-revalidate）
    if (now > item.timestamp + item.ttl) {
      item.stale = true
    }
    
    // 完全过期，删除
    if (now > item.timestamp + this.staleTime) {
      this.cache.delete(key)
      return null
    }
    
    return item.data
  }
  
  set<T>(key: string, data: T, customTTL?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: customTTL || this.defaultTTL,
      stale: false
    })
    
    // 清理过期缓存
    this.cleanup()
  }
  
  isStale(key: string): boolean {
    const item = this.cache.get(key)
    return item?.stale || false
  }
  
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }
  
  private cleanup(): void {
    const now = Date.now()
    let cleanedCount = 0
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.timestamp + this.staleTime) {
        this.cache.delete(key)
        cleanedCount++
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 缓存清理: 删除 ${cleanedCount} 个过期项`)
    }
  }
  
  getStats() {
    return {
      size: this.cache.size,
      items: Array.from(this.cache.entries()).map(([key, item]) => ({
        key,
        age: Date.now() - item.timestamp,
        stale: item.stale
      }))
    }
  }
  
  clear(): void {
    this.cache.clear()
  }
}

const clientCache = new ClientCache()

// 📊 API性能监控
interface ApiMetrics {
  totalRequests: number
  cacheHits: number
  networkRequests: number
  averageResponseTime: number
  errorCount: number
}

const apiMetrics: ApiMetrics = {
  totalRequests: 0,
  cacheHits: 0,
  networkRequests: 0,
  averageResponseTime: 0,
  errorCount: 0
}

// 🔧 工具函数
function generateCacheKey(endpoint: string, params?: Record<string, unknown>): string {
  if (!params) return endpoint
  
  // 排序参数以确保缓存键一致性
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      if (params[key] !== undefined && params[key] !== null) {
        acc[key] = params[key]
      }
      return acc
    }, {} as Record<string, unknown>)
  
  return `${endpoint}:${JSON.stringify(sortedParams)}`
}

async function fetchWithCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  customTTL?: number
): Promise<T> {
  const startTime = Date.now()
  apiMetrics.totalRequests++
  
  try {
    // 🎯 检查缓存
    const cached = clientCache.get<T>(cacheKey)
    if (cached !== null) {
      apiMetrics.cacheHits++
      
      // 如果缓存过期，后台刷新
      if (clientCache.isStale(cacheKey)) {
        console.log('🔄 后台刷新缓存:', cacheKey)
        fetcher()
          .then(fresh => clientCache.set(cacheKey, fresh, customTTL))
          .catch(err => console.warn('⚠️ 后台刷新失败:', err))
      }
      
      return cached
    }
    
    // 📡 网络请求
    apiMetrics.networkRequests++
    const data = await fetcher()
    
    // 💾 存储到缓存
    clientCache.set(cacheKey, data, customTTL)
    
    // 📊 更新性能指标
    const responseTime = Date.now() - startTime
    apiMetrics.averageResponseTime = 
      (apiMetrics.averageResponseTime + responseTime) / 2
    
    return data
  } catch (error) {
    apiMetrics.errorCount++
    console.error(`❌ API请求失败 [${cacheKey}]:`, error)
    throw error
  }
}

// 🚀 优化后的API函数

// 获取工具列表（优化版本）
export async function getToolsOptimized(params?: {
  limit?: number
  sortBy?: string
  sortOrder?: string
  category?: string
  pricing?: string
  featured?: boolean
}): Promise<Tool[]> {
  const { limit = 60, sortBy, sortOrder, category, pricing, featured } = params || {}
  
  const cacheKey = generateCacheKey('tools', { limit, sortBy, sortOrder, category, pricing, featured })
  
  return fetchWithCache(
    cacheKey,
    async () => {
      // 优先使用优化后的Netlify Functions
      const queryParams = new URLSearchParams()
      queryParams.append('limit', limit.toString())
      if (sortBy) queryParams.append('sortBy', sortBy)
      if (sortOrder) queryParams.append('sortOrder', sortOrder)
      if (category) queryParams.append('category', category)
      if (pricing) queryParams.append('pricing', pricing)
      if (featured) queryParams.append('featured', 'true')
      
      const endpoint = `/.netlify/functions/tools-optimized?${queryParams}`
      
      try {
        const response = await fetch(endpoint, {
          cache: 'no-store' // 让我们的缓存层处理缓存
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log(`✅ 通过优化API获取工具: ${data.length}条`)
          return data as Tool[]
        }
        
        throw new Error(`HTTP ${response.status}`)
      } catch (error) {
        console.warn('⚠️ 优化API失败，回退到直连Supabase:', error)
        
        // 回退到直连Supabase
        let queryBuilder = supabase
          .from('tools')
          .select('id,name,tagline,logo_url,categories,features,pricing,rating,views,upvotes,date_added')
          .eq('status', 'published')
        
        if (category) {
          queryBuilder = queryBuilder.contains('categories', [category])
        }
        
        if (pricing) {
          queryBuilder = queryBuilder.eq('pricing', pricing)
        }
        
        if (featured) {
          queryBuilder = queryBuilder.eq('featured', true)
        }
        
        // 应用排序
        const orderColumn = sortBy || 'upvotes'
        const ascending = sortOrder === 'asc'
        
        queryBuilder = queryBuilder
          .order(orderColumn, { ascending })
          .order('id', { ascending: false }) // 稳定排序
          .limit(limit)
        
        const { data, error: dbError } = await queryBuilder
        
        if (dbError) throw dbError
        
        console.log('✅ 通过Supabase直连获取工具')
        return data as Tool[]
      }
    },
    60000 // 60秒TTL
  )
}

// 获取工具详情（优化版本）
export async function getToolByIdOptimized(id: string): Promise<Tool | null> {
  const cacheKey = generateCacheKey('tool-detail', { id })
  
  return fetchWithCache(
    cacheKey,
    async () => {
      console.log(`🔍 获取工具详情: ${id}`)
      
      try {
        // 优先使用优化后的tool-detail函数
        const response = await fetch(`/.netlify/functions/tool-detail/${id}`, {
          cache: 'no-store'
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log('✅ 通过优化API获取工具详情:', data.name)
          return data as Tool
        }
        
        if (response.status === 404) {
          console.log('❌ 工具未找到:', id)
          return null
        }
        
        throw new Error(`HTTP ${response.status}`)
      } catch (error) {
        console.warn('⚠️ 优化API失败，回退到直连:', error)
        
        // 回退到直连Supabase
        const { data, error: dbError } = await supabase
          .from('tools')
          .select('*')
          .eq('id', id)
          .eq('status', 'published')
          .single()
        
        if (dbError) {
          if (dbError.code === 'PGRST116') return null // 未找到
          throw dbError
        }
        
        console.log('✅ 通过Supabase直连获取工具详情')
        return data as Tool
      }
    },
    5 * 60 * 1000 // 5分钟TTL（工具详情更新较少）
  )
}

// 原子浏览量增加（优化版本）
export async function incrementToolViewsOptimized(id: string): Promise<number | null> {
  try {
    // 优先尝试使用数据库函数
    const { data, error: rpcError } = await supabase.rpc('increment_tool_views', {
      tool_id_param: id
    })
    
    if (!rpcError && typeof data === 'number') {
      console.log(`📊 工具 ${id} 浏览量+1: ${data}`)
      
      // 使缓存失效
      clientCache.invalidate(`tool-detail:${id}`)
      clientCache.invalidate('tools:')
      
      return data
    }
    
    console.warn('⚠️ 使用数据库函数失败，回退到传统方式:', error)
  } catch (error) {
    console.warn('⚠️ 数据库函数不可用，回退到传统方式:', error)
  }
  
  // 回退到传统的读+写方式
  try {
    const { data: currentTool, error: fetchError } = await supabase
      .from('tools')
      .select('views')
      .eq('id', id)
      .eq('status', 'published')
      .single()
    
    if (fetchError) throw fetchError
    
    const newViews = (currentTool?.views || 0) + 1
    
    const { error: updateError } = await supabase
      .from('tools')
      .update({ 
        views: newViews,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
    
    if (updateError) throw updateError
    
    // 使缓存失效
    clientCache.invalidate(`tool-detail:${id}`)
    clientCache.invalidate('tools:')
    
    return newViews
  } catch (error) {
    console.error('❌ 增加浏览量失败:', error)
    return null
  }
}

// 搜索工具（优化版本）
export async function searchToolsOptimized(
  query: string,
  filters?: ToolSearchFilters
): Promise<Tool[]> {
  const cacheKey = generateCacheKey('search', { query, ...filters })
  
  return fetchWithCache(
    cacheKey,
    async () => {
      try {
        // 使用优化后的搜索API
        const searchParams = {
          query,
          categories: filters?.categories,
          features: filters?.features,
          pricing: filters?.pricing,
          sortBy: filters?.sortBy || 'upvotes',
          sortOrder: filters?.sortOrder || 'desc',
          limit: 50
        }
        
        const response = await fetch('/.netlify/functions/search-tools-optimized', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(searchParams),
          cache: 'no-store'
        })
        
        if (response.ok) {
          const result = await response.json()
          console.log(`🔍 搜索结果: ${result.results?.length || 0}条`)
          return result.results || []
        }
        
        throw new Error(`HTTP ${response.status}`)
      } catch (error) {
        console.warn('⚠️ 优化搜索API失败，回退到直连:', error)
        
        // 回退到基础搜索
        let queryBuilder = supabase
          .from('tools')
          .select('*')
          .eq('status', 'published')
        
        // 文本搜索
        if (query) {
          queryBuilder = queryBuilder.or(
            `name.ilike.%${query}%,tagline.ilike.%${query}%,description.ilike.%${query}%`
          )
        }
        
        // 分类筛选
        if (filters?.categories?.length) {
          queryBuilder = queryBuilder.overlaps('categories', filters.categories)
        }
        
        // 功能筛选
        if (filters?.features?.length) {
          queryBuilder = queryBuilder.overlaps('features', filters.features)
        }
        
        // 定价筛选
        if (filters?.pricing) {
          queryBuilder = queryBuilder.eq('pricing', filters.pricing)
        }
        
        const { data, error: searchError } = await queryBuilder
          .order('upvotes', { ascending: false })
          .order('id', { ascending: false })
        
        if (searchError) throw searchError
        
        console.log('✅ 通过Supabase直连搜索')
        return data as Tool[]
      }
    },
    2 * 60 * 1000 // 2分钟TTL（搜索结果变化较快）
  )
}

// 获取分类数据（优化版本）
export async function getCategoriesOptimized() {
  const cacheKey = 'categories'
  
  return fetchWithCache(
    cacheKey,
    async () => {
      console.log('🔍 获取分类数据...')
      
      try {
        let { data, error: categoriesError } = await supabase
          .from('categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true })
        
        // 如果is_active字段不存在，回退查询
        if (categoriesError && categoriesError.message.includes('is_active')) {
          const result = await supabase
            .from('categories')
            .select('*')
            .order('name', { ascending: true })
          
          data = result.data
          categoriesError = result.error
        }
        
        if (categoriesError) throw categoriesError
        
        console.log(`✅ 获取分类成功: ${data?.length || 0}个分类`)
        return data || []
      } catch (error) {
        console.warn('⚠️ 获取分类失败，使用fallback数据:', error)
        
        // Fallback分类数据
        return [
          { id: 1, name: 'AI结构设计', description: '基于AI的结构设计与分析工具', icon: 'Brain', color: '#3B82F6' },
          { id: 2, name: 'BIM软件', description: '建筑信息模型设计与管理', icon: 'Layers', color: '#10B981' },
          { id: 3, name: '效率工具', description: '提升工作效率的专业工具', icon: 'Zap', color: '#F59E0B' },
          { id: 4, name: '岩土工程', description: '岩土工程分析与设计', icon: 'Mountain', color: '#8B5CF6' },
          { id: 5, name: '项目管理', description: '项目协作与管理工具', icon: 'Users', color: '#EF4444' },
          { id: 6, name: '智能施工管理', description: '施工过程管理与优化', icon: 'HardHat', color: '#06B6D4' }
        ]
      }
    },
    30 * 60 * 1000 // 30分钟TTL（分类数据更新很少）
  )
}

// 🔧 缓存管理工具
export const cacheUtils = {
  // 获取缓存统计
  getStats: () => ({
    cache: clientCache.getStats(),
    metrics: apiMetrics
  }),
  
  // 清除所有缓存
  clearAll: () => {
    clientCache.clear()
    console.log('🧹 已清除所有缓存')
  },
  
  // 使特定模式的缓存失效
  invalidate: (pattern: string) => {
    clientCache.invalidate(pattern)
    console.log(`🔄 已使缓存模式失效: ${pattern}`)
  },
  
  // 预热缓存
  warmup: async () => {
    console.log('🔥 开始预热缓存...')
    try {
      await Promise.all([
        getToolsOptimized({ limit: 60 }),
        getCategoriesOptimized()
      ])
      console.log('✅ 缓存预热完成')
    } catch (error) {
      console.warn('⚠️ 缓存预热失败:', error)
    }
  }
}

// 导出类型（向后兼容）
export type { Tool } from '../types'

// 🚀 替换原有函数的优化版本
export const getTools = getToolsOptimized
export const getToolById = getToolByIdOptimized
export const incrementToolViews = incrementToolViewsOptimized
export const searchTools = searchToolsOptimized
export const getCategories = getCategoriesOptimized