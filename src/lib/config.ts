// 全局配置文件 - 统一管理所有硬编码配置

// 管理员配置 - 从环境变量获取
export const ADMIN_CONFIG = {
  emails: import.meta.env.VITE_ADMIN_EMAILS?.split(',') || [],
  superAdminEmail: import.meta.env.VITE_SUPER_ADMIN_EMAIL || '',
  // 移除所有硬编码凭证
} as const

// 定价选项配置 - 统一格式
export const PRICING_OPTIONS = [
  { value: 'Free', label: '完全免费', description: '永久免费使用' },
  { value: 'Freemium', label: '免费增值', description: '基础功能免费，高级功能收费' },
  { value: 'Paid', label: '付费软件', description: '需要付费购买使用' },
  { value: 'Trial', label: '免费试用', description: '提供限期免费试用' }
] as const

// 用于提交表单的定价选项（小写格式保持兼容性）
export const SUBMIT_PRICING_OPTIONS = [
  { value: 'free', label: '完全免费' },
  { value: 'freemium', label: '免费增值' },
  { value: 'paid', label: '付费软件' },
  { value: 'trial', label: '免费试用' }
] as const

// 紧急情况下的最小分类集（仅在数据库完全不可用时使用）
// 注意：正常情况下应该使用 CategoryManager.getCategories() 从数据库获取
export const EMERGENCY_CATEGORIES = [
  'AI结构设计',
  'BIM软件',
  '效率工具'
] as const

// 后备功能特性配置（将来可迁移到数据库）
export const FALLBACK_FEATURES = [
  'AI优化',
  '参数化设计',
  '自动生成',
  '智能分析',
  '云端协作',
  '实时计算',
  '三维建模',
  '结构计算',
  '图纸生成',
  '数据导入导出'
] as const

// 排序选项配置
export const SORT_OPTIONS = [
  { value: 'upvotes', label: '最受欢迎' },
  { value: 'date_added', label: '最新收录' },
  { value: 'rating', label: '评分最高' },
  { value: 'views', label: '浏览最多' }
] as const

// 应用配置
export const APP_CONFIG = {
  defaultToolsLimit: 60,
  maxRetries: 3,
  cacheTimeout: 15 * 60 * 1000, // 15分钟
  requestTimeout: 15000, // 15秒
  maxFileSize: 5 * 1024 * 1024, // 5MB
  supportedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
} as const

// API端点配置
export const API_ENDPOINTS = {
  vercelFunctions: {
    // 统一后的端点
    adminApi: '/api/admin-api', // action=check|users|datasets
    publicApi: '/api/public-api', // action=categories|tools|tools-filtered
    screenshotApi: '/api/screenshot-api', // action=enqueue|status|stats

    // 保留的独立端点
    adminActions: '/api/admin-actions',
    incrementViews: '/api/increment-views',
    aiSmartFill: '/api/ai-smart-fill',
    checkWebsiteDuplicate: '/api/check-website-duplicate',
    logoExtract: '/api/logo-extract',
    errors: '/api/errors',

    // 兼容性映射（指向新端点）
    adminCheck: '/api/admin-api?action=check',
    adminDatasets: '/api/admin-api?action=datasets',
    adminUsers: '/api/admin-api?action=users',
    toolsCache: '/api/public-api?action=tools',
    categoriesCache: '/api/public-api?action=categories',
    toolsFiltered: '/api/public-api?action=tools-filtered'
  }
} as const
