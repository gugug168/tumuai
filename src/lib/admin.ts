import { supabase } from './supabase'
import { ADMIN_CONFIG, API_ENDPOINTS } from './config'
import { unifiedCache } from './unified-cache-manager'

// 基本类型定义
export interface AdminUser {
  user_id: string
  email?: string
  role: string
  is_super_admin?: boolean
}

// 工具类型接口
interface Tool {
  id: string
  name: string
  tagline?: string
  description?: string
  website_url: string
  logo_url?: string
  categories?: string[]
  features?: string[]
  pricing?: 'Free' | 'Freemium' | 'Paid' | 'Trial'
  featured?: boolean
  status?: string
}

// 添加缺失的类型定义
export interface ToolSubmission extends Tool {}
export interface AdminLog {
  id: string
  action: string
  timestamp: string
  admin_id: string
}

// 获取访问令牌 - 简化版
async function ensureAccessToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

// 统一获取所有管理数据 - 调用修复的后端API
export async function getAllAdminData() {
  try {
    console.log('🔄 统一获取管理数据...')
    const accessToken = await ensureAccessToken()
    
    if (!accessToken) {
      throw new Error('用户未登录')
    }
    
    const response = await fetch(API_ENDPOINTS.vercelFunctions.adminDatasets, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`API调用失败: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('✅ 管理数据获取成功:', {
      tools: data.tools?.length || 0,
      users: data.users?.length || 0,
      submissions: data.submissions?.length || 0,
      categories: data.categories?.length || 0,
      logs: data.logs?.length || 0
    })
    
    return data
  } catch (error) {
    console.error('❌ 统一获取管理数据失败:', error)
    throw error
  }
}

// 检查用户是否为管理员 - 直接使用客户端验证（服务端API暂不可用）
export async function checkAdminStatus(): Promise<AdminUser | null> {
  try {
    console.log('🔍 开始检查管理员权限...')

    // 获取当前用户会话
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      console.log('❌ 无效的用户会话:', sessionError?.message || '会话不存在')
      return null
    }

    const accessToken = session.access_token
    if (!accessToken || accessToken === 'null' || accessToken === 'undefined') {
      return null
    }

    // 优先使用服务端验证（使用 service role key，可绕过 RLS，避免前端直查 admin_users 的 406/403 噪音）
    try {
      const response = await fetch(API_ENDPOINTS.vercelFunctions.adminCheck, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        return {
          user_id: data.user_id,
          email: session.user.email,
          role: data.role,
          is_super_admin: data.role === 'super_admin',
          permissions: data.permissions
        } as AdminUser & { permissions?: any }
      }

      // 401/403 视为非管理员；其他错误（如 404）再走前端兜底
      if (response.status === 401 || response.status === 403) {
        console.log('ℹ️ 服务端验证：用户不是管理员')
        return null
      }
    } catch {
      // 网络异常/函数未部署等情况，继续走前端兜底
    }

    // 兜底：客户端验证（可能受 RLS 影响）
    console.log('🔄 使用客户端兜底验证管理员权限...')

    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id, user_id, role, permissions, created_at, updated_at')
      .eq('user_id', session.user.id)
      .limit(1)
      .maybeSingle()

    if (adminError || !adminUser) {
      // `maybeSingle()` returns null when no row exists; treat as non-admin.
      // Avoid logging as an error to prevent console noise (e.g. PostgREST 406 for .single()).
      console.log('ℹ️ 客户端验证：用户不是管理员')
      return null
    }

    console.log('✅ 客户端验证成功:', session.user.email)

    return {
      user_id: adminUser.user_id,
      email: session.user.email,
      role: adminUser.role,
      is_super_admin: adminUser.role === 'super_admin',
      permissions: adminUser.permissions
    } as AdminUser & { permissions?: any }

  } catch (error) {
    console.error('❌ 管理员权限检查异常:', error)
    return null
  }
}

/**
 * 带缓存的管理员权限检查
 * 使用缓存减少重复调用，5分钟TTL
 */
export async function checkAdminStatusWithCache(): Promise<AdminUser | null> {
  try {
    // 先获取当前用户ID用于缓存键
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      return null
    }

    const cacheKey = `admin_status_${session.user.id}`

    return unifiedCache.fetchWithCache(
      cacheKey,
      async () => {
        const result = await checkAdminStatus()
        return result
      },
      {
        ttl: 5 * 60 * 1000, // 5分钟缓存
        staleWhileRevalidate: true
      }
    )
  } catch (error) {
    console.error('❌ 缓存管理员权限检查异常:', error)
    return null
  }
}

/**
 * 清除管理员状态缓存
 * 当权限变更时调用
 */
export function clearAdminStatusCache(): void {
  unifiedCache.invalidate('admin_status_*')
  console.log('🗑️ 管理员状态缓存已清除')
}

// 获取系统统计数据 - 修复字段匹配问题
export async function getSystemStats() {
  try {
    const [toolsCount, publishedCount, pendingCount, categoriesCount, usersCount] = await Promise.all([
      supabase.from('tools').select('id', { count: 'exact', head: true }),
      supabase.from('tools').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('tools').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('categories').select('id', { count: 'exact', head: true }),
      // 获取真实的用户数量 - 统一查询逻辑
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }).catch(async () => {
        // 兜底：如果user_profiles表不存在，查询admin_users表
        const { count } = await supabase.from('admin_users').select('id', { count: 'exact', head: true })
        return { count: (count || 0) } 
      })
    ])
    
    const totalTools = toolsCount.count || 0
    const pendingSubmissions = pendingCount.count || 0
    
    let totalUsers = 0
    if (usersCount && typeof usersCount.count === 'number') {
      totalUsers = usersCount.count
    } else if (usersCount && usersCount.count) {
      totalUsers = usersCount.count
    } else {
      // 最终兜底：设置为1（至少有当前管理员）
      totalUsers = 1
    }
    
    return {
      totalTools: totalTools,
      totalUsers: totalUsers,
      pendingSubmissions: pendingSubmissions,
      totalReviews: 0, // 暂时设为0
      totalFavorites: 0, // 暂时设为0
      totalCategories: categoriesCount.count || 0,
      totalLogs: 0 // 将在 loadLogs 中更新
    }
  } catch (error) {
    console.error('❌ 获取统计数据异常:', error)
    return { 
      totalTools: 0, 
      totalUsers: 1, // 设置为1而不是0，至少有当前管理员
      pendingSubmissions: 0, 
      totalReviews: 0,
      totalFavorites: 0,
      totalCategories: 0,
      totalLogs: 0
    }
  }
}

// 获取工具提交列表 - 修复表名错误
export async function getToolSubmissions(status?: string) {
  try {
    let query = supabase
      .from('tool_submissions')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error } = await query
    if (error) throw error
    
    return data || []
  } catch (error) {
    console.error('❌ 获取工具提交异常:', error)
    return []
  }
}

// 审核工具提交 - 修复逻辑错误
export async function reviewToolSubmission(
  submissionId: string,
  status: 'approved' | 'rejected',
  adminNotes?: string
) {
  try {
    // 首先获取提交数据
    const { data: submission, error: fetchError } = await supabase
      .from('tool_submissions')
      .select('*')
      .eq('id', submissionId)
      .single()
    
    if (fetchError || !submission) {
      throw new Error(`获取提交数据失败: ${fetchError?.message}`)
    }
    
    // 更新提交状态
    const { error: updateError } = await supabase
      .from('tool_submissions')
      .update({ 
        status,
        admin_notes: adminNotes,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', submissionId)
    
    if (updateError) throw updateError
    
    // 如果审核通过，将数据添加到tools表
    if (status === 'approved') {
      const { error: insertError } = await supabase
        .from('tools')
        .insert({
          name: submission.tool_name,
          tagline: submission.tagline,
          description: submission.description,
          website_url: submission.website_url,
          logo_url: submission.logo_url,
          categories: submission.categories,
          features: submission.features || [],
          pricing: submission.pricing || 'Free',
          status: 'published',
          featured: false,
          views: 0,
          upvotes: 0,
          rating: 0,
          review_count: 0,
          date_added: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      
      if (insertError) {
        console.warn('❌ 添加到工具表失败:', insertError)
        // 不抛出错误，因为主要的审核状态更新已成功
      }
    }
    
  } catch (error) {
    console.error('❌ 审核工具失败:', error)
    throw error
  }
}

// 批准工具提交
export async function approveToolSubmission(toolId: string) {
  return await reviewToolSubmission(toolId, 'approved')
}

// 拒绝工具提交  
export async function rejectToolSubmission(toolId: string) {
  return await reviewToolSubmission(toolId, 'rejected')
}

// ==================== 工具管理 API 调用 ====================

// 辅助函数 - 调用 admin-actions API
async function callAdminAction(action: string, data?: Record<string, unknown>) {
  const accessToken = await ensureAccessToken()
  if (!accessToken) throw new Error('用户未登录')

  const response = await fetch('/api/admin-actions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action, ...data })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || '操作失败')
  }

  return response.json()
}

// 新增工具 - 通过 API 调用
export async function createTool(tool: {
  name: string
  tagline?: string
  description?: string
  website_url: string
  logo_url?: string
  categories?: string[]
  features?: string[]
  pricing?: 'Free' | 'Freemium' | 'Paid' | 'Trial'
  featured?: boolean
}) {
  try {
    return await callAdminAction('create_tool', { tool })
  } catch (error) {
    console.error('❌ 创建工具失败:', error)
    throw error
  }
}

// 实现管理员函数 - 调用Vercel Functions
export async function getUsers(page = 1, limit = 20) {
  try {
    // 获取管理员用户信息
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (adminError && !adminError.message.includes('does not exist')) {
      console.error('获取管理员用户失败:', adminError)
    }
    
    const users = []
    
    // 添加管理员用户信息
    if (adminUsers && adminUsers.length > 0) {
      for (const admin of adminUsers) {
        users.push({
          id: admin.user_id,
          email: admin.email || `用户-${admin.user_id.slice(0, 8)}`,
          role: admin.role,
          type: 'admin',
          created_at: admin.created_at,
          last_login: admin.last_login,
          is_active: true
        })
      }
    }
    
    // 如果没有管理员用户，添加当前用户作为示例
    if (users.length === 0) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        users.push({
          id: session.user.id,
          email: session.user.email || '当前管理员',
          role: 'admin',
          type: 'current',
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
          is_active: true
        })
      }
    }
    
    console.log(`✅ 获取到 ${users.length} 个用户记录`)
    return users.slice((page - 1) * limit, page * limit)
    
  } catch (error) {
    console.error('获取用户列表失败:', error)
    return []
  }
}

export async function getToolsAdmin(page = 1, limit = 20) {
  try {
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('获取工具列表失败:', error)
    return []
  }
}

export async function getAdminLogs(page = 1, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('admin_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)
    
    if (error) {
      // 如果admin_logs表不存在，创建一些模拟日志数据
      console.warn('admin_logs表不存在，返回模拟数据:', error.message)
      return [
        {
          id: '1',
          action: '管理员登录',
          timestamp: new Date().toISOString(),
          admin_id: 'system',
          details: '系统初始化日志'
        }
      ]
    }
    
    return data || []
  } catch (error) {
    console.error('获取管理员日志失败:', error)
    return []
  }
}

export async function getCategories() {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('获取分类列表失败:', error)
    // 如果分类表不存在，返回空数组而不是错误
    return []
  }
}

// 其他暂时禁用的管理函数
const createUnavailableFunction = (functionName: string) => {
  return () => {
    throw new Error(`${functionName} 功能暂时不可用，请联系管理员`)
  }
}

export const approveToolSubmissionDirect = createUnavailableFunction('工具直接审批')
export const rejectToolSubmissionDirect = createUnavailableFunction('工具直接拒绝')
export const getToolsMetrics = createUnavailableFunction('获取工具指标')
export const getCategoriesMetrics = createUnavailableFunction('获取分类指标')

// 更新工具 - 通过 API 调用
export async function updateTool(toolId: string, updates: Partial<Tool>) {
  try {
    return await callAdminAction('update_tool', { id: toolId, updates })
  } catch (error) {
    console.error('❌ 更新工具失败:', error)
    throw error
  }
}

// 删除单个工具 - 通过 API 调用
export async function deleteTool(toolId: string) {
  try {
    return await callAdminAction('delete_tool', { id: toolId })
  } catch (error) {
    console.error('❌ 删除工具失败:', error)
    throw error
  }
}
// ==================== 分类管理 API 调用 ====================

// 创建分类 - 通过 API 调用
export async function createCategory(category: {
  name: string
  slug?: string
  description?: string
  color?: string
  icon?: string
  parent_id?: string
  sort_order?: number
  is_active?: boolean
}) {
  try {
    return await callAdminAction('create_category', { category })
  } catch (error) {
    console.error('❌ 创建分类失败:', error)
    throw error
  }
}

// 更新分类 - 通过 API 调用
export async function updateCategory(id: string, updates: Partial<{
  name: string
  slug: string
  description: string
  color: string
  icon: string
  parent_id: string
  sort_order: number
  is_active: boolean
}>) {
  try {
    return await callAdminAction('update_category', { id, updates })
  } catch (error) {
    console.error('❌ 更新分类失败:', error)
    throw error
  }
}

// 删除分类 - 通过 API 调用
export async function deleteCategory(id: string) {
  try {
    return await callAdminAction('delete_category', { id })
  } catch (error) {
    console.error('❌ 删除分类失败:', error)
    throw error
  }
}
export const createToolByAPI = createUnavailableFunction('通过API创建工具')

// ==================== 用户管理功能 ====================

// 用户信息接口
export interface UserInfo {
  id: string
  email: string
  role?: string
  is_active?: boolean
  created_at: string
  last_login?: string
}

// 禁用/启用用户
export async function toggleUserStatus(userId: string, isActive: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('admin_users')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (error) {
      // 如果表没有 is_active 字段，可能是表结构问题
      if (error.message.includes('column') || error.code === '42703') {
        console.warn('⚠️ admin_users表缺少is_active字段，请更新表结构')
        throw new Error('用户状态管理功能需要更新数据库表结构')
      }
      throw error
    }

    console.log(`✅ 用户${isActive ? '启用' : '禁用'}成功:`, userId)
  } catch (error) {
    console.error('❌ 更新用户状态失败:', error)
    throw error
  }
}

// 更新用户角色
export async function updateUserRole(userId: string, role: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('admin_users')
      .update({
        role,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (error) throw error

    console.log(`✅ 用户角色更新成功:`, userId, '->', role)
  } catch (error) {
    console.error('❌ 更新用户角色失败:', error)
    throw error
  }
}

// 删除用户（从admin_users表移除）
export async function deleteUser(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('admin_users')
      .delete()
      .eq('user_id', userId)

    if (error) throw error

    console.log('✅ 用户删除成功:', userId)
  } catch (error) {
    console.error('❌ 删除用户失败:', error)
    throw error
  }
}

// 获取用户详细信息
export async function getUserDetails(userId: string): Promise<UserInfo | null> {
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // 用户不存在
        return null
      }
      throw error
    }

    return {
      id: data.user_id,
      email: data.email || '',
      role: data.role,
      is_active: data.is_active ?? true,
      created_at: data.created_at,
      last_login: data.last_login
    }
  } catch (error) {
    console.error('❌ 获取用户详情失败:', error)
    return null
  }
}

// 批量删除工具 - 通过 API 调用
export async function batchDeleteTools(toolIds: string[]): Promise<{ success: number; failed: number }> {
  try {
    const result = await callAdminAction('batch_delete_tools', { toolIds })
    console.log(`✅ 批量删除完成: ${result.deleted} 个工具`)
    return { success: result.deleted || 0, failed: 0 }
  } catch (error) {
    console.error('❌ 批量删除失败:', error)
    // 如果 API 调用失败，回退到逐个删除
    let success = 0
    let failed = 0

    for (const toolId of toolIds) {
      try {
        await deleteTool(toolId)
        success++
      } catch (err) {
        console.error(`❌ 删除工具失败 (${toolId}):`, err)
        failed++
      }
    }

    return { success, failed }
  }
}

// 批量审核提交
export async function batchReviewSubmissions(
  submissionIds: string[],
  status: 'approved' | 'rejected'
): Promise<{ success: number; failed: number }> {
  let successCount = 0
  let failedCount = 0

  for (const submissionId of submissionIds) {
    try {
      await reviewToolSubmission(submissionId, status)
      successCount++
    } catch (error) {
      console.error(`❌ 审核提交失败 (${submissionId}):`, error)
      failedCount++
    }
  }

  console.log(`✅ 批量审核完成: 成功${successCount}个, 失败${failedCount}个`)
  return { success: successCount, failed: failedCount }
}

// 更新工具状态（草稿/发布/下线）
export async function updateToolStatus(
  toolId: string,
  status: 'draft' | 'published' | 'archived'
): Promise<void> {
  try {
    const { error } = await supabase
      .from('tools')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', toolId)

    if (error) throw error

    console.log(`✅ 工具状态更新成功:`, toolId, '->', status)
  } catch (error) {
    console.error('❌ 更新工具状态失败:', error)
    throw error
  }
}

// 导出工具列表为CSV
export async function exportToolsToCSV(): Promise<string> {
  try {
    const { data: tools, error } = await supabase
      .from('tools')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error

    // CSV头部
    const headers = ['ID', '名称', '标语', '分类', '定价', '状态', '精选', '浏览量', '点赞数', '评分', '添加日期']
    const csvRows = [headers.join(',')]

    // CSV数据行
    for (const tool of tools || []) {
      const row = [
        tool.id,
        `"${(tool.name || '').replace(/"/g, '""')}"`,
        `"${(tool.tagline || '').replace(/"/g, '""')}"`,
        `"${(tool.categories || []).join('; ')}"`,
        tool.pricing || 'Free',
        tool.status || 'published',
        tool.featured ? '是' : '否',
        tool.views || 0,
        tool.upvotes || 0,
        tool.rating || 0,
        tool.date_added || ''
      ]
      csvRows.push(row.join(','))
    }

    return csvRows.join('\n')
  } catch (error) {
    console.error('❌ 导出工具列表失败:', error)
    throw error
  }
}

// 导出用户列表为CSV
export async function exportUsersToCSV(): Promise<string> {
  try {
    const users = await getUsers(1, 1000)

    // CSV头部
    const headers = ['ID', '邮箱', '角色', '类型', '创建时间', '最后登录']
    const csvRows = [headers.join(',')]

    // CSV数据行
    for (const user of users) {
      const row = [
        user.id,
        `"${user.email || ''}"`,
        user.role || 'user',
        user.type || 'user',
        user.created_at || '',
        user.last_login || ''
      ]
      csvRows.push(row.join(','))
    }

    return csvRows.join('\n')
  } catch (error) {
    console.error('❌ 导出用户列表失败:', error)
    throw error
  }
}

// ==================== Logo 刷新功能 ====================

/**
 * 刷新单个工具的 Logo
 * 从网站自动提取最新图标
 */
export async function refreshToolLogo(toolId: string, websiteUrl?: string): Promise<{ success: boolean; logoUrl?: string; error?: string }> {
  try {
    console.log('🔄 开始刷新工具 Logo:', toolId, websiteUrl)

    // 使用 admin-actions API（需要管理员权限）
    const accessToken = await ensureAccessToken()
    if (!accessToken) {
      return { success: false, error: '用户未登录' }
    }

    const response = await fetch('/api/admin-actions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'refresh_tool_logo',
        toolId
      })
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || '提取失败' }
    }

    const data = await response.json()
    console.log('✅ Logo 刷新成功:', data.logo_url)

    return {
      success: true,
      logoUrl: data.logo_url
    }
  } catch (error) {
    console.error('❌ 刷新工具 Logo 失败:', error)
    return {
      success: false,
      error: (error as Error).message
    }
  }
}

/**
 * 生成/刷新工具官网截图（存入 Supabase Storage）
 */
export async function refreshToolScreenshots(toolId: string): Promise<{ success: boolean; screenshots?: string[]; error?: string }> {
  try {
    console.log('🖼️ 开始生成工具截图:', toolId)

    const accessToken = await ensureAccessToken()
    if (!accessToken) {
      return { success: false, error: '用户未登录' }
    }

    const response = await fetch('/api/admin-actions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'refresh_tool_screenshots',
        toolId
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return { success: false, error: error.error || '生成失败' }
    }

    const data = await response.json()
    return { success: true, screenshots: data.screenshots || [] }
  } catch (error) {
    console.error('❌ 生成工具截图失败:', error)
    return { success: false, error: (error as Error).message }
  }
}

/**
 * 批量刷新工具 Logo
 * 支持选择特定工具或刷新所有缺失 logo 的工具
 */
export async function batchRefreshToolLogos(toolIds?: string[]): Promise<{ success: number; failed: number; results: Array<{ toolId: string; logoUrl?: string; error?: string }> }> {
  try {
    console.log('🔄 开始批量刷新 Logo...')

    // 使用 logo-extract API
    const accessToken = await ensureAccessToken()
    if (!accessToken) {
      return { success: 0, failed: 0, results: [] }
    }

    const response = await fetch('/api/logo-extract', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'extract_batch',
        toolIds: toolIds || []
      })
    })

    if (!response.ok) {
      throw new Error(`API 调用失败: ${response.status}`)
    }

    const data = await response.json()
    console.log(`✅ 批量刷新完成: ${data.updated} 个成功`)

    return {
      success: data.updated || 0,
      failed: (data.total || 0) - (data.updated || 0),
      results: data.results || []
    }
  } catch (error) {
    console.error('❌ 批量刷新 Logo 失败:', error)
    return { success: 0, failed: 0, results: [] }
  }
}

/**
 * 仅提取 Logo URL，不更新数据库
 * 用于预览或用户提交页面
 */
export async function extractLogoForPreview(websiteUrl: string): Promise<string | null> {
  try {
    console.log('🔍 预览提取 Logo:', websiteUrl)

    const response = await fetch('/api/logo-extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'extract_from_url',
        websiteUrl
      })
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.logoUrl || null
  } catch (error) {
    console.error('❌ 预览提取 Logo 失败:', error)
    return null
  }
}
