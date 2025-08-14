export async function checkAdminStatus(): Promise<AdminUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  console.log('🔍 检查用户登录状态:', user?.email);

  if (!user) {
    console.log('❌ 用户未登录');
    return null;
  }

  try {
    // 优先检查数据库中的正式管理员记录
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