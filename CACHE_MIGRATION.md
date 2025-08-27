# 🔄 缓存架构迁移指南

## 📋 概述

项目已统一缓存架构，将原来的两套缓存系统（`lib/cache.ts` + `hooks/useCache.ts`）整合为统一的缓存管理器。

## 🎯 迁移目标

1. **统一接口**：一套API处理所有缓存需求
2. **功能整合**：内存缓存 + 持久化 + 请求去重 + SWR
3. **性能提升**：减少重复代码，优化缓存策略  
4. **向后兼容**：保持现有API可用

## 🔄 API迁移对照表

### 旧的cache.ts → 新的unified-cache-manager.ts

```typescript
// ❌ 旧用法
import { globalCache, withCache, CACHE_CONFIGS } from '../lib/cache'

const data = globalCache.get<Tool[]>('tools')
globalCache.set('tools', data, 5 * 60 * 1000)

// ✅ 新用法
import { unifiedCache, UNIFIED_CACHE_CONFIGS } from '../lib/unified-cache-manager'

const data = await unifiedCache.get<Tool[]>('tools')
await unifiedCache.set('tools', data, UNIFIED_CACHE_CONFIGS.normal)
```

### 旧的useCache Hook → 新的useUnifiedCache Hook

```typescript
// ❌ 旧用法
import { useCache } from '../hooks/useCache'

const { fetchWithCache, invalidate, isLoading } = useCache()
const tools = await fetchWithCache('tools', () => getTools(), { ttl: 5 * 60 * 1000 })

// ✅ 新用法  
import { useUnifiedCache, UNIFIED_CACHE_CONFIGS } from '../lib/unified-cache-manager'

const { fetchWithCache, invalidate, isLoading } = useUnifiedCache()
const tools = await fetchWithCache('tools', () => getTools(), UNIFIED_CACHE_CONFIGS.normal)
```

### 装饰器模式迁移

```typescript
// ❌ 旧用法
import { withCache, CACHE_CONFIGS } from '../lib/cache'

const cachedGetTools = withCache(getTools, CACHE_CONFIGS.TOOLS_LIST)

// ✅ 新用法 - 直接在函数内使用
import { unifiedCache, UNIFIED_CACHE_CONFIGS } from '../lib/unified-cache-manager'

const cachedGetTools = async () => {
  return unifiedCache.fetchWithCache('tools', getTools, UNIFIED_CACHE_CONFIGS.normal)
}
```

## 📦 预定义缓存配置对照

| 旧配置 | 新配置 | 说明 |
|--------|--------|------|
| `CACHE_CONFIGS.TOOLS_LIST` | `UNIFIED_CACHE_CONFIGS.normal` | 工具列表缓存 |
| `CACHE_CONFIGS.TOOL_DETAIL` | `UNIFIED_CACHE_CONFIGS.normal` | 工具详情缓存 |
| `CACHE_CONFIGS.CATEGORIES` | `UNIFIED_CACHE_CONFIGS.static` | 分类列表（静态数据） |
| `CACHE_CONFIGS.USER_FAVORITES` | `UNIFIED_CACHE_CONFIGS.user` | 用户收藏 |
| `CACHE_CONFIGS.SEARCH_RESULTS` | `UNIFIED_CACHE_CONFIGS.normal` | 搜索结果 |

## 🚀 新功能优势

### 1. 统一的API
```typescript
// 一套API处理所有场景
const cache = useUnifiedCache()

// 基础缓存
await cache.fetchWithCache('key', fetcher, config)

// 预取
await cache.prefetch('key', fetcher, config)  

// 模式匹配失效
cache.invalidate('tools_*') // 失效所有工具相关缓存
```

### 2. 智能缓存策略
```typescript
// 自动启用 stale-while-revalidate
const config = {
  ...UNIFIED_CACHE_CONFIGS.normal,
  staleWhileRevalidate: true // 后台自动刷新过时数据
}
```

### 3. 持久化支持
```typescript
// 启用localStorage持久化
const config = {
  ...UNIFIED_CACHE_CONFIGS.static,
  persistent: true // 自动保存到localStorage
}
```

## 📝 迁移步骤

### Phase 1: 兼容层部署（保持向后兼容）
1. 创建兼容层包装器 ✅
2. 新功能使用新API
3. 测试双系统并行运行

### Phase 2: 逐步迁移（推荐顺序）
1. 迁移工具相关缓存（ToolsPage, ToolDetailPage）
2. 迁移用户相关缓存（ProfilePage, FavoritesPage）  
3. 迁移管理员缓存（AdminDashboard）
4. 迁移其他组件

### Phase 3: 清理旧代码
1. 删除 `src/lib/cache.ts`
2. 删除 `src/hooks/useCache.ts`  
3. 更新所有导入引用
4. 清理测试代码

## ⚠️ 注意事项

### Breaking Changes
- `globalCache.get()` 现在是异步方法：`await unifiedCache.get()`
- 缓存配置对象结构略有变化
- 持久化缓存前缀变更

### 兼容性保证
- 现有API继续工作（通过兼容层）
- 缓存数据自动迁移
- 渐进式迁移，无需一次性修改

### 性能提升预期
- 减少重复代码：~30%
- 统一请求去重：避免重复网络请求
- 智能缓存策略：提升响应速度
- 内存使用优化：自动清理过期数据

## 🧪 测试验证

在迁移过程中，建议进行以下测试：

1. **功能测试**：确保所有缓存功能正常
2. **性能测试**：对比迁移前后的响应时间
3. **内存测试**：监控内存使用情况
4. **持久化测试**：验证localStorage存储
5. **并发测试**：验证请求去重机制

## 📞 支持

如果在迁移过程中遇到问题，请参考：
1. 统一缓存管理器文档
2. 示例代码和测试用例
3. 性能监控和调试工具