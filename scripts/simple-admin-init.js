// 简化的管理员初始化脚本
// 直接使用Service Role Key创建管理员账户

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = 'admin@civilaihub.com'
const adminPassword = 'admin123'

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 环境变量缺失')
  process.exit(1)
}

// 创建 Service Role 客户端
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function initializeAdmin() {
  console.log('🚀 开始初始化管理员账户...')
  
  try {
    // 1. 首先尝试获取现有用户
    console.log('📧 检查现有用户...')
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('❌ 获取用户列表失败:', listError.message)
      throw listError
    }
    
    let userId
    const existingUser = existingUsers.users.find(u => u.email === adminEmail)
    
    if (existingUser) {
      console.log('✅ 找到现有用户:', existingUser.id)
      userId = existingUser.id
      
      // 更新用户密码确保一致
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password: adminPassword,
        email_confirm: true
      })
      
      if (updateError) {
        console.error('⚠️  更新密码失败:', updateError.message)
      } else {
        console.log('✅ 密码已更新')
      }
    } else {
      console.log('⚠️  用户不存在，创建新用户...')
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true
      })
      
      if (createError) {
        console.error('❌ 创建用户失败:', createError.message)
        throw createError
      }
      
      if (userData?.user) {
        userId = userData.user.id
        console.log('✅ 用户创建成功:', userId)
      }
    }
    
    if (!userId) {
      throw new Error('无法获取用户ID')
    }
    
    // 2. 创建或更新管理员记录
    console.log('🔐 处理管理员记录...')
    const { error: upsertError } = await supabase
      .from('admin_users')
      .upsert({
        user_id: userId,
        email: adminEmail,
        role: 'super_admin',
        is_active: true,
        permissions: {
          tools: ["read", "write", "delete"],
          users: ["read", "write"],
          categories: ["read", "write", "delete"],
          submissions: ["read", "write", "delete"],
          analytics: ["read"],
          settings: ["read", "write"]
        }
      }, {
        onConflict: 'user_id'
      })
    
    if (upsertError) {
      throw new Error(`管理员记录操作失败: ${upsertError.message}`)
    }
    
    console.log('✅ 管理员记录已设置')
    
    // 3. 验证结果
    console.log('🔍 验证设置...')
    const { data: adminData, error: verifyError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (verifyError || !adminData) {
      throw new Error('验证失败')
    }
    
    console.log('🎉 管理员初始化成功！')
    console.log('=====================================')
    console.log('登录信息:')
    console.log(`📧 邮箱: ${adminEmail}`)
    console.log(`🔐 密码: ${adminPassword}`)
    console.log(`👤 用户ID: ${userId}`)
    console.log(`🛡️  权限: ${adminData.role}`)
    console.log('=====================================')
    console.log('现在可以访问: http://localhost:5173/admin')
    
  } catch (error) {
    console.error('❌ 初始化失败:', error.message)
    process.exit(1)
  }
}

initializeAdmin()