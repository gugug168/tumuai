/**
 * KV 缓存工具
 * 封装 Vercel KV 的 get/set 操作，支持带 TTL 的缓存
 *
 * TTL 配置:
 * - 工具列表: 5 分钟 (300秒)
 * - 分类列表: 30 分钟 (1800秒)
 * - 单个工具详情: 10 分钟 (600秒)
 */

import { kv } from '@vercel/kv'

// 缓存 TTL 配置（单位：秒）
export const CACHE_TTL = {
  TOOLS_LIST: 300,        // 5 分钟
  CATEGORIES: 1800,       // 30 分钟
  TOOL_DETAIL: 600,       // 10 分钟
  FILTERED_TOOLS: 180,    // 3 分钟（筛选结果变化更频繁）
} as const

// 缓存键前缀
const CACHE_PREFIX = 'tumuai:v1:'

/**
 * 生成缓存键
 */
export function getCacheKey(type: string, ...parts: (string | number)[]): string {
  return `${CACHE_PREFIX}${type}:${parts.join(':')}`
}

/**
 * 生成工具列表缓存键
 */
export function getToolsCacheKey(params: {
  limit?: number
  offset?: number
  featuredOnly?: boolean
  category?: string
  categories?: string[]
  pricing?: string
  features?: string[]
  sortBy?: string
}): string {
  const {
    limit = 12,
    offset = 0,
    featuredOnly = false,
    category = '',
    categories = [],
    pricing = '',
    features = [],
    sortBy = 'upvotes'
  } = params

  // 将参数排序后生成稳定的缓存键
  const keyParts = [
    `l${limit}`,
    `o${offset}`,
    `f${featuredOnly ? 1 : 0}`,
    category ? `c${category}` : '',
    categories.length > 0 ? `cs${categories.sort().join(',')}` : '',
    pricing ? `p${pricing}` : '',
    features.length > 0 ? `fs${features.sort().join(',')}` : '',
    `s${sortBy}`
  ].filter(Boolean)

  return getCacheKey('tools', ...keyParts)
}

/**
 * 从 KV 缓存获取数据
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await kv.get<T>(key)
    return cached
  } catch (error) {
    // KV 错误不应阻塞请求，记录日志后继续
    console.warn('[KV Cache] Get failed:', error)
    return null
  }
}

/**
 * 写入 KV 缓存
 */
export async function setToCache<T>(
  key: string,
  data: T,
  ttl: number = CACHE_TTL.TOOLS_LIST
): Promise<boolean> {
  try {
    await kv.set(key, data, { ex: ttl })
    return true
  } catch (error) {
    // KV 错误不应阻塞请求，记录日志后继续
    console.warn('[KV Cache] Set failed:', error)
    return false
  }
}

/**
 * 删除缓存（用于数据更新后清除）
 */
export async function deleteCache(pattern: string): Promise<boolean> {
  try {
    // KV 不支持直接的模式删除，需要使用 scan
    // 这里简化处理，只删除精确匹配的键
    await kv.del(pattern)
    return true
  } catch (error) {
    console.warn('[KV Cache] Delete failed:', error)
    return false
  }
}

/**
 * 检查 KV 是否可用
 * 在开发环境或未配置 KV 时返回 false
 */
export async function isKvAvailable(): Promise<boolean> {
  try {
    // 尝试执行一个简单的操作来验证 KV 连接
    await kv.ping()
    return true
  } catch {
    return false
  }
}

/**
 * 缓存包装器 - 自动处理缓存读取和写入
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL.TOOLS_LIST
): Promise<{ data: T; cached: boolean }> {
  // 尝试从缓存获取
  const cached = await getFromCache<T>(key)
  if (cached !== null) {
    return { data: cached, cached: true }
  }

  // 缓存未命中，执行数据获取
  const data = await fetcher()

  // 异步写入缓存（不阻塞响应）
  setToCache(key, data, ttl).catch(err => {
    console.warn('[KV Cache] Background set failed:', err)
  })

  return { data, cached: false }
}
