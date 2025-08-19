// 数据库连接检查脚本
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bixljqdwkjuzftlpmgtb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpeGxqcWR3a2p1emZ0bHBtZ3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MTc4NzUsImV4cCI6MjA3MDQ5Mzg3NX0.dKpr91AP0SrY7IllDEOGPQZ5QFAa1TK30otahmK-uy8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('🔍 开始检查数据库...');
  
  try {
    // 检查工具表
    const { data: tools, error: toolsError } = await supabase
      .from('tools')
      .select('*')
      .limit(5);
    
    if (toolsError) {
      console.error('❌ 工具表查询错误:', toolsError);
    } else {
      console.log('✅ 工具表正常，找到', tools.length, '条记录');
    }

    // 检查分类表
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .limit(5);
    
    if (categoriesError) {
      console.error('❌ 分类表查询错误:', categoriesError);
    } else {
      console.log('✅ 分类表正常，找到', categories.length, '条记录');
    }

    // 检查用户表
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(5);
    
    if (usersError) {
      console.error('❌ 用户表查询错误:', usersError);
    } else {
      console.log('✅ 用户表正常，找到', users.length, '条记录');
    }

    // 检查工具提交表
    const { data: submissions, error: submissionsError } = await supabase
      .from('tool_submissions')
      .select('*')
      .limit(5);
    
    if (submissionsError) {
      console.error('❌ 工具提交表查询错误:', submissionsError);
    } else {
      console.log('✅ 工具提交表正常，找到', submissions.length, '条记录');
    }

    console.log('🎯 数据库检查完成');
    
  } catch (error) {
    console.error('💥 数据库连接失败:', error);
  }
}

checkDatabase();