import { useState, useCallback, useRef } from 'react';
import { APP_CONFIG } from '../lib/config';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface CacheOptions {
  ttl?: number; // 生存时间（毫秒）
  staleWhileRevalidate?: boolean; // 是否在后台重新验证过期数据
}

// 内存缓存存储
const memoryCache = new Map<string, CacheEntry<any>>();

export function useCache() {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  // 清理指定key的abort controller
  const cleanupController = useCallback((key: string) => {
    if (abortControllersRef.current[key]) {
      abortControllersRef.current[key].abort();
      delete abortControllersRef.current[key];
    }
  }, []);

  // 获取缓存数据
  const get = useCallback(<T>(key: string): T | null => {
    const entry = memoryCache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiry) {
      memoryCache.delete(key);
      return null;
    }

    return entry.data as T;
  }, []);

  // 设置缓存数据
  const set = useCallback(<T>(key: string, data: T, options: CacheOptions = {}) => {
    const ttl = options.ttl || APP_CONFIG.cacheTimeout;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl
    };
    
    memoryCache.set(key, entry);
  }, []);

  // 检查是否过期
  const isExpired = useCallback((key: string): boolean => {
    const entry = memoryCache.get(key);
    if (!entry) return true;
    return Date.now() > entry.expiry;
  }, []);

  // 检查是否过时（可以继续使用但需要刷新）
  const isStale = useCallback((key: string, staleTime: number = 5 * 60 * 1000): boolean => {
    const entry = memoryCache.get(key);
    if (!entry) return true;
    return Date.now() - entry.timestamp > staleTime;
  }, []);

  // 使用缓存的异步数据获取
  const fetchWithCache = useCallback(async <T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> => {
    // 检查缓存
    const cached = get<T>(key);
    const expired = isExpired(key);
    const stale = isStale(key);

    // 如果有缓存且未过期，直接返回
    if (cached && !expired) {
      // 如果启用了staleWhileRevalidate且数据过时，则在后台刷新
      if (options.staleWhileRevalidate && stale && !loading[key]) {
        // 后台刷新，不等待结果
        setTimeout(() => {
          fetchWithCache(key, fetcher, { ...options, staleWhileRevalidate: false });
        }, 0);
      }
      return cached;
    }

    // 如果已经在加载中，等待现有的请求
    if (loading[key]) {
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (!loading[key]) {
            clearInterval(checkInterval);
            const freshData = get<T>(key);
            if (freshData) {
              resolve(freshData);
            } else {
              reject(new Error('Failed to get data from concurrent request'));
            }
          }
        }, 50);

        // 超时处理
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Timeout waiting for concurrent request'));
        }, APP_CONFIG.requestTimeout);
      });
    }

    // 设置加载状态
    setLoading(prev => ({ ...prev, [key]: true }));

    // 清理之前的请求
    cleanupController(key);

    // 创建新的abort controller
    const controller = new AbortController();
    abortControllersRef.current[key] = controller;

    try {
      console.log(`📦 Cache miss for "${key}", fetching data...`);
      const data = await fetcher(controller.signal);
      
      // 存储到缓存
      set(key, data, options);
      console.log(`✅ Data cached for "${key}"`);
      
      return data;
    } catch (error) {
      // 如果不是取消错误，则抛出
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error(`❌ Cache fetch failed for "${key}":`, error);
        throw error;
      }
      throw error;
    } finally {
      // 清理加载状态和controller
      setLoading(prev => ({ ...prev, [key]: false }));
      cleanupController(key);
    }
  }, [get, set, isExpired, isStale, loading, cleanupController]);

  // 手动清除缓存
  const invalidate = useCallback((key?: string) => {
    if (key) {
      memoryCache.delete(key);
      cleanupController(key);
      console.log(`🗑️ Cache invalidated for "${key}"`);
    } else {
      memoryCache.clear();
      Object.keys(abortControllersRef.current).forEach(cleanupController);
      console.log('🗑️ All cache cleared');
    }
  }, [cleanupController]);

  // 预取数据
  const prefetch = useCallback(async <T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    options: CacheOptions = {}
  ) => {
    // 只有在没有缓存或缓存过期时才预取
    if (!get<T>(key) || isExpired(key)) {
      try {
        await fetchWithCache(key, fetcher, options);
      } catch (error) {
        // 预取失败不抛出错误，只记录日志
        console.warn(`⚠️ Prefetch failed for "${key}":`, error);
      }
    }
  }, [get, isExpired, fetchWithCache]);

  // 获取缓存统计
  const getStats = useCallback(() => {
    const entries = Array.from(memoryCache.entries());
    const now = Date.now();
    
    return {
      totalEntries: entries.length,
      expiredEntries: entries.filter(([, entry]) => now > entry.expiry).length,
      staleEntries: entries.filter(([, entry]) => now - entry.timestamp > 5 * 60 * 1000).length,
      totalSize: entries.reduce((size, [key]) => size + key.length, 0),
      loadingCount: Object.keys(loading).filter(key => loading[key]).length
    };
  }, [loading]);

  // 组件卸载时清理
  React.useEffect(() => {
    return () => {
      Object.keys(abortControllersRef.current).forEach(cleanupController);
    };
  }, [cleanupController]);

  return {
    get,
    set,
    fetchWithCache,
    invalidate,
    prefetch,
    isLoading: (key: string) => loading[key] || false,
    getStats
  };
}

// 全局缓存清理函数
export const clearGlobalCache = () => {
  memoryCache.clear();
  console.log('🗑️ Global memory cache cleared');
};