#!/usr/bin/env node

/**
 * 全面Supabase数据库诊断脚本
 * 检查管理员账户、认证状态和数据库连接
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// 配置
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;  
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 开始全面数据库诊断...\n');

// 诊断结果收集器
const diagnosticResults = {
  connection: null,
  authSystem: null,
  adminUsers: null,
  userAuth: null,
  permissions: null
};

// 测试数据库连接
async function testDatabaseConnection() {
  console.log('📡 测试数据库连接...');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      success: false,
      error: '缺少Supabase配置',
      details: { supabaseUrl: !!supabaseUrl, supabaseAnonKey: !!supabaseAnonKey }
    };
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.from('tools').select('id').limit(1);
    
    return {
      success: !error,
      error: error?.message,
      connected: true,
      testQuery: !!data
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      connected: false
    };
  }
}

// 检查认证系统状态
async function checkAuthSystem() {
  console.log('🔐 检查认证系统...');
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 检查auth.users表
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      return {
        success: false,
        error: usersError.message,
        authTableAccessible: false
      };
    }
    
    // 查找目标管理员用户
    const targetUser = users.users.find(u => u.email === 'admin@civilaihub.com');
    
    return {
      success: true,
      totalUsers: users.users.length,
      targetUserExists: !!targetUser,
      targetUserDetails: targetUser ? {
        id: targetUser.id,
        email: targetUser.email,
        emailConfirmed: targetUser.email_confirmed_at !== null,
        lastSignIn: targetUser.last_sign_in_at,
        createdAt: targetUser.created_at
      } : null
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      authSystemAccessible: false
    };
  }
}

// 检查admin_users表
async function checkAdminUsersTable() {
  console.log('👑 检查admin_users表...');
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 检查表是否存在并获取所有记录
    const { data: adminUsers, error } = await supabase
      .from('admin_users')
      .select('*');
    
    if (error) {
      return {
        success: false,
        error: error.message,
        tableExists: error.code !== 'PGRST116' // PGRST116 = table not found
      };
    }
    
    // 查找目标管理员
    const targetAdmin = adminUsers.find(admin => {
      // 通过email查找需要先查auth.users表获取user_id
      return admin.user_id && admin.role;
    });
    
    return {
      success: true,
      tableExists: true,
      totalAdmins: adminUsers.length,
      adminUsers: adminUsers.map(admin => ({
        id: admin.id,
        user_id: admin.user_id,
        role: admin.role,
        permissions: admin.permissions,
        created_at: admin.created_at
      }))
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      tableAccessible: false
    };
  }
}

// 验证用户认证流程
async function testUserAuthentication() {
  console.log('🔓 测试用户认证流程...');
  
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // 尝试登录
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@civilaihub.com',
      password: 'admin123'
    });
    
    if (authError) {
      return {
        success: false,
        error: authError.message,
        errorCode: authError.status,
        canAttemptLogin: true
      };
    }
    
    // 如果登录成功，检查权限
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      // 尝试查询admin_users表
      const { data: adminCheck, error: adminError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      
      // 登出
      await supabase.auth.signOut();
      
      return {
        success: true,
        loginSuccessful: true,
        userProfile: {
          id: session.user.id,
          email: session.user.email
        },
        adminRecord: adminCheck ? {
          role: adminCheck.role,
          permissions: adminCheck.permissions
        } : null,
        adminCheckError: adminError?.message
      };
    }
    
    return {
      success: false,
      error: '登录后无法获取会话',
      loginAttempted: true
    };
    
  } catch (err) {
    return {
      success: false,
      error: err.message,
      authFlowAccessible: false
    };
  }
}

// 主检查流程
async function runDiagnostics() {
  try {
    // 1. 数据库连接测试
    diagnosticResults.connection = await testDatabaseConnection();
    console.log(`   ${diagnosticResults.connection.success ? '✅' : '❌'} 连接状态: ${diagnosticResults.connection.success ? '成功' : diagnosticResults.connection.error}\n`);
    
    // 2. 认证系统检查
    if (diagnosticResults.connection.success) {
      diagnosticResults.authSystem = await checkAuthSystem();
      console.log(`   ${diagnosticResults.authSystem.success ? '✅' : '❌'} 认证系统: ${diagnosticResults.authSystem.success ? `${diagnosticResults.authSystem.totalUsers}个用户，目标用户${diagnosticResults.authSystem.targetUserExists ? '存在' : '不存在'}` : diagnosticResults.authSystem.error}\n`);
    }
    
    // 3. admin_users表检查
    if (diagnosticResults.connection.success) {
      diagnosticResults.adminUsers = await checkAdminUsersTable();
      console.log(`   ${diagnosticResults.adminUsers.success ? '✅' : '❌'} Admin表: ${diagnosticResults.adminUsers.success ? `${diagnosticResults.adminUsers.totalAdmins}个管理员记录` : diagnosticResults.adminUsers.error}\n`);
    }
    
    // 4. 用户认证测试
    if (diagnosticResults.connection.success) {
      diagnosticResults.userAuth = await testUserAuthentication();
      console.log(`   ${diagnosticResults.userAuth.success ? '✅' : '❌'} 用户登录: ${diagnosticResults.userAuth.success ? '成功' : diagnosticResults.userAuth.error}\n`);
    }
    
  } catch (error) {
    console.error('❌ 诊断过程出错:', error);
  }
}

// 生成详细报告
function generateReport() {
  console.log('📋 详细诊断报告');
  console.log('='.repeat(60));
  
  // Supabase连接状态
  console.log('\n🔸 Supabase连接状态:');
  if (diagnosticResults.connection) {
    console.log(`   状态: ${diagnosticResults.connection.success ? '✅ 正常' : '❌ 异常'}`);
    console.log(`   URL: ${supabaseUrl}`);
    console.log(`   匿名密钥: ${supabaseAnonKey ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`   服务密钥: ${supabaseServiceKey ? '✅ 已配置' : '❌ 未配置'}`);
    if (!diagnosticResults.connection.success) {
      console.log(`   错误: ${diagnosticResults.connection.error}`);
    }
  }
  
  // 认证系统状态
  console.log('\n🔸 认证系统状态:');
  if (diagnosticResults.authSystem) {
    console.log(`   状态: ${diagnosticResults.authSystem.success ? '✅ 正常' : '❌ 异常'}`);
    console.log(`   总用户数: ${diagnosticResults.authSystem.totalUsers || 'N/A'}`);
    console.log(`   目标用户(admin@civilaihub.com): ${diagnosticResults.authSystem.targetUserExists ? '✅ 存在' : '❌ 不存在'}`);
    if (diagnosticResults.authSystem.targetUserDetails) {
      const user = diagnosticResults.authSystem.targetUserDetails;
      console.log(`   用户ID: ${user.id}`);
      console.log(`   邮箱确认: ${user.emailConfirmed ? '✅ 已确认' : '❌ 未确认'}`);
      console.log(`   最后登录: ${user.lastSignIn || '从未登录'}`);
    }
  }
  
  // Admin表状态  
  console.log('\n🔸 Admin_users表状态:');
  if (diagnosticResults.adminUsers) {
    console.log(`   状态: ${diagnosticResults.adminUsers.success ? '✅ 正常' : '❌ 异常'}`);
    console.log(`   表存在: ${diagnosticResults.adminUsers.tableExists ? '✅ 是' : '❌ 否'}`);
    console.log(`   管理员记录数: ${diagnosticResults.adminUsers.totalAdmins || 0}`);
    if (diagnosticResults.adminUsers.adminUsers) {
      console.log('   管理员列表:');
      diagnosticResults.adminUsers.adminUsers.forEach((admin, index) => {
        console.log(`     ${index + 1}. ID: ${admin.id}, Role: ${admin.role}, UserID: ${admin.user_id}`);
      });
    }
  }
  
  // 认证流程测试
  console.log('\n🔸 认证流程测试:');
  if (diagnosticResults.userAuth) {
    console.log(`   登录尝试: ${diagnosticResults.userAuth.success ? '✅ 成功' : '❌ 失败'}`);
    if (!diagnosticResults.userAuth.success) {
      console.log(`   失败原因: ${diagnosticResults.userAuth.error}`);
      console.log(`   错误代码: ${diagnosticResults.userAuth.errorCode || 'N/A'}`);
    } else {
      console.log(`   用户ID: ${diagnosticResults.userAuth.userProfile?.id}`);
      console.log(`   用户邮箱: ${diagnosticResults.userAuth.userProfile?.email}`);
      console.log(`   管理员记录: ${diagnosticResults.userAuth.adminRecord ? '✅ 存在' : '❌ 缺失'}`);
      if (diagnosticResults.userAuth.adminRecord) {
        console.log(`   管理员角色: ${diagnosticResults.userAuth.adminRecord.role}`);
      }
    }
  }
  
  // 问题摘要
  console.log('\n🔸 问题摘要:');
  const issues = [];
  
  if (!diagnosticResults.connection?.success) {
    issues.push('• 数据库连接失败');
  }
  if (!diagnosticResults.authSystem?.targetUserExists) {
    issues.push('• 管理员用户admin@civilaihub.com在auth.users表中不存在');
  }
  if (!diagnosticResults.authSystem?.targetUserDetails?.emailConfirmed) {
    issues.push('• 管理员邮箱未确认');
  }
  if (!diagnosticResults.adminUsers?.success) {
    issues.push('• admin_users表访问失败');
  }
  if (diagnosticResults.adminUsers?.totalAdmins === 0) {
    issues.push('• admin_users表中没有管理员记录');
  }
  if (!diagnosticResults.userAuth?.success) {
    issues.push(`• 用户登录失败: ${diagnosticResults.userAuth?.error}`);
  }
  if (diagnosticResults.userAuth?.success && !diagnosticResults.userAuth?.adminRecord) {
    issues.push('• 用户可以登录但缺少管理员权限记录');
  }
  
  if (issues.length === 0) {
    console.log('   ✅ 未发现明显问题');
  } else {
    issues.forEach(issue => console.log(`   ❌ ${issue}`));
  }
  
  // 建议修复方案
  console.log('\n🔸 建议修复方案:');
  if (!diagnosticResults.authSystem?.targetUserExists) {
    console.log('   1. 需要创建管理员用户账户');
  }
  if (diagnosticResults.adminUsers?.totalAdmins === 0) {
    console.log('   2. 需要在admin_users表中添加管理员记录');
  }
  if (!diagnosticResults.userAuth?.success) {
    console.log('   3. 检查用户密码是否正确，或重置密码');
  }
  
  console.log('\n✨ 诊断完成!');
}

// 执行诊断
runDiagnostics()
  .then(() => generateReport())
  .catch(error => {
    console.error('💥 诊断失败:', error);
    process.exit(1);
  });