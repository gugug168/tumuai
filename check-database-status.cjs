// 全面检查Supabase数据库状态
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkDatabase() {
  console.log('🔍 全面检查Supabase数据库状态...\n');
  
  try {
    // 1. 检查admin_users表结构和数据
    console.log('1️⃣ 检查admin_users表:');
    const { data: adminUsers, error: adminError } = await supabase.from('admin_users').select('*');
    if (adminError) {
      console.log('❌ admin_users查询失败:', adminError.message);
    } else {
      console.log('✅ admin_users数据:');
      adminUsers.forEach(user => {
        console.log(`  - ID: ${user.id}`);
        console.log(`    用户ID: ${user.user_id}`);
        console.log(`    角色: ${user.role}`);
        console.log(`    权限: ${JSON.stringify(user.permissions)}`);
        console.log(`    创建时间: ${user.created_at}`);
        console.log('');
      });
    }
    
    // 2. 检查auth.users表中的管理员用户
    console.log('2️⃣ 检查auth.users表中的管理员:');
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      console.log('❌ auth.users查询失败:', usersError.message);
    } else {
      const adminUser = users.find(u => u.email === 'admin@civilaihub.com');
      if (adminUser) {
        console.log('✅ 找到管理员用户:');
        console.log(`  - ID: ${adminUser.id}`);
        console.log(`  - 邮箱: ${adminUser.email}`);
        console.log(`  - 邮箱已确认: ${adminUser.email_confirmed_at ? '是' : '否'}`);
        console.log(`  - 创建时间: ${adminUser.created_at}`);
        console.log(`  - 最后登录: ${adminUser.last_sign_in_at || '从未'}`);
      } else {
        console.log('❌ 未找到管理员用户');
      }
    }
    
    // 3. 测试登录获取token
    console.log('3️⃣ 测试管理员登录:');
    
    // 使用anon key测试登录
    const clientSupabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
    const { data: loginData, error: loginError } = await clientSupabase.auth.signInWithPassword({
      email: 'admin@civilaihub.com',
      password: 'admin123'
    });
    
    if (loginError) {
      console.log('❌ 登录测试失败:', loginError.message);
    } else {
      console.log('✅ 登录测试成功');
      console.log(`  - Access Token: ${loginData.session.access_token.substring(0, 50)}...`);
      
      // 4. 测试token验证
      console.log('4️⃣ 测试Token验证:');
      const { data: tokenUser, error: tokenError } = await supabase.auth.getUser(loginData.session.access_token);
      if (tokenError) {
        console.log('❌ Token验证失败:', tokenError.message);
      } else {
        console.log('✅ Token验证成功:', tokenUser.user.email);
        
        // 5. 测试admin权限查询
        console.log('5️⃣ 测试管理员权限查询:');
        const { data: adminCheck, error: adminCheckError } = await supabase
          .from('admin_users')
          .select('*')
          .eq('user_id', tokenUser.user.id)
          .single();
          
        if (adminCheckError) {
          console.log('❌ 管理员权限查询失败:', adminCheckError.message);
        } else {
          console.log('✅ 管理员权限查询成功:');
          console.log(`  - 角色: ${adminCheck.role}`);
          console.log(`  - 是否超级管理员: ${adminCheck.role === 'super_admin' ? '是' : '否'}`);
        }
      }
    }
    
    console.log('\n🎉 数据库检查完成!');
    
  } catch (error) {
    console.error('❌ 检查过程中出现错误:', error.message);
  }
}

checkDatabase();