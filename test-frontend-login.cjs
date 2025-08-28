#!/usr/bin/env node

/**
 * 前端登录流程完整测试
 * 模拟AdminLoginPage的登录过程
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

// 配置
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const testEmail = 'admin@civilaihub.com';
const testPassword = 'admin123';

console.log('🧪 模拟前端登录流程测试...\n');

async function testFrontendLoginFlow() {
  const results = {
    supabaseAuth: null,
    apiCheck: null,
    adminCheck: null,
    overall: null
  };
  
  try {
    // 1. 创建Supabase客户端（模拟前端）
    console.log('📱 1. 初始化Supabase客户端...');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // 2. 执行Supabase认证（模拟AdminLoginPage第38-44行）
    console.log('🔐 2. 执行Supabase认证...');
    const authStartTime = Date.now();
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    const authTime = Date.now() - authStartTime;
    
    results.supabaseAuth = {
      success: !signInError,
      error: signInError?.message,
      time: authTime,
      user: authData?.user ? {
        id: authData.user.id,
        email: authData.user.email
      } : null
    };
    
    console.log(`   ${results.supabaseAuth.success ? '✅' : '❌'} Supabase认证: ${results.supabaseAuth.success ? '成功' : results.supabaseAuth.error} (${authTime}ms)`);
    
    if (!results.supabaseAuth.success) {
      throw new Error(`Supabase认证失败: ${results.supabaseAuth.error}`);
    }
    
    // 3. 获取访问令牌（模拟AdminLoginPage第51-55行）
    console.log('🎫 3. 获取访问令牌...');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('获取访问令牌失败');
    }
    
    console.log('   ✅ 访问令牌获取成功');
    
    // 4. 测试API权限检查（模拟AdminLoginPage第57-77行）
    console.log('🔍 4. 测试API权限检查...');
    const apiStartTime = Date.now();
    
    // 尝试不同的API路径
    const apiPaths = [
      '/api/admin-auth-check',
      '/.netlify/functions/admin-auth-check'
    ];
    
    for (const apiPath of apiPaths) {
      console.log(`   📡 尝试API路径: ${apiPath}`);
      
      try {
        // 在Node.js环境中，需要构造完整URL
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173';
        const fullUrl = `${baseUrl}${apiPath}`;
        
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });
        
        const contentType = response.headers.get('content-type') || '';
        const isJSON = contentType.includes('application/json');
        
        if (isJSON) {
          const responseData = await response.json();
          
          results.apiCheck = {
            success: response.ok && responseData.isAdmin,
            path: apiPath,
            status: response.status,
            contentType,
            isAdmin: responseData.isAdmin,
            error: responseData.error,
            time: Date.now() - apiStartTime
          };
          
          console.log(`   ${results.apiCheck.success ? '✅' : '❌'} API响应: ${response.status}, 管理员权限: ${responseData.isAdmin ? '是' : '否'}`);
          break;
        } else {
          const responseText = await response.text();
          console.log(`   ⚠️ 非JSON响应 (${response.status}): ${responseText.substring(0, 100)}...`);
        }
        
      } catch (apiError) {
        console.log(`   ❌ API调用失败: ${apiError.message}`);
      }
    }
    
    // 5. 测试admin.ts中的checkAdminStatus函数逻辑
    console.log('🛡️ 5. 测试兜底权限检查...');
    
    try {
      // 模拟客户端直接数据库查询（admin.ts第91-110行逻辑）
      const { data: adminUser, error: adminError } = await supabase
        .from('admin_users')
        .select('id, user_id, role, permissions, created_at, updated_at')
        .eq('user_id', session.user.id)
        .single();
      
      results.adminCheck = {
        success: !adminError && !!adminUser,
        error: adminError?.message,
        adminUser: adminUser ? {
          user_id: adminUser.user_id,
          role: adminUser.role,
          permissions: adminUser.permissions
        } : null
      };
      
      console.log(`   ${results.adminCheck.success ? '✅' : '❌'} 兜底权限检查: ${results.adminCheck.success ? '通过' : results.adminCheck.error}`);
      
    } catch (fallbackError) {
      results.adminCheck = {
        success: false,
        error: fallbackError.message
      };
      console.log(`   ❌ 兜底权限检查失败: ${fallbackError.message}`);
    }
    
    // 登出清理
    await supabase.auth.signOut();
    console.log('🚪 已清理测试会话');
    
  } catch (error) {
    results.overall = {
      success: false,
      error: error.message
    };
    console.log(`💥 测试流程失败: ${error.message}`);
  }
  
  // 生成测试报告
  console.log('\n📊 前端登录流程测试报告');
  console.log('='.repeat(50));
  
  console.log('\n🔸 Supabase认证测试:');
  if (results.supabaseAuth) {
    console.log(`   状态: ${results.supabaseAuth.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`   用户: ${results.supabaseAuth.user?.email || 'N/A'}`);
    console.log(`   耗时: ${results.supabaseAuth.time}ms`);
    if (!results.supabaseAuth.success) {
      console.log(`   错误: ${results.supabaseAuth.error}`);
    }
  }
  
  console.log('\n🔸 API权限检查测试:');
  if (results.apiCheck) {
    console.log(`   状态: ${results.apiCheck.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`   路径: ${results.apiCheck.path}`);
    console.log(`   HTTP状态: ${results.apiCheck.status}`);
    console.log(`   内容类型: ${results.apiCheck.contentType}`);
    console.log(`   管理员权限: ${results.apiCheck.isAdmin ? '是' : '否'}`);
    console.log(`   耗时: ${results.apiCheck.time}ms`);
    if (results.apiCheck.error) {
      console.log(`   错误: ${results.apiCheck.error}`);
    }
  } else {
    console.log('   状态: ❌ 无法访问任何API端点');
  }
  
  console.log('\n🔸 兜底权限检查测试:');
  if (results.adminCheck) {
    console.log(`   状态: ${results.adminCheck.success ? '✅ 成功' : '❌ 失败'}`);
    if (results.adminCheck.success && results.adminCheck.adminUser) {
      console.log(`   角色: ${results.adminCheck.adminUser.role}`);
      console.log(`   用户ID: ${results.adminCheck.adminUser.user_id}`);
    }
    if (results.adminCheck.error) {
      console.log(`   错误: ${results.adminCheck.error}`);
    }
  }
  
  console.log('\n🔸 问题分析:');
  if (results.supabaseAuth?.success && results.adminCheck?.success) {
    if (results.apiCheck?.success) {
      console.log('   ✅ 所有检查都通过，登录应该正常工作');
    } else {
      console.log('   ⚠️ Supabase和数据库正常，但API路由有问题');
      console.log('   🔧 建议: API路由修复后或使用兜底机制应该能解决');
    }
  } else if (!results.supabaseAuth?.success) {
    console.log('   ❌ Supabase认证失败，请检查账户密码');
  } else if (!results.adminCheck?.success) {
    console.log('   ❌ 管理员权限缺失，请检查admin_users表');
  }
  
  console.log('\n✨ 测试完成!');
}

// 执行测试
testFrontendLoginFlow().catch(console.error);