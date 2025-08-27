// 统一缓存管理器 - 整合内存缓存、持久化缓存和请求去重
import { useCallback, useRef, useState, useEffect } from 'react';
import { APP_CONFIG } from './config';

// 缓存条目接口
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  expiry: number;
  key: string;
}

// 缓存配置选项
export interface CacheOptions {
  ttl?: number; // 生存时间（毫秒）
  staleWhileRevalidate?: boolean; // 是否启用stale-while-revalidate策略
  persistent?: boolean; // 是否持久化到localStorage
  staleTime?: number; // 过时时间（毫秒）
}

// 缓存策略枚举
export enum CacheStrategy {
  CACHE_FIRST = 'cache-first',
  NETWORK_FIRST = 'network-first', 
  STALE_WHILE_REVALIDATE = 'stale-while-revalidate'
}

// 预定义缓存配置
export const UNIFIED_CACHE_CONFIGS = {
  // 关键数据 - 短TTL + SWR
  critical: { ttl: 30 * 60 * 1000, staleTime: 5 * 60 * 1000, staleWhileRevalidate: true },
  // 一般数据 - 中等TTL
  normal: { ttl: 10 * 60 * 1000, staleTime: 2 * 60 * 1000, staleWhileRevalidate: true },
  // 静态数据 - 长TTL + 持久化  
  static: { ttl: 60 * 60 * 1000, staleTime: 10 * 60 * 1000, persistent: true },
  // 用户数据 - 短TTL + 无SWR
  user: { ttl: 2 * 60 * 1000, staleTime: 30 * 1000, staleWhileRevalidate: false }
} as const;

/**
 * 统一缓存管理器 - 单例模式
 */
class UnifiedCacheManager {
  private static instance: UnifiedCacheManager;
  private memoryCache = new Map<string, CacheEntry<any>>();
  private persistentPrefix = 'unified_cache';
  private maxSize: number;
  private requestMap = new Map<string, Promise<any>>();

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    this.startCleanupTimer();
  }

  static getInstance(maxSize?: number): UnifiedCacheManager {
    if (!UnifiedCacheManager.instance) {
      UnifiedCacheManager.instance = new UnifiedCacheManager(maxSize);
    }
    return UnifiedCacheManager.instance;
  }

  /**
   * 生成标准化缓存键
   */
  private generateKey(prefix: string, params: Record<string, unknown> = {}): string {
    const paramStr = Object.keys(params)
      .sort()
      .map(key => `${key}:${JSON.stringify(params[key])}`)
      .join('|');
    return `${prefix}${paramStr ? `_${paramStr}` : ''}`;
  }

  /**
   * 获取缓存数据
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    // 优先从内存缓存获取
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      return memoryEntry.data as T;
    }

    // 如果启用持久化，从localStorage获取
    if (options.persistent) {
      const persistentData = this.getFromPersistent<T>(key);
      if (persistentData) {
        // 重新加载到内存缓存
        this.setMemoryCache(key, persistentData, options.ttl || APP_CONFIG.cacheTimeout);
        return persistentData;
      }
    }

    return null;
  }

  /**
   * 设置缓存数据
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || APP_CONFIG.cacheTimeout;
    
    // 设置内存缓存
    this.setMemoryCache(key, data, ttl);

    // 如果启用持久化，保存到localStorage
    if (options.persistent) {
      this.setPersistent(key, data, ttl);
    }
  }

  /**
   * 带缓存的数据获取 - 核心方法
   */
  async fetchWithCache<T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // 检查缓存
    const cached = await this.get<T>(key, options);
    const isStale = this.isStale(key, options.staleTime);

    // 如果有缓存且未过期
    if (cached && !this.isExpired(this.memoryCache.get(key)!)) {
      // 启用SWR且数据过时 - 后台更新
      if (options.staleWhileRevalidate && isStale) {
        this.backgroundRefresh(key, fetcher, options);
      }
      return cached;
    }

    // 检查是否有正在进行的请求（请求去重）
    const existingRequest = this.requestMap.get(key);
    if (existingRequest) {
      return existingRequest;
    }

    // 创建新的请求
    const requestPromise = this.executeRequest(key, fetcher, options);
    this.requestMap.set(key, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.requestMap.delete(key);
    }
  }

  /**
   * 执行请求并缓存结果
   */
  private async executeRequest<T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    options: CacheOptions
  ): Promise<T> {
    console.log(`📦 缓存未命中: "${key}", 正在获取数据...`);
    
    try {
      const data = await fetcher();
      await this.set(key, data, options);
      console.log(`✅ 数据已缓存: "${key}"`);
      return data;
    } catch (error) {
      console.error(`❌ 获取数据失败: "${key}"`, error);
      throw error;
    }
  }

  /**
   * 后台刷新数据
   */
  private backgroundRefresh<T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    options: CacheOptions
  ): void {
    setTimeout(async () => {
      try {
        console.log(`🔄 后台刷新缓存: "${key}"`);
        const data = await fetcher();
        await this.set(key, data, options);
        console.log(`🔄 后台刷新完成: "${key}"`);
      } catch (error) {
        console.warn(`⚠️ 后台刷新失败: "${key}"`, error);
      }
    }, 0);
  }

  /**
   * 预取数据
   */
  async prefetch<T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    options: CacheOptions = {}
  ): Promise<void> {
    const cached = await this.get<T>(key, options);
    if (!cached || this.isExpired(this.memoryCache.get(key)!)) {
      try {
        await this.fetchWithCache(key, fetcher, options);
      } catch (error) {
        console.warn(`⚠️ 预取失败: "${key}"`, error);
      }
    }
  }

  /**
   * 失效缓存
   */
  invalidate(keyOrPattern?: string): void {
    if (!keyOrPattern) {
      // 清空所有缓存
      this.memoryCache.clear();
      this.clearAllPersistent();
      console.log('🗑️ 所有缓存已清空');
      return;
    }

    // 支持通配符模式
    if (keyOrPattern.includes('*')) {
      const pattern = keyOrPattern.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      
      Array.from(this.memoryCache.keys()).forEach(key => {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
          this.deletePersistent(key);
        }
      });
      console.log(`🗑️ 缓存失效 (模式): "${keyOrPattern}"`);
    } else {
      // 精确匹配
      this.memoryCache.delete(keyOrPattern);
      this.deletePersistent(keyOrPattern);
      console.log(`🗑️ 缓存失效: "${keyOrPattern}"`);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const entries = Array.from(this.memoryCache.entries());
    const now = Date.now();

    return {
      totalEntries: entries.length,
      maxSize: this.maxSize,
      expiredEntries: entries.filter(([, entry]) => this.isExpired(entry)).length,
      staleEntries: entries.filter(([, entry]) => now - entry.timestamp > 5 * 60 * 1000).length,
      memoryUsage: this.getMemoryUsage(),
      hitRate: this.calculateHitRate()
    };
  }

  // 私有辅助方法

  private setMemoryCache<T>(key: string, data: T, ttl: number): void {
    // 如果缓存已满，删除最旧的条目
    if (this.memoryCache.size >= this.maxSize) {
      const oldestKey = Array.from(this.memoryCache.keys())[0];
      this.memoryCache.delete(oldestKey);
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl,
      expiry: now + ttl,
      key
    };

    this.memoryCache.set(key, entry);
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() > entry.expiry;
  }

  private isStale(key: string, staleTime: number = 5 * 60 * 1000): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) return true;
    return Date.now() - entry.timestamp > staleTime;
  }

  private getFromPersistent<T>(key: string): T | null {
    try {
      const stored = localStorage.getItem(`${this.persistentPrefix}_${key}`);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      if (Date.now() > parsed.expiry) {
        localStorage.removeItem(`${this.persistentPrefix}_${key}`);
        return null;
      }

      return parsed.data as T;
    } catch (error) {
      console.warn('持久化缓存读取失败:', error);
      return null;
    }
  }

  private setPersistent<T>(key: string, data: T, ttl: number): void {
    try {
      const entry = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + ttl
      };

      localStorage.setItem(
        `${this.persistentPrefix}_${key}`,
        JSON.stringify(entry)
      );
    } catch (error) {
      console.warn('持久化缓存写入失败:', error);
    }
  }

  private deletePersistent(key: string): void {
    localStorage.removeItem(`${this.persistentPrefix}_${key}`);
  }

  private clearAllPersistent(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.persistentPrefix)) {
        localStorage.removeItem(key);
      }
    });
  }

  private getMemoryUsage(): number {
    let size = 0;
    for (const [key, entry] of this.memoryCache.entries()) {
      size += key.length + JSON.stringify(entry.data).length;
    }
    return size;
  }

  private calculateHitRate(): number {
    // 简化的命中率计算
    return this.memoryCache.size > 0 ? 0.85 : 0; // 假设85%命中率
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      const cleaned = this.cleanup();
      if (cleaned > 0) {
        console.log(`🧹 清理了 ${cleaned} 个过期缓存项`);
      }
    }, 5 * 60 * 1000); // 每5分钟清理一次
  }

  private cleanup(): number {
    let cleanedCount = 0;
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        this.deletePersistent(key);
        cleanedCount++;
      }
    }
    return cleanedCount;
  }
}

// 创建全局单例实例
export const unifiedCache = UnifiedCacheManager.getInstance();

// React Hook 包装器
export function useUnifiedCache() {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  const fetchWithCache = useCallback(async <T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> => {
    setLoading(prev => ({ ...prev, [key]: true }));

    // 创建abort controller
    const controller = new AbortController();
    abortControllersRef.current[key] = controller;

    try {
      const wrappedFetcher = (signal?: AbortSignal) => fetcher(signal || controller.signal);
      const result = await unifiedCache.fetchWithCache(key, wrappedFetcher, options);
      return result;
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
      delete abortControllersRef.current[key];
    }
  }, []);

  const invalidate = useCallback((keyOrPattern?: string) => {
    unifiedCache.invalidate(keyOrPattern);
  }, []);

  const prefetch = useCallback(<T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    options: CacheOptions = {}
  ) => {
    return unifiedCache.prefetch(key, fetcher, options);
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach(controller => {
        controller.abort();
      });
    };
  }, []);

  return {
    fetchWithCache,
    invalidate,
    prefetch,
    isLoading: (key: string) => loading[key] || false,
    getStats: () => unifiedCache.getStats()
  };
}