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
 * 通过筛选 API 获取工具列表
 * 当有筛选条件时使用此 API，可以获取所有匹配的工具（不受分页限制）
 */
export async function getToolsFiltered(
  filters?: ToolSearchFilters,
  limit = 100,
  offset = 0,
  sortBy = 'upvotes'
): Promise<{ tools: Tool[]; count: number }> {
  try {
    const url = new URL('/api/tools-filtered', window.location.origin)
    url.searchParams.set('limit', limit.toString())
    url.searchParams.set('offset', offset.toString())
    url.searchParams.set('includeCount', 'true')
    url.searchParams.set('sortBy', sortBy)

    // 添加筛选参数
    if (filters?.categories && filters.categories.length > 0) {
      url.searchParams.set('category', filters.categories[0])
    }
    if (filters?.pricing) {
      url.searchParams.set('pricing', filters.pricing)
    }
    if (filters?.features && filters.features.length > 0) {
      url.searchParams.set('features', filters.features.join(','))
    }

    const response = await fetch(url.toString())

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const result = await response.json()
    return {
      tools: result.tools || [],
      count: result.count || 0
    }
  } catch (error) {
    console.error('Error fetching filtered tools via API:', error)
    throw error
  }
}

/**
 * 智能获取工具 - 自动选择最优数据源
 * 优先级：API代理 > 本地缓存 > 直连数据库
 *
 * @param limit 每页数量
 * @param offset 偏移量
 * @param includeCount 是否包含总数
 * @param filters 可选的筛选条件（有筛选时使用筛选 API）
 */
export async function getToolsSmart(
  limit = 12,
  offset = 0,
  includeCount = true,
  filters?: ToolSearchFilters
): Promise<{ tools: Tool[]; count?: number }> {
  // 检查是否有筛选条件
  const hasFilters = filters &&
    ((filters.categories && filters.categories.length > 0) ||
     filters.pricing ||
     (filters.features && filters.features.length > 0))

  // 有筛选条件时使用筛选 API
  if (hasFilters) {
    try {
      const sortBy = filters?.sortBy || 'upvotes'
      return await getToolsFiltered(filters, limit, offset, sortBy)
    } catch (apiError) {
      console.warn('Filtered API failed, falling back to client-side filtering:', apiError)
      // 回退到普通 API + 客户端筛选
    }
  }

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

// 增加工具浏览量 - 使用 RPC 函数原子性更新
export async function incrementToolViews(id: string) {
  try {
    // 使用 Supabase RPC 函数进行原子性更新
    const { error } = await supabase.rpc('increment_views', {
      tool_id: id,
      amount: 1
    })

    if (error) {
      console.error('Error incrementing views:', error)
    }
  } catch (error) {
    console.error('Unexpected error incrementing views:', error)
  }
}

/**
 * 批量增加工具浏览量 - 优化版本
 *
 * 用于记录多个工具的浏览量，减少数据库操作次数
 * 支持延迟更新策略以进一步减少写入压力
 *
 * @param toolIds 工具ID数组
 * @param delay 延迟更新时间（毫秒），0 表示立即更新
 */
export async function incrementToolsViewsBatch(
  toolIds: string[],
  delay: number = 5000
): Promise<{ success: boolean; updated: number }> {
  // 如果没有传入工具ID，直接返回
  if (!toolIds || toolIds.length === 0) {
    return { success: true, updated: 0 }
  }

  try {
    // 优先使用批量更新 API
    const response = await fetch('/api/increment-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolIds, delay })
    })

    if (response.ok) {
      const result = await response.json()
      return { success: true, updated: result.updated || 0 }
    }
  } catch (apiError) {
    console.warn('Batch API failed, falling back to RPC:', apiError)
  }

  // 回退方案：使用 Supabase RPC 批量函数
  try {
    const { error } = await supabase.rpc('increment_views_batch', {
      tool_ids: toolIds,
      amount: 1
    })

    if (error) {
      console.error('Error batch incrementing views:', error)
      return { success: false, updated: 0 }
    }

    return { success: true, updated: toolIds.length }
  } catch (error) {
    console.error('Unexpected error batch incrementing views:', error)
    return { success: false, updated: 0 }
  }
}

/**
 * 浏览量更新队列 - 客户端延迟更新
 *
 * 在客户端累积浏览量更新，批量发送到服务器
 */
class ViewUpdateQueue {
  private queue: Set<string> = new Set()
  private timeout: NodeJS.Timeout | null = null
  private readonly delay: number
  private readonly batchSize: number

  constructor(delay: number = 5000, batchSize: number = 20) {
    this.delay = delay
    this.batchSize = batchSize
  }

  /**
   * 添加工具ID到队列
   */
  add(toolId: string): void {
    this.queue.add(toolId)

    // 如果队列达到批量大小，立即发送
    if (this.queue.size >= this.batchSize) {
      this.flush()
      return
    }

    // 否则安排延迟发送
    this.scheduleFlush()
  }

  /**
   * 安排延迟刷新
   */
  private scheduleFlush(): void {
    if (this.timeout) clearTimeout(this.timeout)
    this.timeout = setTimeout(() => this.flush(), this.delay)
  }

  /**
   * 立即发送队列中的更新
   */
  async flush(): Promise<void> {
    if (this.queue.size === 0) return

    const toolIds = Array.from(this.queue)
    this.queue.clear()

    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }

    await incrementToolsViewsBatch(toolIds, 0)
  }

  /**
   * 清空队列（页面卸载时调用）
   */
  destroy(): void {
    if (this.timeout) clearTimeout(this.timeout)
    this.flush() // 尝试发送剩余的更新
  }
}

// 创建全局浏览量更新队列实例
export const viewUpdateQueue = new ViewUpdateQueue(5000, 20)

/**
 * 便捷函数：记录工具浏览（使用队列）
 */
export function trackToolView(toolId: string): void {
  viewUpdateQueue.add(toolId)
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

// 获取分类列表（带缓存）
export async function getCategoriesWithCache() {
  const cacheKey = 'categories_list_full';

  return unifiedCache.fetchWithCache(
    cacheKey,
    () => getCategories(),
    {
      ttl: 15 * 60 * 1000, // 15分钟缓存 - 分类变化不频繁
      staleWhileRevalidate: true
    }
  );
}

/**
 * 获取相关工具（带缓存）
 * 用于工具详情页的"相关工具推荐"
 * @param categoryId 分类ID
 * @param currentToolId 当前工具ID（需要排除）
 * @param limit 返回数量限制
 */
export async function getRelatedTools(
  categoryId: string,
  currentToolId: string,
  limit = 6
): Promise<Tool[]> {
  const cacheKey = `related_${categoryId}_${currentToolId}`;

  return unifiedCache.fetchWithCache(
    cacheKey,
    async () => {
      try {
        console.log(`🔗 获取相关工具: 分类=${categoryId}, 排除=${currentToolId}`);

        const { data, error } = await supabase
          .from('tools')
          .select('id,name,tagline,logo_url,categories,rating')
          .eq('status', 'published')
          .contains('categories', [categoryId])  // 使用contains查询包含该分类的工具
          .neq('id', currentToolId)  // 排除当前工具
          .order('rating', { ascending: false, nullsFirst: false })
          .limit(limit);

        if (error) {
          console.error('获取相关工具失败:', error);
          return [];
        }

        console.log(`✅ 找到 ${data?.length || 0} 个相关工具`);
        return data as Tool[];
      } catch (error) {
        console.error('获取相关工具异常:', error);
        return [];
      }
    },
    {
      ttl: 10 * 60 * 1000, // 10分钟缓存
      staleWhileRevalidate: true
    }
  );
}