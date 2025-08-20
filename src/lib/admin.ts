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

async function postJSONWithTimeout(
  url: string,
  body: any,
  options: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs = 12000, headers, ...rest } = options
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let attempt = 0
    let lastErr: any
    while (attempt < 3) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(headers || {}) },
          body: JSON.stringify(body ?? {}),
          signal: controller.signal,
          cache: 'no-store',
          ...rest
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const text = await resp.text()
        try { return text ? JSON.parse(text) : null } catch { return null }
      } catch (e) {
        lastErr = e
        attempt += 1
        await new Promise(r => setTimeout(r, 300 * attempt))
      }
    }
    throw lastErr
  } finally {
    clearTimeout(id)
  }
}

// 等待获取可用的 Access Token（解决页面初始时会话尚未恢复导致的 No session/空数据）
let accessTokenCache: string | null = null

function readTokenFromLocalStorage(): string | null {
  try {
    const key = Object.keys(localStorage).find(k => k.includes('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.currentSession?.access_token || parsed?.access_token || null
  } catch {
    return null
  }
}

async function ensureAccessToken(timeoutMs = 3000): Promise<string> {
  // 0) 先看缓存，避免并发重复等待
  if (accessTokenCache) return accessTokenCache

  // 1) LocalStorage 命中最快
  const lsFirst = readTokenFromLocalStorage()
  if (lsFirst) {
    accessTokenCache = lsFirst
    return lsFirst
  }

  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    // 2) 读 supabase 会话
    const { data: sessionRes } = await supabase.auth.getSession()
    const token = sessionRes?.session?.access_token
    if (token) {
      accessTokenCache = token
      return token
    }

    // 3) 再尝试 LocalStorage（会话可能刚刚写入）
    const lsToken = readTokenFromLocalStorage()
    if (lsToken) {
      accessTokenCache = lsToken
      return lsToken
    }

    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error('No session')
}

// 检查用户是否为管理员
export async function checkAdminStatus(): Promise<AdminUser | null> {
  // 容忍会话尚未完全恢复，优先拿 token，再获取用户
  const token = await ensureAccessToken().catch(() => null)
  const { data: userRes } = await supabase.auth.getUser()
  const userId = userRes?.user?.id || null
  console.log('🔍 检查用户登录状态:', userRes?.user?.email)

  if (!token) {
    console.log('❌ 未获取到 token')
    return null
  }

  try {
    // 优先通过服务端函数校验管理员
    const json = await fetchJSONWithTimeout('/.netlify/functions/admin-check', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      timeoutMs: 8000
    }).catch(() => null as any)
    if (json) {
      // 如本地拿不到 userId，也直接信任服务端返回
      if (!userId || json.user_id === userId) return json as AdminUser
    }

    if (!userId) return null

    // 兜底：直接查询（要求 admin_users 有自读策略）
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
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
  const token = await ensureAccessToken()
  await postJSONWithTimeout('/.netlify/functions/admin-actions', {
    action: 'review_submission',
    submissionId,
    status,
    adminNotes
  }, {
    headers: { Authorization: `Bearer ${token}` },
    timeoutMs: 8000
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
  const token = await ensureAccessToken()
  await postJSONWithTimeout('/.netlify/functions/admin-actions', {
    action: 'update_tool',
    id: toolId,
    updates
  }, {
    headers: { Authorization: `Bearer ${token}` }
  })
}

// 删除工具
export async function deleteTool(toolId: string) {
  const token = await ensureAccessToken()
  await postJSONWithTimeout('/.netlify/functions/admin-actions', {
    action: 'delete_tool',
    id: toolId
  }, {
    headers: { Authorization: `Bearer ${token}` }
  })
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

// 获取分类列表
export async function getCategories() {
  try {
    const token = await ensureAccessToken()
    const json = await postJSONWithTimeout('/.netlify/functions/admin-actions', {
      action: 'get_categories'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return json?.categories || []
  } catch (error) {
    console.error('❌ 获取分类异常:', error)
    return []
  }
}

// 创建分类
export async function createCategory(category: {
  name: string
  slug: string
  description?: string
  color?: string
  icon?: string
  parent_id?: string
  sort_order?: number
  is_active?: boolean
}) {
  const token = await ensureAccessToken()
  return await postJSONWithTimeout('/.netlify/functions/admin-actions', {
    action: 'create_category',
    category
  }, {
    headers: { Authorization: `Bearer ${token}` }
  })
}

// 更新分类
export async function updateCategory(id: string, updates: Partial<any>) {
  const token = await ensureAccessToken()
  return await postJSONWithTimeout('/.netlify/functions/admin-actions', {
    action: 'update_category',
    id,
    updates
  }, {
    headers: { Authorization: `Bearer ${token}` }
  })
}

// 删除分类
export async function deleteCategory(id: string) {
  const token = await ensureAccessToken()
  return await postJSONWithTimeout('/.netlify/functions/admin-actions', {
    action: 'delete_category',
    id
  }, {
    headers: { Authorization: `Bearer ${token}` }
  })
}

// 新增工具
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
  const token = await ensureAccessToken()
  return await postJSONWithTimeout('/.netlify/functions/admin-actions', {
    action: 'create_tool',
    tool
  }, {
    headers: { Authorization: `Bearer ${token}` }
  })
}