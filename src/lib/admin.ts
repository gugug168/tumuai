import { supabase } from './supabase'

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

// 检查用户是否为管理员 - 保持原有实现
export async function checkAdminStatus(): Promise<AdminUser | null> {
  const { data: userRes } = await supabase.auth.getUser()
  const userId = userRes?.user?.id || null
  console.log('🔍 检查用户登录状态:', userRes?.user?.email)

  const token = await ensureAccessToken()
  if (!token) {
    console.log('❌ 未获取到 token')
    return null
  }

  try {
    // 简化管理员权限检查 - 直接使用Supabase客户端而不依赖Netlify Functions
    const adminEmails = ['admin@civilaihub.com', 'admin@tumuai.net', '307714007@qq.com']
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user || !adminEmails.includes(user.email || '')) {
      console.log('❌ 非管理员用户:', user?.email)
      return null
    }
    
    console.log('✅ 管理员权限验证成功:', user.email)
    return {
      user_id: user.id,
      email: user.email,
      role: 'admin',
      is_super_admin: user.email === '307714007@qq.com'
    } as AdminUser
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

// 其他管理函数 - 暂时禁用，抛出友好错误信息
const createUnavailableFunction = (functionName: string) => {
  return () => {
    throw new Error(`${functionName} 功能暂时不可用，请联系管理员`)
  }
}

export const approveToolSubmissionDirect = createUnavailableFunction('工具直接审批')
export const rejectToolSubmissionDirect = createUnavailableFunction('工具直接拒绝')
export const getUsers = createUnavailableFunction('获取用户列表')
export const getToolsMetrics = createUnavailableFunction('获取工具指标')
export const getCategoriesMetrics = createUnavailableFunction('获取分类指标') 
export const deleteTool = createUnavailableFunction('删除工具')
export const updateTool = createUnavailableFunction('更新工具')
export const addCategory = createUnavailableFunction('添加分类')
export const createCategory = createUnavailableFunction('创建分类')
export const updateCategory = createUnavailableFunction('更新分类')
export const deleteCategory = createUnavailableFunction('删除分类')
export const createToolByAPI = createUnavailableFunction('通过API创建工具')
export const getToolsAdmin = createUnavailableFunction('获取管理员工具')
export const getAdminLogs = createUnavailableFunction('获取管理员日志')
export const getCategories = createUnavailableFunction('获取分类列表')
