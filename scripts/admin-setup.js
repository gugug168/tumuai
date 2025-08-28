/**
 * 管理员账户初始化脚本
 * 使用Node.js + Supabase Service Role Key执行
 * 
 * 运行方法：
 * node scripts/admin-setup.js
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// 加载环境变量
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_EMAIL = 'admin@civilaihub.com'
const ADMIN_PASSWORD = 'admin123'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ 缺少必要的环境变量')
  console.error('请确保 .env.local 文件中包含:')
  console.error('- VITE_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// 使用Service Role创建Supabase客户端
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

console.log('🚀 开始初始化管理员账户...')
console.log(`📧 管理员邮箱: ${ADMIN_EMAIL}`)
console.log(`🔗 Supabase URL: ${SUPABASE_URL}`)

async function checkAndCreateTables() {
  console.log('\n📋 1. 检查数据库表结构...')
  
  // 检查 admin_users 表是否存在
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'admin_users')
    .maybeSingle()
  
  if (tablesError) {
    console.error('❌ 检查表结构失败:', tablesError.message)
    return false
  }
  
  if (!tables) {
    console.log('⚠️  admin_users 表不存在，需要创建')
    console.log('请运行以下SQL脚本创建表:')
    console.log('database/admin_users_migration.sql')
    return false
  }
  
  console.log('✅ admin_users 表已存在')
  return true
}

async function createOrUpdateAdminUser() {
  console.log('\n👤 2. 处理管理员用户账户...')
  
  try {
    // 首先检查用户是否已存在
    const { data: existingUser, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) {
      console.error('❌ 查询用户失败:', listError.message)
      return null
    }
    
    const adminUser = existingUser.users.find(u => u.email === ADMIN_EMAIL)
    
    if (adminUser) {
      console.log('✅ 管理员用户已存在，更新密码...')
      
      // 更新用户密码
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        adminUser.id, 
        {
          password: ADMIN_PASSWORD,
          email_confirm: true
        }
      )
      
      if (updateError) {
        console.error('❌ 更新用户密码失败:', updateError.message)
        return null
      }
      
      console.log('✅ 用户密码已更新')
      return adminUser.id
    } else {
      console.log('⚠️  管理员用户不存在，创建新用户...')
      
      // 创建新用户
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true
      })
      
      if (createError) {
        console.error('❌ 创建用户失败:', createError.message)
        return null
      }
      
      console.log('✅ 管理员用户创建成功')
      return newUser.user.id
    }
  } catch (error) {
    console.error('❌ 处理用户账户异常:', error.message)
    return null
  }
}

async function setupAdminRecord(userId) {
  console.log('\n🔐 3. 设置管理员权限记录...')
  
  try {
    // 检查是否已有管理员记录
    const { data: existingAdmin, error: selectError } = await supabase
      .from('admin_users')
      .select('id, role, is_active')
      .eq('user_id', userId)
      .maybeSingle()
    
    if (selectError) {
      console.error('❌ 查询管理员记录失败:', selectError.message)
      return false
    }
    
    const permissions = {
      tools: ["read", "write", "delete"],
      users: ["read", "write"],
      categories: ["read", "write", "delete"],
      submissions: ["read", "write", "delete"],
      analytics: ["read"],
      settings: ["read", "write"]
    }
    
    if (existingAdmin) {
      console.log('✅ 管理员记录已存在，更新权限...')
      
      const { error: updateError } = await supabase
        .from('admin_users')
        .update({
          role: 'super_admin',
          is_active: true,
          permissions: permissions,
          last_login: new Date().toISOString()
        })
        .eq('id', existingAdmin.id)
      
      if (updateError) {
        console.error('❌ 更新管理员记录失败:', updateError.message)
        return false
      }
      
      console.log('✅ 管理员权限已更新')
    } else {
      console.log('⚠️  管理员记录不存在，创建新记录...')
      
      const { error: insertError } = await supabase
        .from('admin_users')
        .insert([{
          user_id: userId,
          email: ADMIN_EMAIL,
          role: 'super_admin',
          is_active: true,
          permissions: permissions,
          created_at: new Date().toISOString()
        }])
      
      if (insertError) {
        console.error('❌ 创建管理员记录失败:', insertError.message)
        return false
      }
      
      console.log('✅ 管理员记录创建成功')
    }
    
    return true
  } catch (error) {
    console.error('❌ 设置管理员权限异常:', error.message)
    return false
  }
}

async function verifySetup() {
  console.log('\n✅ 4. 验证管理员设置...')
  
  try {
    // 验证用户认证
    const { data: users, error: authError } = await supabase.auth.admin.listUsers()
    if (authError) {
      console.error('❌ 验证用户认证失败:', authError.message)
      return false
    }
    
    const adminUser = users.users.find(u => u.email === ADMIN_EMAIL)
    if (!adminUser) {
      console.error('❌ 管理员用户不存在')
      return false
    }
    
    console.log('✅ 用户认证验证通过')
    console.log(`   用户ID: ${adminUser.id}`)
    console.log(`   邮箱: ${adminUser.email}`)
    console.log(`   确认状态: ${adminUser.email_confirmed_at ? '已确认' : '未确认'}`)
    
    // 验证管理员记录
    const { data: adminRecord, error: recordError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', adminUser.id)
      .maybeSingle()
    
    if (recordError) {
      console.error('❌ 验证管理员记录失败:', recordError.message)
      return false
    }
    
    if (!adminRecord) {
      console.error('❌ 管理员记录不存在')
      return false
    }
    
    console.log('✅ 管理员记录验证通过')
    console.log(`   记录ID: ${adminRecord.id}`)
    console.log(`   角色: ${adminRecord.role}`)
    console.log(`   状态: ${adminRecord.is_active ? '活跃' : '非活跃'}`)
    console.log(`   权限: ${JSON.stringify(adminRecord.permissions, null, 2)}`)
    
    return true
  } catch (error) {
    console.error('❌ 验证设置异常:', error.message)
    return false
  }
}

async function main() {
  try {
    console.log('=====================================')
    console.log('🏗️  Civil AI Hub 管理员账户初始化')
    console.log('=====================================')
    
    // 步骤1: 检查表结构
    const tablesExist = await checkAndCreateTables()
    if (!tablesExist) {
      console.log('\n❌ 初始化失败: 缺少必要的数据库表')
      console.log('请先运行数据库迁移脚本创建 admin_users 表')
      process.exit(1)
    }
    
    // 步骤2: 创建或更新管理员用户
    const userId = await createOrUpdateAdminUser()
    if (!userId) {
      console.log('\n❌ 初始化失败: 无法处理管理员用户')
      process.exit(1)
    }
    
    // 步骤3: 设置管理员权限记录
    const adminSetup = await setupAdminRecord(userId)
    if (!adminSetup) {
      console.log('\n❌ 初始化失败: 无法设置管理员权限')
      process.exit(1)
    }
    
    // 步骤4: 验证设置
    const verified = await verifySetup()
    if (!verified) {
      console.log('\n❌ 初始化失败: 验证失败')
      process.exit(1)
    }
    
    console.log('\n🎉 管理员账户初始化成功!')
    console.log('=====================================')
    console.log('登录信息:')
    console.log(`📧 邮箱: ${ADMIN_EMAIL}`)
    console.log(`🔐 密码: ${ADMIN_PASSWORD}`)
    console.log('=====================================')
    console.log('现在您可以使用这些凭据登录管理后台')
    
  } catch (error) {
    console.error('\n❌ 初始化过程发生异常:', error.message)
    process.exit(1)
  }
}

// 运行主函数
main().catch(console.error)