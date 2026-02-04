# Notes: Civil AI Hub 代码库分析

## 项目基本信息
- **项目名称**: Civil AI Hub (土木AI网 - tumuai.net)
- **技术栈**: React 18 + TypeScript + Vite + Tailwind CSS
- **后端**: Supabase (PostgreSQL)
- **部署**: Vercel Functions + CDN

---

## 一、项目整体架构

### 目录结构
```
src/
├── components/         # 34个可重用UI组件
├── pages/             # 10个页面组件
├── lib/               # 核心库和工具函数
├── contexts/          # React Context (Auth, Profile, HomeData)
├── hooks/             # 自定义Hooks
├── utils/             # 工具函数
└── types/             # TypeScript类型定义

api/                   # Vercel服务器函数
├── admin-actions.ts   # 管理员CRUD
├── tools.ts           # 工具API
└── ai-smart-fill.ts   # AI智能填充
```

### 路由配置
| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | HomePage | 首页（非懒加载） |
| `/tools` | ToolsPage | 工具列表 |
| `/tools/:toolId` | ToolDetailPage | 工具详情 |
| `/submit` | SubmitToolPage | 提交工具 |
| `/profile` | ProfilePage | 用户资料 |
| `/admin/*` | AdminDashboard | 管理后台 |

---

## 二、核心功能模块

### 1. 工具浏览系统
**文件**: `ToolsPage.tsx`, `useToolData.ts`

- 分页加载（每页12个）
- 智能数据源：API代理 → 本地缓存 → 直连数据库
- 预加载下一页优化体验

### 2. 搜索和过滤
**文件**: `useToolFilters.ts`

- 防抖搜索（300ms）
- 支持：分类、定价、特性筛选
- 客户端筛选 + 服务端筛选智能切换

### 3. 收藏系统
**文件**: `lib/community.ts`

- 批量检查收藏状态（性能优化）
- `user_favorites` 表存储

### 4. 提交系统
**文件**: `SubmitToolPage.tsx`

- AI智能填入（DeepSeek）
- 重复检测
- Logo自动获取/生成
- 5步式表单

### 5. 管理系统
**文件**: `AdminDashboard.tsx`, `api/admin-actions.ts`

- 工具审核CRUD
- 分类管理
- 用户管理
- 批量操作

---

## 三、数据层设计

### 核心数据模型
```typescript
interface Tool {
  id, name, tagline, description
  website_url, logo_url, screenshots
  categories[], features[]
  pricing: Free/Freemium/Paid/Trial
  upvotes, views, rating, review_count, favorites_count
  status: published/draft/rejected
  featured, date_added, updated_at
}
```

### 数据库表
- `tools` - 工具主表
- `categories` - 分类表（支持多级）
- `user_favorites` - 用户收藏
- `tool_reviews` - 评论
- `tool_submissions` - 提交审核
- `admin_users` - 管理员
- `api_performance` - 性能监控

### API策略
**多级缓存**:
1. CDN缓存 (10分钟)
2. 内存缓存 (LRU)
3. localStorage持久化

**智能路由**: API代理 → 缓存 → Supabase直连

---

## 四、技术亮点

| 方面 | 实现 |
|------|------|
| 性能 | 懒加载、代码分割、预加载、缓存策略 |
| 安全 | RLS策略、JWT验证、输入验证 |
| UX | 错误边界、骨架屏、加载状态 |
| 可维护性 | TypeScript严格模式、模块化设计 |

---

## 五、潜在优化点（待确认）

1. **性能优化**
   - 大列表虚拟化？
   - 图片CDN优化？
   - Bundle体积分析？

2. **代码质量**
   - 组件复用性检查
   - 类型覆盖率提升
   - 测试覆盖？

3. **架构优化**
   - 状态管理升级？（Context → Zustand/Redux）
   - 路由架构优化？

4. **用户体验**
   - 加载性能优化
   - 交互反馈改进
   - 响应式设计完善？

---

## 关键文件路径

| 文件 | 职责 |
|------|------|
| `src/App.tsx` | 应用根组件，路由配置 |
| `src/lib/api.ts` | API调用封装 |
| `src/lib/supabase.ts` | Supabase客户端 |
| `src/contexts/AuthContext.tsx` | 认证状态管理 |
| `api/admin-actions.ts` | 管理员API |
| `vite.config.ts` | 构建配置 |
