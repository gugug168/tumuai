import type { Category, Tool, ToolSearchFilters } from '../types'
import { supabase } from './supabase-client'
import { CategoryManager } from './category-manager'
import { unifiedCache } from './unified-cache-manager'
export { supabase } from './supabase-client'

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
// 缓存策略：10分钟TTL，支持stale-while-revalidate
export async function getToolsWithCache(limit = 12, offset = 0): Promise<Tool[]> {
  const cacheKey = `tools_list_${limit}_${offset}`

  return unifiedCache.fetchWithCache(
    cacheKey,
    () => getTools(limit, offset),
    {
      ttl: 10 * 60 * 1000, // 10分钟缓存
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
      ttl: 10 * 60 * 1000, // 10分钟缓存
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
      ttl: 10 * 60 * 1000, // 10分钟缓存
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

export type ToolsCacheSortBy = 'upvotes' | 'date_added' | 'rating' | 'views'
export interface ToolsCacheParams {
  sortBy?: ToolsCacheSortBy
  featured?: boolean
}

type ApiFetchError = Error & { status?: number }

const IS_DEV = import.meta.env.DEV

// If the `/api/*` layer is temporarily unavailable (or the site is opened from a legacy host that
// doesn't have our Vercel functions), avoid hammering it on every render. We back off for a while
// and fall back to Supabase direct reads.
let apiDownUntil = 0

function getApiBackoffMs(status?: number): number {
  // 404 usually means "no functions on this host" (e.g. Netlify static) -> longer backoff.
  if (status === 404) return 10 * 60 * 1000
  // 503 means service unavailable -> moderate backoff.
  if (status === 503) return 60 * 1000
  // Network errors / timeouts -> short backoff.
  return 30 * 1000
}

function markApiDown(status?: number) {
  const until = Date.now() + getApiBackoffMs(status)
  apiDownUntil = Math.max(apiDownUntil, until)
}

function isApiBackedOff(): boolean {
  return Date.now() < apiDownUntil
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
  includeCount = true,
  signal?: AbortSignal,
  params?: ToolsCacheParams
): Promise<{ tools: Tool[]; count?: number }> {
  try {
    const url = new URL('/api/tools-cache', window.location.origin)
    url.searchParams.set('limit', limit.toString())
    url.searchParams.set('offset', offset.toString())
    if (includeCount) {
      url.searchParams.set('includeCount', 'true')
    }
    if (params?.featured) {
      url.searchParams.set('featured', 'true')
    }
    if (params?.sortBy) {
      url.searchParams.set('sortBy', params.sortBy)
    }

    const response = await fetch(url.toString(), { signal })

    if (!response.ok) {
      const err: ApiFetchError = new Error(`API error: ${response.status}`)
      err.status = response.status
      throw err
    }

    const result: ToolsCacheResult = await response.json()
    return {
      tools: result.tools || [],
      count: result.count
    }
  } catch (error) {
    if (IS_DEV) {
      console.error('Error fetching tools via API:', error)
    }
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
      const err: ApiFetchError = new Error(`API error: ${response.status}`)
      err.status = response.status
      throw err
    }

    const result = await response.json()
    return {
      tools: result.tools || [],
      count: result.count || 0
    }
  } catch (error) {
    if (IS_DEV) {
      console.error('Error fetching filtered tools via API:', error)
    }
    throw error
  }
}

/**
 * 智能获取工具 - 并行策略，自动选择最优数据源
 * 优先级：API代理 (并行) > 本地缓存 > 直连数据库
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
    // If API is unavailable, fall back to direct Supabase queries while keeping correct semantics.
    if (isApiBackedOff()) {
      const tools = await searchTools('', filters)
      return { tools, count: tools.length }
    }

    try {
      const sortBy = filters?.sortBy || 'upvotes'
      return await getToolsFiltered(filters, limit, offset, sortBy)
    } catch (apiError) {
      const status = typeof (apiError as ApiFetchError)?.status === 'number'
        ? (apiError as ApiFetchError).status
        : undefined
      markApiDown(status)

      if (IS_DEV) {
        console.warn('Filtered API failed, falling back to Supabase direct query:', apiError)
      }

      const tools = await searchTools('', filters)
      return { tools, count: tools.length }
    }
  }

  // API 优先策略：优先走 Vercel API（CDN 缓存命中很快），
  // 但避免在后台“同时直连 Supabase”造成双倍请求/资源竞争。
  // 超时后再回退到本地缓存/直连。
  const API_TIMEOUT = 2000

  // If API is in backoff, skip the network request entirely.
  if (isApiBackedOff()) {
    const [tools, count] = await Promise.all([
      getToolsWithCache(limit, offset),
      includeCount ? getToolsCountWithCache() : Promise.resolve(undefined)
    ])

    return { tools, count }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

    // 等待 API 或超时（AbortController）
    const result = await getToolsViaAPI(limit, offset, includeCount, controller.signal)

    clearTimeout(timeoutId)

    console.log('✅ getToolsSmart: API 响应成功')
    return result
  } catch (error) {
    const status = typeof (error as ApiFetchError)?.status === 'number'
      ? (error as ApiFetchError).status
      : undefined
    markApiDown(status)

    if (IS_DEV) {
      console.warn('⚠️ getToolsSmart: API 请求失败或超时，使用本地缓存:', error)
    }

    // 回退到本地缓存的直连方式
    const [tools, count] = await Promise.all([
      getToolsWithCache(limit, offset),
      includeCount ? getToolsCountWithCache() : Promise.resolve(undefined)
    ])

    return { tools, count }
  }
}

// 获取精选工具
export async function getFeaturedTools() {
  try {
    // 开发环境：直连 Supabase（本地通常没有 /api 代理服务）
    if (import.meta.env.DEV) {
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

      // 如果数据库没有设置 featured 字段（或没有任何精选工具），回退到热门工具，避免首页“空白”观感。
      if (!data || data.length === 0) {
        const fallback = await supabase
          .from('tools')
          .select('*')
          .eq('status', 'published')
          .order('upvotes', { ascending: false })
          .limit(8)

        if (fallback.error) {
          console.error('Error fetching fallback tools:', fallback.error)
          return []
        }

        return (fallback.data || []) as Tool[]
      }

      return data as Tool[]
    }

    // 生产环境：优先走 Vercel API（CDN 缓存）
    const featuredResult = await getToolsViaAPI(8, 0, false, undefined, { featured: true, sortBy: 'upvotes' })
    const featuredTools = Array.isArray(featuredResult.tools) ? featuredResult.tools : []

    if (featuredTools.length > 0) {
      return featuredTools
    }

    // 如果没有任何 featured=true 的数据，回退到热门工具，保证“编辑推荐”区域有内容。
    const fallbackResult = await getToolsViaAPI(8, 0, false, undefined, { sortBy: 'upvotes' })
    return Array.isArray(fallbackResult.tools) ? fallbackResult.tools : []
  } catch (error) {
    console.error('Unexpected error fetching featured tools:', error)

    // Last-resort fallback: fetch directly from Supabase so the homepage section isn't empty
    // when the Vercel `/api/*` layer is temporarily unavailable.
    try {
      const { data, error: fallbackError } = await supabase
        .from('tools')
        .select('id,name,tagline,description,logo_url,categories,pricing,rating,views,upvotes,date_added,featured,review_count')
        .eq('status', 'published')
        .order('upvotes', { ascending: false })
        .limit(8)

      if (fallbackError) {
        console.error('Fallback featured tools query failed:', fallbackError)
        return []
      }

      return (data || []) as Tool[]
    } catch (fallbackError) {
      console.error('Fallback featured tools query failed:', fallbackError)
      return []
    }
  }
}

// 获取最新工具
export async function getLatestTools() {
  try {
    if (import.meta.env.DEV) {
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
    }

    const result = await getToolsViaAPI(12, 0, false, undefined, { sortBy: 'date_added' })
    return Array.isArray(result.tools) ? result.tools : []
  } catch (error) {
    console.error('Unexpected error fetching latest tools:', error)

    // Last-resort fallback for when `/api/*` is unavailable.
    try {
      const { data, error: fallbackError } = await supabase
        .from('tools')
        .select('id,name,tagline,description,logo_url,categories,pricing,rating,views,upvotes,date_added,featured,review_count')
        .eq('status', 'published')
        .order('date_added', { ascending: false })
        .limit(12)

      if (fallbackError) {
        console.error('Fallback latest tools query failed:', fallbackError)
        return []
      }

      return (data || []) as Tool[]
    } catch (fallbackError) {
      console.error('Fallback latest tools query failed:', fallbackError)
      return []
    }
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

// 获取分类列表（带缓存）
// CategoryManager 负责“API 优先 + 数据库兜底 + emergency fallback”的获取逻辑；
// unifiedCache 负责缓存 + 请求去重，避免多个组件同时触发重复请求。
export async function getCategories(): Promise<Category[]> {
  const cacheKey = 'categories_list_full';

  return unifiedCache.fetchWithCache(
    cacheKey,
    () => CategoryManager.getCategories(),
    {
      ttl: 15 * 60 * 1000, // 15分钟缓存 - 分类变化不频繁
      staleWhileRevalidate: true,
      staleTime: 5 * 60 * 1000
    }
  );
}

// Backwards-compatible alias. Prefer `getCategories()`.
export async function getCategoriesWithCache(): Promise<Category[]> {
  return getCategories();
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
