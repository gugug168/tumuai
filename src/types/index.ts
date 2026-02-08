// 基础工具数据接口 - 更严格的类型定义
export interface Tool {
  readonly id: string
  name: string
  tagline: string
  description: string | null
  website_url: string
  logo_url: string | null
  /** Screenshot URLs (usually stored in Supabase Storage bucket `tool-screenshots`). */
  screenshots?: string[] | null
  categories: readonly string[]
  features: readonly string[]
  pricing: 'Free' | 'Freemium' | 'Paid' | 'Trial'
  featured: boolean
  date_added: string
  upvotes: number
  views: number
  rating: number
  review_count: number
  readonly created_at: string
  readonly updated_at: string
  status?: 'published' | 'draft' | 'pending' | 'archived'
  category_id?: string | null
}

// 用于创建工具的输入类型
export interface CreateToolInput {
  name: string
  tagline: string
  description?: string
  website_url: string
  logo_url?: string
  categories?: string[]
  features?: string[]
  pricing?: Tool['pricing']
  featured?: boolean
  category_id?: string
}

// 用于更新工具的类型
export type UpdateToolInput = Partial<Omit<Tool, 'id' | 'created_at' | 'updated_at' | 'upvotes' | 'views' | 'rating' | 'review_count'>>

// API响应类型
export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
}

// 搜索过滤器类型
export interface ToolSearchFilters {
  /** Full-text-ish search (server-side uses ILIKE on name/tagline/description). */
  search?: string
  categories?: readonly string[]
  features?: readonly string[]
  pricing?: Tool['pricing']
  featured?: boolean
  minRating?: number
  sortBy?: 'upvotes' | 'views' | 'rating' | 'date_added' | 'name'
  sortOrder?: 'asc' | 'desc'
}

// 用户认证相关类型
export interface UserProfile {
  readonly id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  company: string | null
  position: string | null
  website: string | null
  location: string | null
  readonly created_at: string
  readonly updated_at: string
}

export interface AuthState {
  user: import('@supabase/supabase-js').User | null
  session: import('@supabase/supabase-js').Session | null
  profile: UserProfile | null
  loading: boolean
}

// 评论系统类型 - 增强版
export interface ToolReview {
  readonly id: string
  tool_id: string
  user_id: string
  rating: number
  title?: string
  content?: string
  helpful_count: number
  readonly created_at: string
  readonly updated_at: string
  user_profiles?: {
    username?: string
    full_name?: string
    avatar_url?: string
  }
}

export interface CreateReviewInput {
  tool_id: string
  rating: ToolReview['rating']
  title?: string
  content?: string
}

// 分类系统类型
export interface Category {
  readonly id: string
  name: string
  slug: string
  description: string | null
  color: string
  icon: string
  parent_id: string | null
  sort_order: number
  is_active: boolean
  readonly created_at: string
  readonly updated_at: string
}

export interface CreateCategoryInput {
  name: string
  slug?: string
  description?: string
  color?: string
  icon?: string
  parent_id?: string
  sort_order?: number
  is_active?: boolean
}

// 工具提交类型
export interface ToolSubmission {
  readonly id: string
  tool_name: string
  tagline: string
  description: string | null
  website_url: string
  logo_url: string | null
  categories: readonly string[]
  features: readonly string[]
  pricing: Tool['pricing']
  submitter_email: string
  submitter_name: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  readonly created_at: string
  readonly updated_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  /** Best-effort hints from admin API to detect duplicates already in `tools`. */
  already_in_tools?: boolean
  existing_tools?: Array<{
    id: string
    name: string
    website_url: string
    match_type: 'exact' | 'host'
  }>
}

// 管理员操作类型
export interface AdminUser {
  readonly id: string
  user_id: string
  role: 'admin' | 'super_admin'
  permissions: Record<string, boolean>
  readonly created_at: string
  readonly updated_at: string
}

// 错误处理类型
export interface AppError {
  readonly code: string
  message: string
  details?: unknown
  readonly timestamp: string
}

export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const

export type ErrorCode = keyof typeof ERROR_CODES

// 实用工具类型
export type NonEmptyArray<T> = [T, ...T[]]
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

// 组件Props类型辅助
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}

// 表单输入类型
export type FormInputValue = string | number | boolean | string[] | null
export type FormErrors<T> = Partial<Record<keyof T, string>>

// Hook返回类型
export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: AppError | null
}

export interface MutationState {
  loading: boolean
  error: AppError | null
  success: boolean
}

// 管理员日志类型
export interface AdminLog {
  readonly id: string
  action: string
  details: string
  user_id: string
  resource_type: string
  resource_id: string
  readonly timestamp: string
  ip_address?: string
  user_agent?: string
}

// 数据库修复结果类型
export interface DatabaseRepairResult {
  success: boolean
  message: string
  details?: {
    tablesFixed: string[]
    recordsUpdated: number
    errors: string[]
  }
  timestamp: string
}

// 更严格的API查询参数类型
export interface ToolsQueryParams {
  limit?: number
  sortBy?: 'date_added' | 'upvotes' | 'views' | 'rating' | 'name'
  sortOrder?: 'asc' | 'desc'
  category?: string
  search?: string
  pricing?: Tool['pricing']
  featured?: boolean
}

// 工具统计信息类型
export interface ToolStats {
  favoritesCount: number
  reviewCount: number
  averageRating: number
  commentsCount: number
}

// 用户收藏类型
export interface UserFavorite {
  readonly id: string
  user_id: string
  tool_id: string
  readonly created_at: string
  tools?: Tool
}
