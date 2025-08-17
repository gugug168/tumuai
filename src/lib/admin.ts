import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

export interface AdminUser {
  id: string
  user_id: string
  role: 'super_admin' | 'admin' | 'moderator'
  permissions: Record<string, boolean>
  created_at: string
  updated_at: string
}

export interface AdminLog {
  id: string
  admin_id: string
  action: string
  target_type: string
  target_id?: string
  details: Record<string, any>
  ip_address?: string
  user_agent?: string
  created_at: string
}

export interface ToolSubmission {
  id: string
  submitter_email?: string
  tool_name: string
  tagline: string
  description?: string
  website_url: string
  logo_url?: string
  categories: string[]
  features: string[]
  pricing: 'Free' | 'Freemium' | 'Paid' | 'Trial'
  status: 'pending' | 'approved' | 'rejected'
  admin_notes?: string
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
  updated_at: string
}

// 通用：带超时的 JSON 请求
async function fetchJSONWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs = 8000, ...rest } = options
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, { ...rest, signal: controller.signal })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return await resp.json()
  } finally {
    clearTimeout(id)
  }
}

// 等待获取可用的 Access Token（解决页面初始时会话尚未恢复导致的 No session/空数据）
async function ensureAccessToken(timeoutMs = 6000): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { data: sessionRes } = await supabase.auth.getSession()
    const token = sessionRes?.session?.access_token
    if (token) return token
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error('No session')
}

// 检查用户是否为管理员
export async function checkAdminStatus(): Promise<AdminUser | null> {
  const { data: sessionRes } = await supabase.auth.getSession()
  const accessToken = sessionRes?.session?.access_token
  const user = sessionRes?.session?.user
  console.log('🔍 检查用户登录状态:', user?.email)

  if (!user || !accessToken) {
    console.log('❌ 用户未登录')
    return null
  }

  try {
    // 优先通过服务端函数校验管理员，避免前端RLS/网络问题
    const json = await fetchJSONWithTimeout('/.netlify/functions/admin-check', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      timeoutMs: 8000
    }).catch(() => null as any)
    if (json && json.user_id === user.id) return json as AdminUser

    // 兜底：直接查询（要求 admin_users 有自读策略）
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('❌ 查询管理员权限失败:', error)
        throw error
      }
      return null
    }
    return data as AdminUser
  } catch (error) {
    console.error('❌ 管理员权限检查异常:', error)
    return null
  }
}

// 记录管理员操作
export async function logAdminAction(
  action: string,
  targetType: string,
  targetId?: string,
  details?: Record<string, any>
) {
  const admin = await checkAdminStatus()
  if (!admin) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('admin_logs')
    .insert([{
      admin_id: admin.id,
      action,
      target_type: targetType,
      target_id: targetId,
      details: details || {}
    }])

  if (error) throw error
}

// 获取系统统计数据
export async function getSystemStats() {
  try {
    const token = await ensureAccessToken()
    const json = await fetchJSONWithTimeout('/.netlify/functions/admin-stats', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      timeoutMs: 8000
    })
    return json
  } catch (error) {
    console.error('❌ 获取统计数据异常:', error)
    return { totalTools: 0, totalUsers: 0, pendingSubmissions: 0, totalReviews: 0, totalFavorites: 0 }
  }
}

// 获取工具提交列表
export async function getToolSubmissions(status?: string) {
  try {
    const token = await ensureAccessToken()
    const json = await fetchJSONWithTimeout('/.netlify/functions/admin-datasets', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      timeoutMs: 8000
    }).catch(() => null as any)
    const list = json?.submissions || []
    return status ? list.filter((it: any) => it.status === status) : list
  } catch (error) {
    console.error('❌ 获取工具提交异常:', error)
    return []
  }
}

// 审核工具提交
export async function reviewToolSubmission(
  submissionId: string,
  status: 'approved' | 'rejected',
  adminNotes?: string
) {
  const admin = await checkAdminStatus()
  if (!admin) throw new Error('Unauthorized')

  const { data: submission, error: fetchError } = await supabase
    .from('tool_submissions')
    .select('*')
    .eq('id', submissionId)
    .single()

  if (fetchError) throw fetchError

  // 更新提交状态
  const { error: updateError } = await supabase
    .from('tool_submissions')
    .update({
      status,
      admin_notes: adminNotes,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', submissionId)

  if (updateError) throw updateError

  // 如果批准，创建工具记录
  if (status === 'approved') {
    const { error: insertError } = await supabase
      .from('tools')
      .insert([{
        name: submission.tool_name,
        tagline: submission.tagline,
        description: submission.description,
        website_url: submission.website_url,
        logo_url: submission.logo_url,
        categories: submission.categories,
        features: submission.features,
        pricing: submission.pricing,
        featured: false,
        date_added: new Date().toISOString()
      }])

    if (insertError) throw insertError
  }

  // 记录操作日志
  await logAdminAction('review_submission', 'tool_submission', submissionId, {
    status,
    admin_notes: adminNotes
  })
}

// 获取用户列表
export async function getUsers(page = 1, limit = 20) {
  try {
    const token = await ensureAccessToken()
    const json = await fetchJSONWithTimeout('/.netlify/functions/admin-datasets', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      timeoutMs: 8000
    }).catch(() => null as any)
    const list = json?.users || []
    const start = (page - 1) * limit
    return list.slice(start, start + limit)
  } catch (error) {
    console.error('❌ 获取用户列表异常:', error)
    return []
  }
}

// 获取工具列表（管理员视图）
export async function getToolsAdmin(page = 1, limit = 20) {
  try {
    const token = await ensureAccessToken()
    const json = await fetchJSONWithTimeout('/.netlify/functions/admin-datasets', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      timeoutMs: 8000
    }).catch(() => null as any)
    const list = json?.tools || []
    const start = (page - 1) * limit
    return list.slice(start, start + limit)
  } catch (error) {
    console.error('❌ 获取工具列表异常:', error)
    return []
  }
}

// 更新工具信息
export async function updateTool(toolId: string, updates: Partial<any>) {
  const admin = await checkAdminStatus()
  if (!admin) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('tools')
    .update(updates)
    .eq('id', toolId)

  if (error) throw error

  await logAdminAction('update_tool', 'tool', toolId, updates)
}

// 删除工具
export async function deleteTool(toolId: string) {
  const admin = await checkAdminStatus()
  if (!admin) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('tools')
    .delete()
    .eq('id', toolId)

  if (error) throw error

  await logAdminAction('delete_tool', 'tool', toolId)
}

// 获取管理员日志
export async function getAdminLogs(page = 1, limit = 50) {
  try {
    const token = await ensureAccessToken()
    const json = await fetchJSONWithTimeout('/.netlify/functions/admin-datasets', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      timeoutMs: 8000
    }).catch(() => null as any)
    const list = json?.logs || []
    const start = (page - 1) * limit
    return list.slice(start, start + limit)
  } catch (error) {
    console.error('❌ 管理员日志异常:', error)
    return []
  }
}