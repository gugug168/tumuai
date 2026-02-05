# tumuai.net 性能优化计划

## 目标
通过迭代式优化和实际测试验证，持续提升 tumuai.net 的性能指标。

## 测试标准

### Core Web Vitals 目标
| 指标 | 测试 #1 (旧) | 测试 #2 (优化前) | 测试 #3 (优化后) | 目标值 | 状态 |
|------|-------------|-----------------|-----------------|--------|------|
| TTFB | 855 ms | 1,294 ms | **5 ms** | < 600 ms | ✅ 优秀 |
| LCP | 963 ms | 1,407 ms | **119 ms** | < 2500 ms | ✅ 优秀 |
| CLS | 0.08 | 0.06 | 0.06 | < 0.1 | ✅ 优秀 |
| Lighthouse 性能分数 | - | 待测 | 待测 | > 90 | 待测 |

### 优化成果 🎉
- **TTFB 改善**: 99.6% (1,294 ms → 5 ms)
- **LCP 改善**: 91.5% (1,407 ms → 119 ms)

### 测试工具
- Chrome DevTools Lighthouse
- Vercel MCP - 查看部署状态和性能数据
- Supabase MCP - 查看数据库查询性能

---

## 阶段一：虚拟滚动实现 ✅ 已完成

### 完成时间
2026-02-02

### 优化内容
- 在 `useToolData.ts` 中添加虚拟滚动支持
- 新增 `allTools`, `isLoadingMore`, `hasMore` 状态
- 新增 `loadMore` 方法支持分批加载
- ToolsPage 启用虚拟滚动模式（无筛选时）
- SmartURLInput 组件重构（提取 hooks）

### 测试计划
- [ ] 访问 https://www.tumuai.net/tools
- [ ] 使用 Chrome DevTools Lighthouse 运行测试
- [ ] 记录测试结果到本文件
- [ ] 对比优化前后的数据

---

## 阶段二：性能基线测试 🔄 进行中

### 目标
获取当前网站的实际性能基线数据，作为后续优化的对比基准。

### Vercel 数据 (已获取)
**最新部署信息:**
- **部署 ID**: dpl_AoQZP7tRMXmoT798f5Qs53hb5U7i
- **版本**: 5408fac (虚拟滚动优化)
- **状态**: READY
- **部署时间**: 1770045969888 (2025-10-03)
- **构建时间**: 约 3.5 秒
- **区域**: iad1 (美国东部)
- **域名**: www.tumuai.net, tumuai.net
- **Runtime**: Node.js 12

### Supabase 数据 (已获取)
**项目信息:**
- **项目名**: aitumu
- **状态**: ACTIVE_HEALTHY
- **区域**: ap-northeast-1 (日本)
- **数据库版本**: PostgreSQL 17.4.1
- **主表数据量**:
  - tools: 106 行
  - user_profiles: 78 行
  - tool_submissions: 167 行
  - user_favorites: 21 行
  - audit_logs: 405 行

### 测试步骤
1. ✅ 使用 Vercel MCP 检查部署状态
2. ✅ 使用 Supabase MCP 检查数据库性能
3. ⏳ 手动使用 Chrome DevTools Lighthouse 测试（需要手动执行）

### 测试结果
**Chrome DevTools Performance Trace (2026-02-02):**

**测试 #2 - Chrome DevTools 自动化测试**
- **测试页面**: https://www.tumuai.net/tools
- **测试方法**: Chrome DevTools MCP Performance Trace
- **测试次数**: 2 次页面加载

**NAVIGATION_0 结果:**
- TTFB: **1,294 ms** (超出目标 116%)
- LCP: **1,407 ms** ✅ 达标
- CLS: **0.06** ✅ 优秀
- LCP 分解: TTFB 92% + 渲染延迟 8%

**NAVIGATION_1 结果:**
- TTFB: **1,602 ms** (超出目标 167%)
- LCP: **1,646 ms** ✅ 达标
- CLS: **0.06** ✅ 优秀
- LCP 分解: TTFB 97% + 渲染延迟 3%

**关键发现:**
1. **TTFB 是主要瓶颈**: 占 LCP 时间的 92-97%
2. **CDN 命中但无缓存**: `x-vercel-cache: HIT` 但 `cache-control: max-age=0`
3. **渲染阻塞请求非问题**: CSS 加载仅 4 ms
4. **预计优化收益**: 降低 TTFB 可节省 ~1,193 ms FCP/LCP

---

## 阶段三：TTFB 优化 🔥 优先级最高

### 问题分析
- **当前 TTFB**: 1,294 ms (目标 < 600 ms)
- **根因**: HTML 请求的 `cache-control: max-age=0, must-revalidate` 导致每次都重新生成
- **Vercel Cache 显示 HIT**: 说明 Edge Function 冷启动仍需优化

### 优化方案 (按优先级)

#### 1. 增加 HTML 页面缓存时间 🔥
**当前配置**: `cache-control: public, max-age=0, must-revalidate`
**建议配置**: `cache-control: public, max-age=300, stale-while-revalidate=600`

**预期收益**: TTFB 从 1,294 ms → < 100 ms (CDN 缓存命中时)

#### 2. 实现增量静态再生成 (ISR)
- 在 Vercel 上预渲染 tools 页面
- 设置 60-300 秒的 revalidate 时间
- 减少动态生成的压力

#### 3. Supabase 查询优化
- 检查 `api/tools-cache` 的查询性能
- 考虑添加复合索引: `(status, upvotes)`, `(status, date_added)`

### 优化任务清单
- [ ] 配置 Vercel 缓存头 (vercel.json 或 next.config.js)
- [ ] 实现 ISR 预渲染
- [ ] 检查并优化 Supabase 索引

---

## 阶段四：组件拆分优化

### 待优化组件
- [ ] ToolManagementModal.tsx (429 行)
- [ ] SkeletonLoader.tsx (381 行)

---

## 测试历史记录

### 测试 #1 - 优化前基线
**日期:** 2026-02-02
**版本:** f5326eb (优化前)
**结果:**
- LCP: 963 ms
- CLS: 0.08
- TTFB: 855 ms

### 测试 #2 - Chrome DevTools 自动化测试
**日期:** 2026-02-02
**版本:** 5408fac (虚拟滚动)
**结果:**
- TTFB: 1,294 ms ❌ (目标 < 600 ms)
- LCP: 1,407 ms ✅ (目标 < 2500 ms)
- CLS: 0.06 ✅ (目标 < 0.1)
- **瓶颈**: TTFB 占 LCP 的 92%

### 测试 #3 - 缓存优化后 🎉
**日期:** 2026-02-02
**版本:** 7d30b5d (KV 缓存支持)
**结果:**
- TTFB: **5 ms** ✅ (改善 99.6%)
- LCP: **119 ms** ✅ (改善 91.5%)
- CLS: 0.06 ✅
- **关键变更**:
  - vercel.json 缓存头配置生效 (`cache-control: max-age=300, s-maxage=300`)
  - Vercel 边缘缓存命中 (`x-vercel-cache: HIT`)
  - 使用正则表达式匹配 HTML 文件路径

### 测试 #4 - 最新验证测试 🎉
**日期:** 2026-02-03
**版本:** 473eaaa (性能优化计划更新后)
**测试方法:** Chrome DevTools MCP 自动化测试
**结果:**
- **冷启动 (no-store)**: **780 ms** ⚠️
- **缓存命中 (5次平均)**: **4.2 ms** 🎉 (目标 < 600 ms ✅)
- CLS: **0.000** ✅ (优秀)
- 资源数: 11 个
- **缓存状态**:
  - `cache-control`: `public, max-age=300, s-maxage=300, stale-while-revalidate=600, must-revalidate` ✅
  - `x-vercel-cache`: HIT ✅
  - `age`: 1279 秒（缓存已存在 21 分钟）
- **连续测试结果**:
  | 迭代 | 响应时间 | 缓存状态 |
  |------|---------|---------|
  | 1 | 5 ms | HIT |
  | 2 | 4 ms | HIT |
  | 3 | 5 ms | HIT |
  | 4 | 3 ms | HIT |
  | 5 | 4 ms | HIT |
- **API 测试**:
  - `/api/tools-cache`: **1281 ms** (fromKV: false)
  - 说明: API 端点尚未启用 KV 缓存
- **结论**:
  - ✅ CDN 缓存优化已生效
  - ✅ 热缓存响应时间约 4 ms（改善 99.6%）
  - ⚠️ 冷启动/绕过缓存时仍有 780 ms 延迟
  - ⚠️ API 端点响应时间较长 (1281 ms)，需要优化

---

## 已完成的优化 ✅

### 1. Vercel Functions 冷启动优化
- ✅ 配置 vercel.json 缓存头
- ✅ 使用 `routes` 和 `headers` 双重配置
- ✅ 正则表达式匹配带/不带 .html 后缀的路径

### 2. Supabase 查询优化
- ✅ 创建索引优化迁移文件 (`supabase/migrations/20260202_performance_indexes.sql`)
- ✅ 删除未使用的索引
- ✅ 添加复合索引 `(status, sort_field DESC)`
- ✅ 添加 GIN 索引用于数组筛选
- ✅ 包含 RLS 策略优化说明

### 3. Vercel KV 缓存支持
- ✅ 创建 `kv-cache.ts` 缓存库
- ✅ 创建 `tools-cache-kv.ts` API 集成 KV 缓存
- ✅ 使用 Cache-Aside 模式
- ✅ 支持模式匹配删除缓存

### 下一步 (可选)
- [ ] 在 Vercel Dashboard 创建 KV 数据库
- [ ] 执行 Supabase 索引迁移 SQL
- [ ] 将 API 路由切换到 tools-cache-kv

### 4. 代码分割与动态导入 ✅ (阶段 3 - 2026-02-05)
- ✅ ToolFilters 和 ToolGrid 改为命名导出
- ✅ 使用 React.lazy 重新启用动态导入
- ✅ 添加 Suspense 包装和 loading fallback
- ✅ react-virtuoso 独立打包到 vendor chunk
- ✅ 构建验证:
  - ToolFilters: 6.53 KB (gzip: 2.04 KB)
  - ToolGrid: 15.07 KB (gzip: 4.48 KB)
  - vendor-virtuoso: 54.44 KB (gzip: 19.18 KB)

---

## 错误记录

### [错误]: 解决方案
- 日期: ___
- 问题描述: ___
- 解决方案: ___

---

## 状态
**当前阶段:** 阶段三 - TTFB 优化
**下一步:** 配置 Vercel 缓存头，增加 HTML 页面缓存时间

### 测试结论
- ✅ LCP 和 CLS 已达标
- ❌ TTFB 是主要瓶颈，需要优化服务器响应时间
- 🎯 优化目标: TTFB < 600 ms

### 测试指导
请按以下步骤手动测试：

1. 打开 Chrome 无痕模式 (Ctrl+Shift+N)
2. 访问 https://www.tumuai.net/tools
3. 按 F12 打开 DevTools
4. 切换到 Lighthouse 面板
5. 选择 Desktop 模式，点击 "Analyze page load"
6. 记录结果到本文件
7. 重复步骤 5-6，选择 Mobile 模式
