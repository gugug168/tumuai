// useCache Hook - 现在使用统一缓存管理器作为后端
// 为保持向后兼容，使用兼容层包装

export { useCache, clearGlobalCache } from '../lib/cache-compat';

// 推荐使用新的Hook
export { useUnifiedCache } from '../lib/unified-cache-manager';

// 迁移提醒（仅开发环境）
if (import.meta.env.DEV) {
  console.info(`
🔗 useCache 现在使用统一缓存管理器
推荐新代码使用: import { useUnifiedCache } from '../lib/unified-cache-manager'
查看 CACHE_MIGRATION.md 了解迁移指南
`);
}
