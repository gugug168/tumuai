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

// 收藏工具
export async function addToFavorites(toolId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('用户未登录')

  try {
    // 检查是否已经收藏
    const { data: existing } = await supabase
      .from('user_favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .maybeSingle() // 使用 maybeSingle 而不是 single

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
  } catch (error) {
    // 如果是"已经收藏"的错误，直接抛出
    if (error instanceof Error && error.message === '已经收藏过此工具') {
      throw error
    }
    console.error('收藏工具失败:', error)
    throw new Error('收藏失败，请重试')
  }
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

// 检查是否已收藏（单个工具）
export async function isFavorited(toolId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  try {
    const { data, error } = await supabase
      .from('user_favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .maybeSingle() // 使用 maybeSingle 而不是 single

    if (error) {
      console.warn('检查收藏状态时出错:', error)
      return false
    }
    return !!data
  } catch (error) {
    console.warn('检查收藏状态失败:', error)
    return false
  }
}

// 批量检查多个工具的收藏状态（性能优化）
export async function batchCheckFavorites(toolIds: string[]): Promise<{[key: string]: boolean}> {
  // 如果没有工具ID，返回空对象
  if (toolIds.length === 0) return {}

  const { data: { user } } = await supabase.auth.getUser()

  // 如果用户未登录，返回所有工具为未收藏状态
  if (!user) {
    const result: {[key: string]: boolean} = {}
    toolIds.forEach(id => result[id] = false)
    return result
  }

  try {
    const { data, error } = await supabase
      .from('user_favorites')
      .select('tool_id')
      .eq('user_id', user.id)
      .in('tool_id', toolIds)

    if (error) {
      // 静默处理错误，返回所有工具为未收藏状态
      const result: {[key: string]: boolean} = {}
      toolIds.forEach(id => result[id] = false)
      return result
    }

    // 构建收藏状态映射表
    const result: {[key: string]: boolean} = {}
    // 初始化所有工具为未收藏
    toolIds.forEach(id => result[id] = false)
    // 标记已收藏的工具
    data?.forEach(item => {
      result[item.tool_id] = true
    })

    return result
  } catch {
    // 静默处理错误，返回所有工具为未收藏状态
    const result: {[key: string]: boolean} = {}
    toolIds.forEach(id => result[id] = false)
    return result
  }
}

// 获取用户收藏的工具
export async function getUserFavorites(userId?: string) {
  const { data: sessionRes } = await supabase.auth.getSession()
  const accessToken = sessionRes?.session?.access_token
  const user = sessionRes?.session?.user
  const targetUserId = userId || user?.id
  if (!targetUserId) throw new Error('用户未登录')

  try {
    // 直接从Supabase查询用户收藏
    if (accessToken && userId) {
      try {
        const { data, error } = await supabase
          .from('user_favorites')
          .select(`
            tool_id,
            tools:tool_id (*)
          `)
          .eq('user_id', userId)
        
        if (error) throw error
        return data?.map(item => item.tools).filter(Boolean) || []
      } catch (error) {
        console.warn('⚠️ 从Supabase获取收藏失败:', error)
      }
    }
  } catch {
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
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('用户未登录')

    // 验证评分范围
    if (review.rating < 1 || review.rating > 5) {
      throw new Error('评分必须在1-5分之间')
    }

    // 验证内容长度
    if (review.content && review.content.length > 2000) {
      throw new Error('评价内容不能超过2000字符')
    }

    if (review.title && review.title.length > 100) {
      throw new Error('评价标题不能超过100字符')
    }

    const { data, error } = await supabase
      .from('tool_reviews')
      .insert([{
        user_id: user.id,
        tool_id: toolId,
        rating: review.rating,
        title: review.title?.trim() || null,
        content: review.content?.trim() || null
      }])
      .select()
      .single()

    if (error) {
      console.error('评价提交失败:', error)
      if (error.code === '23505') {
        throw new Error('您已经评价过此工具')
      } else if (error.code === '42501') {
        throw new Error('没有权限发表评价，请检查登录状态')
      } else {
        throw new Error('评价提交失败，请稍后重试')
      }
    }
    
    return data
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('评价提交失败，请稍后重试')
  }
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
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('用户未登录')

    // 验证内容长度
    if (!content || content.trim().length === 0) {
      throw new Error('评论内容不能为空')
    }
    
    if (content.length > 1000) {
      throw new Error('评论内容不能超过1000字符')
    }

    const { data, error } = await supabase
      .from('tool_comments')
      .insert([{
        user_id: user.id,
        tool_id: toolId,
        content: content.trim(),
        parent_id: parentId || null
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

    if (error) {
      console.error('评论提交失败:', error)
      // 提供用户友好的错误信息
      if (error.code === '23505') {
        throw new Error('重复评论，请勿重复提交')
      } else if (error.code === '42501') {
        throw new Error('没有权限发表评论，请检查登录状态')
      } else {
        throw new Error('评论提交失败，请稍后重试')
      }
    }
    
    return data
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('评论提交失败，请稍后重试')
  }
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
