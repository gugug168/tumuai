# CLAUDE.md

请统一使用中文回复。

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

Civil AI Hub是一个面向Civil领域的人工智能工具平台，使用React + TypeScript + Vite构建，部署在Netlify上，后端使用Supabase（PostgreSQL数据库）。

## 技术栈

- **前端**：React 18 + TypeScript + Vite
- **样式**：Tailwind CSS + Lucide React图标
- **路由**：React Router v7
- **状态管理**：React Context
- **后端**：Supabase（数据库+认证）
- **部署**：Netlify Functions（无服务器函数）

## 常用命令

### 开发
```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run preview      # 预览生产构建
npm run lint         # ESLint代码检查
```

### 环境配置
```bash
# 开发环境变量配置
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# 生产环境变量（Netlify）
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 项目架构

### 目录结构
```
src/
├── components/       # 可重用UI组件
├── contexts/         # React Context提供者
├── lib/              # 核心库和工具函数
│   ├── supabase.ts   # Supabase客户端配置
│   ├── api.ts        # API调用封装
│   ├── auth.ts       # 认证相关
│   └── admin.ts      # 管理员功能
├── pages/            # 页面组件
├── App.tsx           # 主应用路由配置
└── main.tsx          # 应用入口

netlify/functions/    # 服务器函数（管理员功能）
├── admin-actions.ts  # 工具审核CRUD
├── admin-check.ts    # 管理员权限验证
├── admin-datasets.ts # 数据统计
├── admin-stats.ts    # 统计信息
├── tools.ts          # 工具API
└── user-favorites.ts # 用户收藏
```

### 核心数据模型

**工具(Tool)**：
- 基本信息：id, name, tagline, description, website_url, logo_url
- 分类：categories[], features[]
- 定价：pricing (Free/Freemium/Paid/Trial)
- 统计：upvotes, views, rating, review_count
- 状态：featured, date_added, created_at, updated_at

### 关键功能模块

1. **用户功能**：浏览工具、搜索过滤、收藏、提交新工具
2. **管理功能**：工具审核、CRUD操作、数据统计
3. **认证系统**：基于Supabase Auth的用户认证
4. **数据获取**：优先使用Netlify Functions，兜底Supabase客户端

### 部署流程

项目使用Netlify自动部署：
1. 代码推送到GitHub触发自动构建
2. Netlify运行`npm run build`构建静态资源
3. 无服务器函数自动部署到`netlify/functions/`
4. 环境变量在Netlify Dashboard中配置

### 开发注意事项

- **数据获取**：优先使用Netlify Functions避免RLS问题
- **权限控制**：管理员功能使用服务器函数验证权限
- **环境变量**：开发使用`.env.local`，生产使用Netlify环境变量
- **错误处理**：所有API调用都有完善的错误处理和兜底机制



# Development Guidelines

## Philosophy

### Core Beliefs

- **Incremental progress over big bangs** - Small changes that compile and pass tests
- **Learning from existing code** - Study and plan before implementing
- **Pragmatic over dogmatic** - Adapt to project reality
- **Clear intent over clever code** - Be boring and obvious

### Simplicity Means

- Single responsibility per function/class
- Avoid premature abstractions
- No clever tricks - choose the boring solution
- If you need to explain it, it's too complex

## Process

### 1. Planning & Staging

Break complex work into 3-5 stages. Document in `IMPLEMENTATION_PLAN.md`:

```markdown
## Stage N: [Name]
**Goal**: [Specific deliverable]
**Success Criteria**: [Testable outcomes]
**Tests**: [Specific test cases]
**Status**: [Not Started|In Progress|Complete]
```
- Update status as you progress
- Remove file when all stages are done

### 2. Implementation Flow

1. **Understand** - Study existing patterns in codebase
2. **Test** - Write test first (red)
3. **Implement** - Minimal code to pass (green)
4. **Refactor** - Clean up with tests passing
5. **Commit** - With clear message linking to plan

### 3. When Stuck (After 3 Attempts)

**CRITICAL**: Maximum 3 attempts per issue, then STOP.

1. **Document what failed**:
   - What you tried
   - Specific error messages
   - Why you think it failed

2. **Research alternatives**:
   - Find 2-3 similar implementations
   - Note different approaches used

3. **Question fundamentals**:
   - Is this the right abstraction level?
   - Can this be split into smaller problems?
   - Is there a simpler approach entirely?

4. **Try different angle**:
   - Different library/framework feature?
   - Different architectural pattern?
   - Remove abstraction instead of adding?

## Technical Standards

### Architecture Principles

- **Composition over inheritance** - Use dependency injection
- **Interfaces over singletons** - Enable testing and flexibility
- **Explicit over implicit** - Clear data flow and dependencies
- **Test-driven when possible** - Never disable tests, fix them

### Code Quality

- **Every commit must**:
  - Compile successfully
  - Pass all existing tests
  - Include tests for new functionality
  - Follow project formatting/linting

- **Before committing**:
  - Run formatters/linters
  - Self-review changes
  - Ensure commit message explains "why"

### Error Handling

- Fail fast with descriptive messages
- Include context for debugging
- Handle errors at appropriate level
- Never silently swallow exceptions

## Decision Framework

When multiple valid approaches exist, choose based on:

1. **Testability** - Can I easily test this?
2. **Readability** - Will someone understand this in 6 months?
3. **Consistency** - Does this match project patterns?
4. **Simplicity** - Is this the simplest solution that works?
5. **Reversibility** - How hard to change later?

## Project Integration

### Learning the Codebase

- Find 3 similar features/components
- Identify common patterns and conventions
- Use same libraries/utilities when possible
- Follow existing test patterns

### Tooling

- Use project's existing build system
- Use project's test framework
- Use project's formatter/linter settings
- Don't introduce new tools without strong justification

## Quality Gates

### Definition of Done

- [ ] Tests written and passing
- [ ] Code follows project conventions
- [ ] No linter/formatter warnings
- [ ] Commit messages are clear
- [ ] Implementation matches plan
- [ ] No TODOs without issue numbers

### Test Guidelines

- Test behavior, not implementation
- One assertion per test when possible
- Clear test names describing scenario
- Use existing test utilities/helpers
- Tests should be deterministic

## Important Reminders

**NEVER**:
- Use `--no-verify` to bypass commit hooks
- Disable tests instead of fixing them
- Commit code that doesn't compile
- Make assumptions - verify with existing code

**ALWAYS**:
- Commit working code incrementally
- Update plan documentation as you go
- Learn from existing implementations
- Stop after 3 failed attempts and reassess
