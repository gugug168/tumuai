# Task Plan: TumuAI 截图系统优化

## 目标
优化 TumuAI 工具截图系统，解决重复截图问题，实现多区域差异化截图，并优化图片性能。

## 当前状态分析

### 截图存储位置
- **Supabase Storage Bucket**: `tool-screenshots`
- **存储路径**: `tools/{toolId}/fullpage.png`
- **数据库字段**: `tools.screenshots` (text[])

### 现有问题
1. **单一截图**: 目前每个工具只有一张全页截图 (`fullpage.png`)
2. **重复内容**: 多个工具可能截取相似的页面区域（如都是通用首页模板）
3. **未使用 WebP**: 截图仍为 PNG 格式，体积较大
4. **无差异化**: 没有针对不同区域（头部、功能展示、价格等）分别截图

### 代码位置
- **截图生成**: `api/admin-actions.ts` - `generateAndStoreToolScreenshots()`
- **截图使用**: `src/pages/ToolDetailPage.tsx` - 显示截图画廊
- **类型定义**: `src/types/index.ts` - `Tool.screenshots`

---

## 阶段

- [x] 阶段 1: 研究当前截图系统架构
- [x] 阶段 2: 设计多区域截图方案
- [x] 阶段 3: 实现截图优化功能
- [ ] 阶段 4: 测试与验证

---

## 阶段 1: 研究当前截图系统架构

### 子任务
- [x] 分析截图存储位置和结构
- [x] 查看截图生成逻辑
- [x] 了解截图展示方式

### 发现
- 截图使用 thum.io API 生成
- 每个工具只有一张全页截图
- 存储在 Supabase Storage，最大 10MB 限制
- 代码使用 fallback 机制尝试不同尺寸

### 问题总结
1. **单一全页截图** - 用户无法快速了解工具的核心功能
2. **无 WebP 格式** - PNG 文件体积大
3. **重复内容** - 相似网站模板导致截图雷同

---

## 阶段 2: 设计多区域截图方案

### 设计目标
1. **多截图区域**: 为每个工具生成 3-5 张不同区域的截图
2. **智能区域选择**: 自动识别页面关键区域（Hero、Features、Pricing、Footer）
3. **WebP 优先**: 新截图统一使用 WebP 格式
4. **去重机制**: 检测并跳过高度相似的截图

### 新存储结构
```
tools/{toolId}/
├── hero.webp          # 首屏/Hero 区域
├── features.webp      # 功能展示区
├── pricing.webp       # 价格区域（如果有）
└── fullpage.webp      # 完整页面（可选）
```

### 技术方案
1. **Playwright/Puppeteer**: 使用浏览器自动化进行智能区域截取
2. **图像哈希**: 使用 pHash 算法检测重复截图
3. **动态裁剪**: 根据页面结构自动定位区域

---

## 阶段 3: 实现截图优化功能

### 文件修改清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `api/admin-actions.ts` | 编辑 | 增强截图生成逻辑 |
| `api/screenshot-service.ts` | 新增 | 独立截图服务模块 |
| `api/screenshot.ts` | 新增 | Vercel Function API |
| `scripts/refresh-screenshots.js` | 新增 | 批量刷新脚本 |

### 实现步骤

#### 3.1 创建截图服务模块
- [x] 创建 `api/screenshot-service.ts`
- [x] 实现多区域截取逻辑
- [x] 添加 WebP 转换
- [x] 实现去重检测

#### 3.2 更新管理接口
- [x] 修改 `generateAndStoreToolScreenshots()`
- [x] 添加批量刷新功能
- [x] 添加截图去重 API

#### 3.3 前端展示优化
- [ ] 更新 `ToolDetailPage.tsx` 画廊组件
- [ ] 添加截图区域标签
- [ ] 优化加载性能

---

## 阶段 4: 测试与验证

### 验证清单
- [ ] 新截图生成正常
- [ ] WebP 格式正确
- [ ] 不同区域截图有明显差异
- [ ] 重复截图被正确过滤
- [ ] 前端画廊展示正常
- [ ] 性能测试通过

### 性能目标
| 指标 | 当前 | 目标 |
|------|------|------|
| 单张截图大小 | ~500KB PNG | ~100KB WebP |
| 截图数量 | 1张/工具 | 3-5张/工具 |
| 总体积/工具 | ~500KB | ~300-500KB |

---

## 关键问题

1. **Q: 使用 Playwright 还是第三方 API?**
   - A: 建议混合使用 - Playwright 用于智能区域识别，thum.io 用于快速全页截图

2. **Q: 如何处理历史截图?**
   - A: 保留现有截图作为 `fullpage.png`，增量生成新区域截图

3. **Q: 去重阈值如何设定?**
   - A: 使用 pHash 算法，汉明距离 < 5 视为重复

---

## 决策记录

### 决策 1: 使用 WebP 格式
- **原因**: 相同质量下体积减少 50%+
- **实施**: 新生成的截图默认 WebP，保留 PNG fallback

### 决策 2: 多区域截图策略
- **原因**: 单一全页截图无法突出工具特点
- **实施**: 优先截取 Hero、Features、Pricing 三个区域

### 决策 3: 批量重新生成 (用户选择)
- **原因**: 用户希望一次性更新所有工具截图
- **实施**: 提供 `scripts/refresh-screenshots.js` 脚本

---

## 遇到的错误

### 暂无

---

## Status
**Currently in Phase 4** - 功能实现完成，等待测试验证

## 下一步
运行批量刷新脚本: `node scripts/refresh-screenshots.js`
