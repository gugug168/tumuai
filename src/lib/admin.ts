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

// 检查用户是否为管理员
export async function checkAdminStatus(): Promise<AdminUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  console.log('🔍 检查用户登录状态:', user?.email);

  if (!user) {
    console.log('❌ 用户未登录');
    return null;
  }

  try {
    // 正式管理员数据库查询
    console.log('🔍 查询数据库中的管理员权限...');
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('❌ 查询管理员权限失败:', error);
        throw error;
      }
      console.warn('⚠️ 未找到管理员记录');
      return null;
    }

    console.log('📋 管理员权限查询结果:', data);
    return data as AdminUser;
  } catch (error) {
    console.error('❌ 管理员权限检查异常:', error);
    return null;
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
  console.log('📊 开始获取系统统计数据...');
  
  try {
    // 工具总数查询（使用更安全的字段选择）
    console.log('🔧 获取工具总数...');
    const { count: totalTools, error: toolsError } = await supabase
      .from('tools')
      .select('id', { count: 'exact', head: true });
    
    if (toolsError) {
      console.error('❌ 获取工具总数失败:', toolsError);
    } else {
      console.log('✅ 工具总数:', totalTools);
    }
    
    // 用户总数查询（添加查询超时）
    console.log('👥 获取用户总数...');
    const { count: totalUsers, error: usersError } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .timeout(5000); // 5秒超时
    
    if (usersError) {
      console.error('❌ 获取用户总数失败:', usersError);
    } else {
      console.log('✅ 用户总数:', totalUsers);
    }
    
    // 待审核提交数查询（使用类型安全的枚举）
    console.log('⏳ 获取待审核提交数...');
    const { count: pendingSubmissions, error: pendingError } = await supabase
      .from('tool_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending' as const);
    
    if (pendingError) {
      console.error('❌ 获取待审核提交数失败:', pendingError);
    } else {
      console.log('✅ 待审核提交数:', pendingSubmissions);
    }
    
    // 评价总数查询（添加重试机制）
    console.log('⭐ 获取评价总数...');
    let totalReviews = 0;
    let reviewsError = null;
    
    try {
      const { count: reviewsCount, error: reviewsErrorInternal } = await supabase
        .from('tool_reviews')
        .select('id', { count: 'exact', head: true })
        .maybeSingle();
        
      if (reviewsErrorInternal) {
        throw reviewsErrorInternal;
      }
      
      totalReviews = reviewsCount || 0;
      console.log('✅ 评价总数:', totalReviews);
    } catch (error) {
      reviewsError = error;
      console.error('❌ 获取评价总数失败:', error);
    }
    
    // 收藏总数查询（使用更安全的查询方式）
    console.log('❤️ 获取收藏总数...');
    let totalFavorites = 0;
    let favoritesError = null;
    
    try {
      const { count: favoritesCount, error: favoritesErrorInternal } = await supabase
        .from('tool_favorites')
        .select('id', { count: 'exact', head: true });
      
      if (favoritesErrorInternal) {
        throw favoritesErrorInternal;
      }
      
      totalFavorites = favoritesCount || 0;
      console.log('✅ 收藏总数:', totalFavorites);
    } catch (error) {
      favoritesError = error;
      console.error('❌ 获取收藏总数失败:', error);
    }

    const stats = {
      totalTools: totalTools || 0,
      totalUsers: totalUsers || 0,
      pendingSubmissions: pendingSubmissions || 0,
      totalReviews: totalReviews || 0,
      totalFavorites: totalFavorites || 0
    };
    
    console.log('📊 统计数据汇总:', stats);

    return stats;
  } catch (error) {
    console.error('❌ 获取统计数据异常:', error);
    return {
      totalTools: 0,
      totalUsers: 0,
      pendingSubmissions: 0,
      totalReviews: 0,
      totalFavorites: 0
    }
  }
}

// 获取工具提交列表
export async function getToolSubmissions(status?: string) {
  console.log('📝 开始获取工具提交列表...', status ? `状态: ${status}` : '全部状态');
  
  try {
    let query = supabase
      .from('tool_submissions')
      .select(`
        id,
        submitter_email,
        tool_name,
        tagline,
        description,
        website_url,
        logo_url,
        categories,
        features,
        pricing,
        status,
        admin_notes,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    console.log('📝 工具提交查询结果:', { 记录数: data?.length || 0, 错误: error });
    
    if (error) {
      console.error('❌ 获取工具提交失败:', error);
      return [];
    }
    console.log('✅ 工具提交数据获取成功');
    return data as ToolSubmission[]
  } catch (error) {
    console.error('❌ 获取工具提交异常:', error);
    return [];
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
  console.log('👥 开始获取用户列表...', `页码: ${page}, 限制: ${limit}`);
  const offset = (page - 1) * limit

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        user_id,
        email,
        full_name,
        avatar_url,
        bio,
        website,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('❌ 获取用户列表失败:', error);
      return [];
    }
    console.log('✅ 用户列表获取成功:', data?.length || 0, '条记录');
    return data || [];
  } catch (error) {
    console.error('❌ 获取用户列表异常:', error);
    return [];
  }
}

// 获取工具列表（管理员视图）
export async function getToolsAdmin(page = 1, limit = 20) {
  console.log('🔧 开始获取工具列表...', `页码: ${page}, 限制: ${limit}`);
  const offset = (page - 1) * limit

  try {
    const { data, error } = await supabase
      .from('tools')
      .select(`
        id,
        name,
        tagline,
        description,
        website_url,
        logo_url,
        categories,
        features,
        pricing,
        featured,
        date_added,
        upvotes,
        views,
        rating,
        review_count,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('❌ 获取工具列表失败:', error);
      return [];
    }
    
    console.log('✅ 工具列表获取成功:', data?.length || 0, '条记录');
    return data || [];
  } catch (error) {
    console.error('❌ 获取工具列表异常:', error);
    return [];
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
  console.log('📋 开始获取管理员日志...', `页码: ${page}, 限制: ${limit}`);
  const offset = (page - 1) * limit

  try {
    const { data, error } = await supabase
      .from('admin_logs')
      .select(`
        id,
        admin_id,
        action,
        target_type,
        target_id,
        details,
        ip_address,
        user_agent,
        created_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('❌ 获取管理员日志失败:', error);
      return [];
    }
    console.log('✅ 管理员日志获取成功:', data?.length || 0, '条记录');
    return data || [];
  } catch (error) {
    console.error('❌ 获取管理员日志异常:', error);
    return [];
  }
}