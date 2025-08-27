// 缓存系统 - 现在使用统一缓存管理器作为后端
// 为保持向后兼容，重新导出兼容层的接口

export {
  globalCache,
  withCache,
  CACHE_CONFIGS,
  PersistentCache,
  persistentCache,
  clearGlobalCache
} from './cache-compat';

// 重新导出类型定义以保持兼容
export interface CacheConfig {
  ttl: number;
  maxSize: number; 
  staleWhileRevalidate?: boolean;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

// 迁移提醒
console.info(`
📦 cache.ts 现在使用统一缓存管理器
建议新代码直接使用: import { unifiedCache } from './unified-cache-manager'
查看 CACHE_MIGRATION.md 了解迁移指南
`);