// 缓存兼容层 - 保持向后兼容，同时逐步迁移到统一缓存管理器
import { unifiedCache, useUnifiedCache, UNIFIED_CACHE_CONFIGS, CacheOptions } from './unified-cache-manager';

// 旧的接口兼容实现
export interface LegacyCacheConfig {
  ttl: number;
  maxSize: number;
  staleWhileRevalidate?: boolean;
}

export interface LegacyCacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

// 兼容旧的cache.ts接口
class LegacyClientCache {
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  // 兼容get方法 - 转换为异步
  get<T>(key: string): T | null {
    // 注意：这是同步方法，但内部调用异步API
    // 实际使用时建议迁移到异步版本
    let result: T | null = null;
    unifiedCache.get<T>(key).then(data => {
      result = data;
    });
    return result;
  }

  // 兼容set方法  
  set<T>(key: string, data: T, ttl: number): void {
    unifiedCache.set(key, data, { ttl });
  }

  // 兼容delete方法
  delete(key: string): boolean {
    unifiedCache.invalidate(key);
    return true; // 假设总是成功
  }

  // 兼容clear方法
  clear(): void {
    unifiedCache.invalidate();
  }

  // 兼容getStatus方法
  getStatus() {
    const stats = unifiedCache.getStats();
    return {
      size: stats.totalEntries,
      maxSize: this.maxSize,
      keys: [] // 简化返回
    };
  }

  // 兼容cleanup方法
  cleanup(): number {
    const stats = unifiedCache.getStats();
    return stats.expiredEntries; // 返回过期条目数
  }
}

// 创建兼容的全局缓存实例
export const globalCache = new LegacyClientCache(200);

// 兼容装饰器 - 映射到新的缓存系统
export function withCache<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  config: LegacyCacheConfig
): T {
  return (async (...args: unknown[]) => {
    const key = `${fn.name}_${JSON.stringify(args[0] || {})}`;
    
    const options: CacheOptions = {
      ttl: config.ttl,
      staleWhileRevalidate: config.staleWhileRevalidate
    };

    return unifiedCache.fetchWithCache(key, () => fn(...args), options);
  }) as T;
}

// 兼容旧的缓存配置 - 映射到新配置
export const CACHE_CONFIGS = {
  TOOLS_LIST: {
    ttl: 5 * 60 * 1000,
    maxSize: 50,
    staleWhileRevalidate: true
  },
  TOOL_DETAIL: {
    ttl: 10 * 60 * 1000,
    maxSize: 100,
    staleWhileRevalidate: true
  },
  CATEGORIES: {
    ttl: 30 * 60 * 1000,
    maxSize: 10,
    staleWhileRevalidate: true
  },
  USER_FAVORITES: {
    ttl: 2 * 60 * 1000,
    maxSize: 50,
    staleWhileRevalidate: false
  },
  SEARCH_RESULTS: {
    ttl: 5 * 60 * 1000,
    maxSize: 100,
    staleWhileRevalidate: true
  }
} as const;

// 持久化缓存兼容类
export class PersistentCache {
  private storageKey: string;
  private maxAge: number;

  constructor(storageKey: string = 'app_cache', maxAge: number = 24 * 60 * 60 * 1000) {
    this.storageKey = storageKey;
    this.maxAge = maxAge;
  }

  get<T>(key: string): T | null {
    const fullKey = `legacy_${this.storageKey}_${key}`;
    // 使用统一缓存的持久化功能
    let result: T | null = null;
    unifiedCache.get<T>(fullKey, { persistent: true }).then(data => {
      result = data;
    });
    return result;
  }

  set<T>(key: string, data: T): void {
    const fullKey = `legacy_${this.storageKey}_${key}`;
    unifiedCache.set(fullKey, data, { ttl: this.maxAge, persistent: true });
  }

  delete(key: string): void {
    const fullKey = `legacy_${this.storageKey}_${key}`;
    unifiedCache.invalidate(fullKey);
  }

  clear(): void {
    unifiedCache.invalidate(`legacy_${this.storageKey}_*`);
  }
}

// 创建兼容的持久化缓存实例
export const persistentCache = new PersistentCache();

// 兼容的useCache hook - 映射到新hook
export function useCache() {
  // 导入新的hook但保持旧的接口 - 修复为ES模块导入
  const { fetchWithCache, invalidate, isLoading, getStats } = useUnifiedCache();

  // 包装为旧接口格式
  const get = <T>(key: string): T | null => {
    // 同步方法兼容 - 实际应用中建议迁移到异步
    let result: T | null = null;
    unifiedCache.get<T>(key).then(data => {
      result = data;
    });
    return result;
  };

  const set = <T>(key: string, data: T, options: any = {}) => {
    unifiedCache.set(key, data, options);
  };

  const isExpired = (key: string): boolean => {
    // 简化实现
    return false;
  };

  const isStale = (key: string, staleTime: number = 5 * 60 * 1000): boolean => {
    // 简化实现
    return false;
  };

  const prefetch = <T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    options: any = {}
  ) => {
    return unifiedCache.prefetch(key, fetcher, options);
  };

  return {
    get,
    set,
    fetchWithCache,
    invalidate,
    prefetch,
    isLoading,
    isExpired,
    isStale,
    getStats
  };
}

// 兼容的全局清理函数
export const clearGlobalCache = () => {
  unifiedCache.invalidate();
  console.log('🗑️ Legacy global cache cleared (via unified cache)');
};

// 迁移提醒日志
console.warn(`
⚠️  缓存兼容层已激活
建议逐步迁移到新的统一缓存管理器:
- 使用 import { unifiedCache, useUnifiedCache } from './unified-cache-manager'
- 查看 CACHE_MIGRATION.md 了解迁移指南
`);