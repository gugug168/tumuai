# 截图系统优化研究笔记

## 当前架构

### 存储位置
```
Supabase Storage: tool-screenshots
路径: tools/{toolId}/fullpage.png
数据库: tools.screenshots (text[])
```

### 截图生成流程
1. 工具提交/审核时触发
2. 调用 `api/admin-actions.ts` 的 `generateAndStoreToolScreenshots()`
3. 使用 thum.io API 生成全页截图
4. 上传到 Supabase Storage
5. 更新数据库 `screenshots` 字段

### 第三方 API
```typescript
// 当前使用的 thum.io 端点
https://image.thum.io/get/fullpage/noanimate/width/1200/{url}
https://image.thum.io/get/noanimate/width/1200/{url}
https://image.thum.io/get/noanimate/width/1000/{url}
https://image.thum.io/get/noanimate/width/800/{url}
```

### Fallback 策略
- 首选: 全页截图 (1200px 宽, 12s 超时)
- Fallback 1: 标准截图 (1200px 宽, 8s 超时)
- Fallback 2: 中等截图 (1000px 宽, 8s 超时)
- Fallback 3: 小截图 (800px 宽, 8s 超时)

---

## 问题分析

### 1. 单一截图问题
每个工具只有一张全页截图，用户需要：
- 滚动查看完整功能
- 无法快速定位关键信息
- 移动端体验差

### 2. 重复内容问题
工具网站可能使用相似模板：
- Bootstrap/Vercel/Next.js 官方模板
- 相似的 Hero section 布局
- 通用的 Features 展示

### 3. 格式问题
- PNG 格式体积大
- WebP 支持可减少 50%+ 体积
- Supabase Storage 已支持 WebP MIME 类型

---

## 优化方案

### 方案 A: 多区域智能截取 (推荐)

**优点:**
- 展示不同功能区域
- 更好的用户体验
- 突出工具特点

**缺点:**
- 需要浏览器自动化
- 处理时间较长
- 实现复杂度高

**实现步骤:**
1. 使用 Playwright 访问目标网站
2. 分析页面结构，定位关键区域
3. 分区截图 (Hero, Features, Pricing)
4. 转换为 WebP
5. 去重检测

### 方案 B: 多尺寸全页截图 (简化版)

**优点:**
- 实现简单
- 使用现有 thum.io API
- 无需额外依赖

**缺点:**
- 无法突出特定区域
- 仍有重复内容问题

### 方案 C: 混合方案

**优点:**
- 平衡效果和成本
- 快速全页 + 关键区域裁剪
- 渐进式实现

**实施:**
1. 保留 thum.io 全页截图
2. 使用 Playwright 智能裁剪 2-3 个关键区域
3. 添加去重逻辑

---

## 技术选型

### Playwright 配置
```typescript
import { chromium } from 'playwright-core';

const browser = await chromium.launch();
const page = await browser.newPage();

// 设置视口
await page.setViewportSize({ width: 1200, height: 800 });

// 访问页面
await page.goto(url, { waitUntil: 'networkidle' });

// 截取 Hero 区域
const heroElement = await page.$('header, .hero, [class*="hero"]');
if (heroElement) {
  await heroElement.screenshot({ path: 'hero.webp', type: 'webp' });
}
```

### 图像去重 (pHash)
```typescript
import { imageHash } from 'image-hash';

const hash1 = await imageHash('image1.webp');
const hash2 = await imageHash('image2.webp');
const distance = hammingDistance(hash1, hash2);

// 汉明距离 < 5 视为重复
if (distance < 5) {
  // 跳过重复截图
}
```

---

## 存储结构设计

### 新文件命名
```
tools/{toolId}/
├── 000-hero.webp          # 首屏/Hero (优先级最高)
├── 001-features.webp      # 功能展示区
├── 002-pricing.webp       # 价格区域
├── 003-demo.webp          # 演示/截图区
└── 004-fullpage.webp      # 完整页面 (可选)
```

### 数据库字段
```sql
-- 扩展 screenshots 数组结构
screenshots text[] = [
  'https://.../hero.webp',
  'https://.../features.webp',
  'https://.../pricing.webp'
]

-- 或新增结构化字段
screenshot_metadata jsonb = {
  "hero": { "url": "...", "width": 1200, "height": 800, "size": 102400 },
  "features": { "url": "...", "width": 1200, "height": 600, "size": 96000 }
}
```

---

## 性能估算

### 当前 (单张 PNG)
- 大小: ~500KB
- 加载时间: ~2s (3G)
- 用户体验: 需滚动查看

### 优化后 (3-4 张 WebP)
- 大小: ~300-500KB (总计)
- 加载时间: ~1.5s (3G, 并行加载)
- 用户体验: 快速浏览各区域

---

## 待确认事项

1. **是否使用 Playwright?**
   - 需要 Node.js 环境
   - Vercel Functions 可能超时
   - 考虑使用独立的 Worker 服务

2. **历史截图处理?**
   - 保留现有 PNG
   - 增量生成 WebP
   - 或批量重新生成

3. **去重阈值?**
   - 汉明距离 < 5?
   - 或手动标记重复?
