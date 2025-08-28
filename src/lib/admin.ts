import { supabase } from './supabase'
import { ADMIN_CONFIG } from './config'

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

// 检查用户是否为管理员 - 使用服务端验证
export async function checkAdminStatus(): Promise<AdminUser | null> {
  try {
    console.log('🔍 开始检查管理员权限...')
    
    // 获取当前用户会话
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      console.log('❌ 无效的用户会话:', sessionError?.message || '会话不存在')
      return null
    }
    
    // 调用服务端权限验证API - 支持多种部署环境
    const apiPath = window.location.hostname.includes('vercel.app') 
      ? '/api/admin-auth-check'
      : '/.netlify/functions/admin-auth-check'
      
    const response = await fetch(apiPath, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      console.log('❌ 服务端权限验证失败:', errorData.error)
      return null
    }
    
    const data = await response.json()
    
    if (!data.isAdmin) {
      console.log('❌ 用户不是管理员')
      return null
    }
    
    console.log('✅ 管理员权限验证成功:', data.user.email)
    
    return {
      user_id: data.user.user_id,
      email: data.user.email,
      role: data.user.role,
      is_super_admin: data.user.is_super_admin,
      permissions: data.user.permissions
    } as AdminUser & { permissions?: any }
    
  } catch (error) {
    console.error('❌ 管理员权限检查异常:', error)
    return null
  }
}

// 获取系统统计数据 - 保持原有实现
export async function getSystemStats() {
  try {
    const [toolsCount, publishedCount, pendingCount] = await Promise.all([
      supabase.from('tools').select('id', { count: 'exact', head: true }),
      supabase.from('tools').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('tools').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    ])
    
    return {
      totalTools: toolsCount.count || 0,
      publishedTools: publishedCount.count || 0, 
      pendingTools: pendingCount.count || 0,
      categories: 6
    }
  } catch (error) {
    console.error('❌ 获取统计数据异常:', error)
    return { 
      totalTools: 0, 
      publishedTools: 0, 
      pendingTools: 0, 
      categories: 6
    }
  }
}

// 获取工具提交列表 - 保持原有实现
export async function getToolSubmissions(status?: string) {
  try {
    let query = supabase
      .from('tools')
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

// 审核工具提交 - 保持原有实现
export async function reviewToolSubmission(
  submissionId: string,
  status: 'approved' | 'rejected',
  adminNotes?: string
) {
  try {
    const newStatus = status === 'approved' ? 'published' : 'rejected'
    const { error } = await supabase
      .from('tools')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', submissionId)
    
    if (error) throw error
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

// 新增工具 - 保持原有实现
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
    const { data, error } = await supabase
      .from('tools')
      .insert([{
        ...tool,
        status: 'pending',
        views: 0,
        upvotes: 0,
        rating: 0,
        review_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        date_added: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('❌ 创建工具失败:', error)
    throw error
  }
}

// 批量删除工具 - 简化版本
export async function deleteTools(toolIds: string[]) {
  const { error } = await supabase
    .from('tools')
    .delete()
    .in('id', toolIds)
  
  if (error) throw error
}

// 实现管理员函数 - 调用Vercel Functions
export async function getUsers(page = 1, limit = 20) {
  try {
    const response = await fetch('/api/admin-datasets', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await ensureAccessToken()}`
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return data.users || []
  } catch (error) {
    console.error('获取用户列表失败:', error)
    return []
  }
}

export async function getToolsAdmin(page = 1, limit = 20) {
  try {
    const response = await fetch('/api/admin-tools-crud', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await ensureAccessToken()}`
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return data.tools || []
  } catch (error) {
    console.error('获取工具列表失败:', error)
    return []
  }
}

export async function getAdminLogs(page = 1, limit = 50) {
  try {
    const response = await fetch('/api/admin-datasets?type=logs', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await ensureAccessToken()}`
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return data.logs || []
  } catch (error) {
    console.error('获取管理员日志失败:', error)
    return []
  }
}

export async function getCategories() {
  try {
    const response = await fetch('/api/admin-categories', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await ensureAccessToken()}`
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error('获取分类列表失败:', error)
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
// 更新工具
export async function updateTool(toolId: string, updates: Partial<Tool>) {
  try {
    const { data, error } = await supabase
      .from('tools')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', toolId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('❌ 更新工具失败:', error)
    throw error
  }
}

// 删除单个工具
export async function deleteTool(toolId: string) {
  try {
    const { error } = await supabase
      .from('tools')
      .delete()
      .eq('id', toolId)

    if (error) throw error
  } catch (error) {
    console.error('❌ 删除工具失败:', error)
    throw error
  }
}
// 创建分类
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
    const { data, error } = await supabase
      .from('categories')
      .insert([{
        ...category,
        slug: category.slug || category.name.toLowerCase().replace(/\s+/g, '-'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('❌ 创建分类失败:', error)
    throw error
  }
}

// 更新分类  
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
    const { data, error } = await supabase
      .from('categories')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('❌ 更新分类失败:', error)
    throw error
  }
}

// 删除分类
export async function deleteCategory(id: string) {
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (error) throw error
  } catch (error) {
    console.error('❌ 删除分类失败:', error)
    throw error
  }
}
export const createToolByAPI = createUnavailableFunction('通过API创建工具')
