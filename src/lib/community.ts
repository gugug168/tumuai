import { supabase } from './supabase'

export interface ToolFavorite {
  id: string
  user_id: string
  tool_id: string
  created_at: string
}

export interface ToolReview {
  id: string
  user_id: string
  tool_id: string
  rating: number
  title?: string
  content?: string
  helpful_count: number
  created_at: string
  updated_at: string
  user_profiles?: {
    username?: string
    full_name?: string
    avatar_url?: string
  }
}

export interface ToolComment {
  id: string
  user_id: string
  tool_id: string
  parent_id?: string
  content: string
  likes_count: number
  created_at: string
  updated_at: string
  user_profiles?: {
    username?: string
    full_name?: string
    avatar_url?: string
  }
  replies?: ToolComment[]
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

// 收藏工具
export async function addToFavorites(toolId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('用户未登录')

  // 检查是否已经收藏
  const { data: existing } = await supabase
    .from('user_favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('tool_id', toolId)
    .single()

  if (existing) {
    throw new Error('已经收藏过此工具')
  }
  const { data, error } = await supabase
    .from('user_favorites')
    .insert([{
      user_id: user.id,
      tool_id: toolId
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

// 取消收藏
export async function removeFromFavorites(toolId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('用户未登录')

  const { error } = await supabase
    .from('user_favorites')
    .delete()
    .eq('user_id', user.id)
    .eq('tool_id', toolId)

  if (error) throw error
}

// 检查是否已收藏
export async function isFavorited(toolId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('user_favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('tool_id', toolId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return !!data
}

// 获取用户收藏的工具
export async function getUserFavorites(userId?: string) {
  const { data: sessionRes } = await supabase.auth.getSession()
  const accessToken = sessionRes?.session?.access_token
  const user = sessionRes?.session?.user
  const targetUserId = userId || user?.id
  if (!targetUserId) throw new Error('用户未登录')

  try {
    // 走服务端函数，提升稳定性与速度
    if (accessToken) {
      const json = await fetchJSONWithTimeout('/.netlify/functions/user-favorites', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
        timeoutMs: 8000
      }).catch(() => null as any)
      if (json) return json
    }
  } catch (e) {
    // 忽略，回退到直连
  }

  const { data, error } = await supabase
    .from('user_favorites')
    .select(`
      *,
      tools (
        id,
        name,
        tagline,
        logo_url,
        categories,
        rating,
        pricing
      )
    `)
    .eq('user_id', targetUserId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// 添加工具评价
export async function addToolReview(toolId: string, review: {
  rating: number
  title?: string
  content?: string
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('tool_reviews')
    .insert([{
      user_id: user.id,
      tool_id: toolId,
      ...review
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

// 获取工具评价
export async function getToolReviews(toolId: string) {
  const { data, error } = await supabase
    .from('tool_reviews')
    .select(`
      *,
      user_profiles (
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('tool_id', toolId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as ToolReview[]
}

// 添加工具评论
export async function addToolComment(toolId: string, content: string, parentId?: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('用户未登录')

  const { data, error } = await supabase
    .from('tool_comments')
    .insert([{
      user_id: user.id,
      tool_id: toolId,
      content,
      parent_id: parentId
    }])
    .select(`
      *,
      user_profiles (
        username,
        full_name,
        avatar_url
      )
    `)
    .single()

  if (error) throw error
  return data
}

// 获取工具评论
export async function getToolComments(toolId: string) {
  const { data, error } = await supabase
    .from('tool_comments')
    .select(`
      *,
      user_profiles (
        username,
        full_name,
        avatar_url
      )
    `)
    .eq('tool_id', toolId)
    .is('parent_id', null)
    .order('created_at', { ascending: false })

  if (error) throw error

  // 获取回复
  const comments = data as ToolComment[]
  for (const comment of comments) {
    const { data: replies } = await supabase
      .from('tool_comments')
      .select(`
        *,
        user_profiles (
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('parent_id', comment.id)
      .order('created_at', { ascending: true })

    comment.replies = replies as ToolComment[]
  }

  return comments
}

// 点赞评论
export async function likeComment(commentId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('用户未登录')

  // 检查是否已点赞
  const { data: existingLike } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('comment_id', commentId)
    .single()

  if (existingLike) {
    // 取消点赞
    await supabase
      .from('comment_likes')
      .delete()
      .eq('user_id', user.id)
      .eq('comment_id', commentId)

    // 减少点赞数
    await supabase
      .from('tool_comments')
      .update({ likes_count: supabase.sql`likes_count - 1` })
      .eq('id', commentId)
  } else {
    // 添加点赞
    await supabase
      .from('comment_likes')
      .insert([{
        user_id: user.id,
        comment_id: commentId
      }])

    // 增加点赞数
    await supabase
      .from('tool_comments')
      .update({ likes_count: supabase.sql`likes_count + 1` })
      .eq('id', commentId)
  }
}

// 获取工具统计信息
export async function getToolStats(toolId: string) {
  // 获取收藏数
  const { count: favoritesCount } = await supabase
    .from('user_favorites')
    .select('*', { count: 'exact', head: true })
    .eq('tool_id', toolId)

  // 获取评价统计
  const { data: reviews } = await supabase
    .from('tool_reviews')
    .select('rating')
    .eq('tool_id', toolId)

  const reviewCount = reviews?.length || 0
  const averageRating = reviewCount > 0 
    ? reviews!.reduce((sum, r) => sum + r.rating, 0) / reviewCount 
    : 0

  // 获取评论数
  const { count: commentsCount } = await supabase
    .from('tool_comments')
    .select('*', { count: 'exact', head: true })
    .eq('tool_id', toolId)

  return {
    favoritesCount: favoritesCount || 0,
    reviewCount,
    averageRating: Math.round(averageRating * 10) / 10,
    commentsCount: commentsCount || 0
  }
}