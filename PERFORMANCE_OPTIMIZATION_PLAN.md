# tumuai.net 性能优化计划

## 目标
通过迭代式优化和实际测试验证，持续提升 tumuai.net 的性能指标。

## 测试标准

### Core Web Vitals 目标
| 指标 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| LCP (Largest Contentful Paint) | 963 ms | < 2500 ms | ✅ 良好 |
| CLS (Cumulative Layout Shift) | 0.08 | < 0.1 | ✅ 良好 |
| TTFB (Time to First Byte) | 855 ms | < 600 ms | ⚠️ 需优化 |
| FID (First Input Delay) | - | < 100 ms | 待测 |
| Lighthouse 性能分数 | - | > 90 | 待测 |

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
<!-- 需要手动 Lighthouse 测试填写 -->
**Lighthouse 桌面版:**
- 性能分数: ___ (待测试)
- LCP: ___ ms (待测试)
- TTFB: ___ ms (待测试)
- CLS: ___ (待测试)
- FID: ___ ms (待测试)

**Lighthouse 移动版:**
- 性能分数: ___ (待测试)
- LCP: ___ ms (待测试)
- TTFB: ___ ms (待测试)
- CLS: ___ (待测试)
- FID: ___ ms (待测试)

---

## 阶段三：TTFB 优化（待测试后确定）

### 计划优化项
- [ ] Vercel Functions 冷启动优化
- [ ] Supabase 查询优化（索引、RLS）
- [ ] CDN 缓存策略验证

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

### 测试 #2 - 虚拟滚动后
**日期:** ___
**版本:** 5408fac (虚拟滚动)
**结果:**
- 待测试

---

## 错误记录

### [错误]: 解决方案
- 日期: ___
- 问题描述: ___
- 解决方案: ___

---

## 状态
**当前阶段:** 阶段二 - 性能基线测试
**下一步:** 手动使用 Chrome DevTools Lighthouse 测试 https://www.tumuai.net

### 测试指导
请按以下步骤手动测试：

1. 打开 Chrome 无痕模式 (Ctrl+Shift+N)
2. 访问 https://www.tumuai.net/tools
3. 按 F12 打开 DevTools
4. 切换到 Lighthouse 面板
5. 选择 Desktop 模式，点击 "Analyze page load"
6. 记录结果到本文件
7. 重复步骤 5-6，选择 Mobile 模式
