// 客户端缓存管理
export interface CacheConfig {
  ttl: number; // 缓存时间(毫秒)
  maxSize: number; // 最大缓存条目数
  staleWhileRevalidate?: boolean; // 是否启用stale-while-revalidate策略
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

class ClientCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  
  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  // 生成缓存key
  private generateKey(prefix: string, params: any = {}): string {
    const paramStr = Object.keys(params)
      .sort()
      .map(key => `${key}:${JSON.stringify(params[key])}`)
      .join('|');
    return `${prefix}${paramStr ? `_${paramStr}` : ''}`;
  }

  // 获取缓存
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  // 设置缓存
  set<T>(key: string, data: T, ttl: number): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      key
    };

    this.cache.set(key, entry);
  }

  // 删除缓存
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  // 清空缓存
  clear(): void {
    this.cache.clear();
  }

  // 获取缓存状态
  getStatus() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys())
    };
  }

  // 清理过期缓存
  cleanup(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}

// 创建全局缓存实例
export const globalCache = new ClientCache(200);

// 缓存装饰器工厂
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: CacheConfig
): T {
  return (async (...args: any[]) => {
    const key = globalCache.generateKey(fn.name, args[0] || {});
    
    // 尝试从缓存获取数据
    const cached = globalCache.get(key);
    if (cached !== null) {
      console.log(`🎯 缓存命中: ${key}`);
      return cached;
    }

    try {
      // 缓存未命中，执行原函数
      console.log(`🔄 缓存未命中，执行请求: ${key}`);
      const result = await fn(...args);
      
      // 将结果缓存
      globalCache.set(key, result, config.ttl);
      console.log(`💾 数据已缓存: ${key}`);
      
      return result;
    } catch (error) {
      console.error(`❌ 请求失败: ${key}`, error);
      throw error;
    }
  }) as T;
}

// 预定义的缓存配置
export const CACHE_CONFIGS = {
  // 工具列表 - 缓存5分钟
  TOOLS_LIST: {
    ttl: 5 * 60 * 1000,
    maxSize: 50,
    staleWhileRevalidate: true
  },
  
  // 工具详情 - 缓存10分钟
  TOOL_DETAIL: {
    ttl: 10 * 60 * 1000,
    maxSize: 100,
    staleWhileRevalidate: true
  },
  
  // 分类列表 - 缓存30分钟
  CATEGORIES: {
    ttl: 30 * 60 * 1000,
    maxSize: 10,
    staleWhileRevalidate: true
  },
  
  // 用户收藏 - 缓存2分钟
  USER_FAVORITES: {
    ttl: 2 * 60 * 1000,
    maxSize: 50,
    staleWhileRevalidate: false
  },
  
  // 搜索结果 - 缓存5分钟
  SEARCH_RESULTS: {
    ttl: 5 * 60 * 1000,
    maxSize: 100,
    staleWhileRevalidate: true
  }
} as const;

// 浏览器存储缓存 (持久化)
export class PersistentCache {
  private storageKey: string;
  private maxAge: number;

  constructor(storageKey: string = 'app_cache', maxAge: number = 24 * 60 * 60 * 1000) {
    this.storageKey = storageKey;
    this.maxAge = maxAge;
  }

  // 获取持久化缓存
  get<T>(key: string): T | null {
    try {
      const stored = localStorage.getItem(`${this.storageKey}_${key}`);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      const now = Date.now();

      if (now - parsed.timestamp > this.maxAge) {
        localStorage.removeItem(`${this.storageKey}_${key}`);
        return null;
      }

      return parsed.data as T;
    } catch (error) {
      console.warn('Failed to get from persistent cache:', error);
      return null;
    }
  }

  // 设置持久化缓存
  set<T>(key: string, data: T): void {
    try {
      const entry = {
        data,
        timestamp: Date.now()
      };
      
      localStorage.setItem(
        `${this.storageKey}_${key}`, 
        JSON.stringify(entry)
      );
    } catch (error) {
      console.warn('Failed to set persistent cache:', error);
    }
  }

  // 删除持久化缓存
  delete(key: string): void {
    localStorage.removeItem(`${this.storageKey}_${key}`);
  }

  // 清空持久化缓存
  clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.storageKey)) {
        localStorage.removeItem(key);
      }
    });
  }
}

// 创建持久化缓存实例
export const persistentCache = new PersistentCache();

// 自动清理过期缓存
setInterval(() => {
  const cleaned = globalCache.cleanup();
  if (cleaned > 0) {
    console.log(`🧹 清理了 ${cleaned} 个过期缓存项`);
  }
}, 5 * 60 * 1000); // 每5分钟清理一次