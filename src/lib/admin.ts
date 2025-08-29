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
    
    // 统一使用 Vercel API 路径
    const apiPath = '/api/admin-auth-check'
    
    try {
      console.log(`🔗 尝试调用API: ${apiPath}`)
      
      const response = await fetch(apiPath, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      console.log(`📡 API响应状态: ${response.status}, Content-Type: ${response.headers.get('content-type')}`)
      
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json()
        
        if (data.isAdmin) {
          console.log('✅ 服务端管理员权限验证成功:', data.user.email)
          
          return {
            user_id: data.user.user_id,
            email: data.user.email,
            role: data.user.role,
            is_super_admin: data.user.is_super_admin,
            permissions: data.user.permissions
          } as AdminUser & { permissions?: any }
        }
      } else {
        // 如果返回的是HTML，说明API路由有问题
        const responseText = await response.text()
        console.log(`⚠️ API返回非JSON响应 (${response.status}):`, responseText.substring(0, 200))
      }
    } catch (apiError) {
      console.log('⚠️ 服务端API调用异常:', apiError instanceof Error ? apiError.message : apiError)
    }
    
    // 兜底方案：使用客户端直接查询数据库
    console.log('🔄 使用客户端验证管理员权限...')
    
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id, user_id, role, permissions, created_at, updated_at')
      .eq('user_id', session.user.id)
      .single()
    
    if (adminError || !adminUser) {
      console.log('❌ 客户端验证：用户不是管理员')
      return null
    }
    
    console.log('✅ 客户端管理员权限验证成功:', session.user.email)
    
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
        status: 'published',  // 修复：使用数据库允许的状态值
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
