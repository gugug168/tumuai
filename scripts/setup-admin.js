#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function setupAdmin() {
  try {
    console.log('🚀 开始设置管理员账户...')
    
    // 创建Supabase客户端
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceKey) {
      console.error('❌ 缺少Supabase配置')
      process.exit(1)
    }
    
    const supabase = createClient(supabaseUrl, serviceKey)
    
    const email = 'admin@civilaihub.com'
    const password = 'admin123'
    
    console.log(`📧 创建/更新用户: ${email}`)
    
    // 创建或获取用户
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })
    
    let userId = userData?.user?.id
    if (!userId) {
      // 用户已存在，获取用户ID
      console.log('👤 用户已存在，获取用户ID...')
      const { data: usersList, error: listErr } = await supabase.auth.admin.listUsers()
      if (listErr) throw listErr
      userId = usersList.users.find(u => u.email === email)?.id
      if (!userId) throw new Error('无法定位管理员用户')
      
      // 更新密码
      console.log('🔑 更新用户密码...')
      const { error: pwdErr } = await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true
      })
      if (pwdErr) throw pwdErr
    }
    
    console.log(`✅ 用户ID: ${userId}`)
    
    // 检查admin_users表中的记录
    console.log('🔍 检查管理员权限记录...')
    const { data: existingAdmin, error: selectErr } = await supabase
      .from('admin_users')
      .select('id, role, is_active')
      .eq('user_id', userId)
      .maybeSingle()
    
    if (selectErr) throw selectErr
    
    const permissions = {
      manage_tools: true,
      manage_users: true,
      manage_submissions: true,
      manage_admins: true,
      view_analytics: true,
      system_settings: true
    }
    
    if (existingAdmin?.id) {
      console.log('🔄 更新现有管理员记录...')
      const { error: updateErr } = await supabase
        .from('admin_users')
        .update({ 
          role: 'super_admin', 
          permissions,
          is_active: true,
          email: email,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAdmin.id)
      if (updateErr) throw updateErr
    } else {
      console.log('📝 创建新的管理员记录...')
      const { error: insertErr } = await supabase
        .from('admin_users')
        .insert([{ 
          user_id: userId, 
          email: email,
          role: 'super_admin', 
          permissions,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
      if (insertErr) throw insertErr
    }
    
    console.log('🎉 管理员账户设置完成!')
    console.log('📋 登录信息:')
    console.log(`   邮箱: ${email}`)
    console.log(`   密码: ${password}`)
    console.log('🔗 登录地址: http://localhost:5175/admin/login')
    
  } catch (error) {
    console.error('❌ 设置失败:', error.message)
    process.exit(1)
  }
}

// 运行设置
setupAdmin()