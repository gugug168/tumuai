import { createClient } from '@supabase/supabase-js'
import type { Tool, ToolSearchFilters } from '../types'
import { CategoryManager } from './category-manager'
import { unifiedCache } from './unified-cache-manager'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 检查环境变量是否已设置
if (!supabaseUrl) {
  console.error('Missing VITE_SUPABASE_URL environment variable')
  throw new Error('Missing VITE_SUPABASE_URL environment variable. Please check your .env file or Vercel environment variables.')
}

if (!supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY environment variable')
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable. Please check your .env file or Vercel environment variables.')
}

// 🚀 单一的Supabase客户端实例（防止Multiple GoTrueClient警告）
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    // 防止多实例警告的关键配置 - 使用时间戳确保唯一性
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    autoRefreshToken: true,
    // 使用固定但唯一的存储键，避免与旧版本冲突
    storageKey: 'tumuai-auth-v2-stable',
    // 增强隔离性配置
    debug: false,
    flowType: 'pkce'
  }
})

// 临时禁用RLS的客户端配置
// 注意：前端不再创建额外的 admin 客户端，以避免多 GoTrueClient 警告和不必要的权限暴露。

// 导出Tool类型从统一类型文件
export type { Tool } from '../types'

// 类型守卫函数 (暂时未使用)
// function isValidTool(obj: unknown): obj is Tool {
//   return (
//     typeof obj === 'object' &&
//     obj !== null &&
//     'id' in obj &&
//     'name' in obj &&
//     'tagline' in obj &&
//     'website_url' in obj
//   )
// }

// 获取所有工具 - 增强类型安全，支持分页
export async function getTools(limit = 60, offset = 0): Promise<Tool[]> {
  try {
    console.log(`✅ 通过Supabase直连获取工具 (limit: ${limit}, offset: ${offset})`)
    // 直接使用 Supabase 客户端
    const { data, error } = await supabase
      .from('tools')
      .select('id,name,tagline,logo_url,categories,features,pricing,rating,views,upvotes,date_added')
      .eq('status', 'published')  // 只获取已发布的工具
      .order('upvotes', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching tools:', error)
      throw error
    }

    return data as Tool[]
  } catch (error) {
    console.error('Unexpected error fetching tools:', error)
    throw error
  }
}

// 获取工具总数
export async function getToolsCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('tools')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')

    if (error) {
      console.error('Error fetching tools count:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('Unexpected error fetching tools count:', error)
    return 0
  }
}

// 获取工具列表（带缓存）- 阶段1优化
// 缓存策略：5分钟TTL，支持stale-while-revalidate
export async function getToolsWithCache(limit = 12, offset = 0): Promise<Tool[]> {
  const cacheKey = `tools_list_${limit}_${offset}`

  return unifiedCache.fetchWithCache(
    cacheKey,
    () => getTools(limit, offset),
    {
      ttl: 5 * 60 * 1000, // 5分钟缓存
      staleWhileRevalidate: true // 过期后先返回旧数据，后台刷新
    }
  )
}

// 获取工具总数（带缓存）
export async function getToolsCountWithCache(): Promise<number> {
  const cacheKey = 'tools_count'

  return unifiedCache.fetchWithCache(
    cacheKey,
    () => getToolsCount(),
    {
      ttl: 5 * 60 * 1000,
      staleWhileRevalidate: true
    }
  )
}

// 获取精选工具（带缓存）
export async function getFeaturedToolsWithCache(): Promise<Tool[]> {
  const cacheKey = 'featured_tools'

  return unifiedCache.fetchWithCache(
    cacheKey,
    () => getFeaturedTools(),
    {
      ttl: 10 * 60 * 1000, // 精选工具10分钟缓存
      staleWhileRevalidate: true
    }
  )
}

// 获取最新工具（带缓存）
export async function getLatestToolsWithCache(): Promise<Tool[]> {
  const cacheKey = 'latest_tools'

  return unifiedCache.fetchWithCache(
    cacheKey,
    () => getLatestTools(),
    {
      ttl: 5 * 60 * 1000,
      staleWhileRevalidate: true
    }
  )
}

// ============================================================
// Vercel API 代理层调用函数（阶段3优化）
// ============================================================

interface ToolsCacheResult {
  tools: Tool[]
  count?: number
  cached: boolean
  timestamp: string
}

/**
 * 通过 Vercel API 代理获取工具列表
 * 优势：
 * - 服务端缓存（CDN级别）
 * - 所有用户共享缓存
 * - 降低数据库负载
 */
export async function getToolsViaAPI(
  limit = 12,
  offset = 0,
  includeCount = true
): Promise<{ tools: Tool[]; count?: number }> {
  try {
    const url = new URL('/api/tools-cache', window.location.origin)
    url.searchParams.set('limit', limit.toString())
    url.searchParams.set('offset', offset.toString())
    if (includeCount) {
      url.searchParams.set('includeCount', 'true')
    }

    const response = await fetch(url.toString())

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const result: ToolsCacheResult = await response.json()
    return {
      tools: result.tools || [],
      count: result.count
    }
  } catch (error) {
    console.error('Error fetching tools via API:', error)
    throw error
  }
}

/**
 * 智能获取工具 - 自动选择最优数据源
 * 优先级：API代理 > 本地缓存 > 直连数据库
 */
export async function getToolsSmart(
  limit = 12,
  offset = 0,
  includeCount = true
): Promise<{ tools: Tool[]; count?: number }> {
  // 首先尝试通过 Vercel API（最快）
  try {
    return await getToolsViaAPI(limit, offset, includeCount)
  } catch (apiError) {
    console.warn('API proxy failed, falling back to cached direct connection:', apiError)

    // 回退到本地缓存的直连方式
    const tools = await getToolsWithCache(limit, offset)
    const count = includeCount ? await getToolsCountWithCache() : undefined

    return { tools, count }
  }
}

// 获取精选工具
export async function getFeaturedTools() {
  try {
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .eq('featured', true)
      .eq('status', 'published')  // 只获取已发布的精选工具
      .order('upvotes', { ascending: false })
      .limit(8)

    if (error) {
      console.error('Error fetching featured tools:', error)
      return []
    }

    return data as Tool[]
  } catch (error) {
    console.error('Unexpected error fetching featured tools:', error)
    return []
  }
}

// 获取最新工具
export async function getLatestTools() {
  try {
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .eq('status', 'published')  // 只获取已发布的最新工具
      .order('date_added', { ascending: false })
      .limit(12)

    if (error) {
      console.error('Error fetching latest tools:', error)
      return []
    }

    return data as Tool[]
  } catch (error) {
    console.error('Unexpected error fetching latest tools:', error)
    return []
  }
}

// 根据ID获取工具详情
export async function getToolById(id: string) {
  try {
    console.log(`🔍 开始获取工具详情: ${id}`)
    console.log('✅ 通过Supabase直连获取工具详情')
    
    // 直接使用 Supabase 客户端
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .eq('id', id)
      .eq('status', 'published')  // 确保只获取已发布的工具
      .single()

    if (error) {
      console.error(`❌ Supabase获取工具详情失败 ${id}:`, error)
      return null
    }

    console.log('✅ 通过Supabase直连获取工具详情成功:', data.name)
    return data as Tool
  } catch (error) {
    console.error(`❌ 获取工具详情异常 ${id}:`, error)
    return null
  }
}

// 增加工具浏览量
export async function incrementToolViews(id: string) {
  try {
    // 先获取当前浏览量
    const { data: currentTool, error: fetchError } = await supabase
      .from('tools')
      .select('views')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Error fetching current views:', fetchError)
      return
    }

    // 更新浏览量
    const { error } = await supabase
      .from('tools')
      .update({ views: (currentTool?.views || 0) + 1 })
      .eq('id', id)

    if (error) {
      console.error('Error incrementing views:', error)
    }
  } catch (error) {
    console.error('Unexpected error incrementing views:', error)
  }
}

// 搜索工具 - 使用严格类型
export async function searchTools(
  query: string, 
  filters?: ToolSearchFilters
): Promise<Tool[]> {
  try {
    let queryBuilder = supabase
      .from('tools')
      .select('*')
      .eq('status', 'published')  // 只搜索已发布的工具

    // 文本搜索
    if (query) {
      queryBuilder = queryBuilder.or(`name.ilike.%${query}%,tagline.ilike.%${query}%,description.ilike.%${query}%`)
    }

    // 分类筛选
    if (filters?.categories && filters.categories.length > 0) {
      queryBuilder = queryBuilder.overlaps('categories', filters.categories)
    }

    // 功能筛选
    if (filters?.features && filters.features.length > 0) {
      queryBuilder = queryBuilder.overlaps('features', filters.features)
    }

    // 定价筛选
    if (filters?.pricing) {
      queryBuilder = queryBuilder.eq('pricing', filters.pricing)
    }

    const { data, error } = await queryBuilder.order('upvotes', { ascending: false })

    if (error) {
      console.error('Error searching tools:', error)
      return []
    }

    return data as Tool[]
  } catch (error) {
    console.error('Unexpected error searching tools:', error)
    return []
  }
}

// 获取分类列表 - 使用统一的CategoryManager
export async function getCategories() {
  return await CategoryManager.getCategories();
}