// 快速数据库设置和测试脚本
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '../.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔧 开始设置管理员数据库...')

async function main() {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('缺少必要的环境变量')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    console.log('📊 1. 检查现有用户...')
    
    // 检查用户是否存在
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) throw listError
    
    let adminUser = existingUsers.users.find(u => u.email === 'admin@civilaihub.com')
    
    if (!adminUser) {
      console.log('👤 2. 创建管理员用户...')
      const { data: createResult, error: createError } = await supabase.auth.admin.createUser({
        email: 'admin@civilaihub.com',
        password: 'admin123',
        email_confirm: true
      })
      
      if (createError) throw createError
      adminUser = createResult.user
      console.log(`✅ 用户创建成功: ${adminUser.id}`)
    } else {
      console.log(`✅ 用户已存在: ${adminUser.id}`)
      
      // 确保密码正确
      const { error: updateError } = await supabase.auth.admin.updateUserById(adminUser.id, {
        password: 'admin123'
      })
      
      if (updateError) console.log('⚠️  密码更新失败:', updateError.message)
      else console.log('✅ 密码已同步')
    }

    console.log('📋 3. 检查admin_users表...')
    
    // 检查表是否存在
    const { data: tableCheck, error: tableError } = await supabase
      .from('admin_users')
      .select('id')
      .limit(1)
    
    if (tableError && tableError.message.includes('does not exist')) {
      console.log('❌ admin_users表不存在')
      console.log('🔧 请先在Supabase控制台运行create-admin-table.sql创建表结构')
      console.log('📍 SQL文件位置: E:\\tumuai\\create-admin-table.sql')
      
      return
    }

    console.log('📝 4. 检查管理员记录...')
    
    const { data: adminRecord, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', adminUser.id)
      .single()

    if (adminError && adminError.code === 'PGRST116') {
      console.log('👑 5. 创建管理员记录...')
      
      const { error: insertError } = await supabase
        .from('admin_users')
        .insert({
          user_id: adminUser.id,
          email: 'admin@civilaihub.com',
          role: 'super_admin',
          is_active: true,
          permissions: {
            "tools": ["read", "write", "delete"],
            "users": ["read", "write"], 
            "categories": ["read", "write", "delete"],
            "submissions": ["read", "write", "delete"],
            "analytics": ["read"],
            "settings": ["read", "write"]
          }
        })
      
      if (insertError) throw insertError
      console.log('✅ 管理员记录创建成功')
    } else if (adminError) {
      throw adminError
    } else {
      console.log('✅ 管理员记录已存在')
    }

    console.log('🎉 数据库设置完成！')
    console.log('\n📱 现在可以使用以下凭据登录:')
    console.log('   📧 邮箱: admin@civilaihub.com')
    console.log('   🔐 密码: admin123')
    console.log('\n🌐 访问: http://localhost:8888/admin/login')

  } catch (error) {
    console.error('❌ 设置失败:', error.message)
    process.exit(1)
  }
}

main()