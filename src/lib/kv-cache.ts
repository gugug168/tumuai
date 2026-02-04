/**
 * ============================================================
 * Vercel KV Cache Implementation
 * ============================================================
 * 功能：使用 Vercel KV 缓存频繁访问的数据，减少数据库查询
 * ============================================================
 */

import { createClient } from '@vercel/kv';

// KV 客户端实例
let kvClient: ReturnType<typeof createClient> | null = null;

/**
 * 获取 KV 客户端实例
 */
export function getKVClient() {
  if (!kvClient && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    kvClient = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  return kvClient;
}

/**
 * 缓存键前缀
 */
export const CACHE_KEYS = {
  TOOLS_LIST: 'tools:list',
  TOOLS_ITEM: 'tools:item',
  CATEGORIES: 'categories',
  TOOLS_COUNT: 'tools:count',
} as const;

/**
 * 缓存 TTL 配置 (秒)
 */
export const CACHE_TTL = {
  TOOLS_LIST: 300,        // 5 分钟
  TOOLS_ITEM: 600,        // 10 分钟
  CATEGORIES: 3600,       // 1 小时
  TOOLS_COUNT: 60,        // 1 分钟
} as const;

/**
 * 从缓存获取数据
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
  const kv = getKVClient();
  if (!kv) return null;

  try {
    const data = await kv.get<T>(key);
    return data;
  } catch (error) {
    console.error(`KV get error for key "${key}":`, error);
    return null;
  }
}

/**
 * 设置缓存数据
 */
export async function setCache<T>(key: string, value: T, ttl?: number): Promise<boolean> {
  const kv = getKVClient();
  if (!kv) return false;

  try {
    if (ttl) {
      await kv.set(key, value, { ex: ttl });
    } else {
      await kv.set(key, value);
    }
    return true;
  } catch (error) {
    console.error(`KV set error for key "${key}":`, error);
    return false;
  }
}

/**
 * 删除缓存
 */
export async function deleteCache(key: string): Promise<boolean> {
  const kv = getKVClient();
  if (!kv) return false;

  try {
    await kv.del(key);
    return true;
  } catch (error) {
    console.error(`KV delete error for key "${key}":`, error);
    return false;
  }
}

/**
 * 删除匹配前缀的所有缓存
 */
export async function deleteCacheByPattern(pattern: string): Promise<boolean> {
  const kv = getKVClient();
  if (!kv) return false;

  try {
    // Vercel KV 不直接支持模式匹配，需要使用 scan + del
    let cursor: number | string = 0;
    do {
      const result = await kv.scan(cursor as number, { match: pattern, count: 100 });
      cursor = result[0] as number | string;
      const keys = result[1];

      if (keys.length > 0) {
        await kv.del(...keys);
      }
    } while (cursor !== 0 && cursor !== '0');

    return true;
  } catch (error) {
    console.error(`KV delete pattern error for "${pattern}":`, error);
    return false;
  }
}

/**
 * 获取或设置缓存 (Cache-Aside 模式)
 */
export async function getOrSetCache<T>(
  key: string,
  factory: () => Promise<T>,
  ttl?: number
): Promise<T | null> {
  // 先尝试从缓存获取
  const cached = await getFromCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // 缓存未命中，调用 factory 获取数据
  try {
    const value = await factory();
    await setCache(key, value, ttl);
    return value;
  } catch (error) {
    console.error(`Factory error for key "${key}":`, error);
    return null;
  }
}

/**
 * 刷新缓存 (先删除后重新设置)
 */
export async function refreshCache<T>(
  key: string,
  factory: () => Promise<T>,
  ttl?: number
): Promise<T | null> {
  await deleteCache(key);
  return getOrSetCache(key, factory, ttl);
}

/**
 * ============================================================
 * 使用示例
 * ============================================================
 *
 * // 获取工具列表（带缓存）
 * const tools = await getOrSetCache(
 *   `${CACHE_KEYS.TOOLS_LIST}:published:upvotes:0:12`,
 *   () => fetchToolsFromDB(),
 *   CACHE_TTL.TOOLS_LIST
 * );
 *
 * // 更新工具后刷新缓存
 * await deleteCacheByPattern(`${CACHE_KEYS.TOOLS_LIST}:*`);
 * await deleteCacheByPattern(`${CACHE_KEYS.TOOLS_ITEM}:*`);
 *
 * ============================================================
 */
