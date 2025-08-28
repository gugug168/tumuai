// 测试管理员权限验证的调试脚本
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testAuth() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY

    console.log('🔍 测试管理员权限验证...')

    // 使用 anon key 登录获取 access token
    const supabaseClient = createClient(supabaseUrl, anonKey)
    
    console.log('1. 尝试登录获取access token...')
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email: 'admin@civilaihub.com',
        password: 'admin123'
    })

    if (authError) {
        console.error('❌ 登录失败:', authError.message)
        return
    }

    console.log('✅ 登录成功，用户ID:', authData.user.id)
    console.log('✅ Access Token 已获取')

    // 使用 service role key 检查管理员表
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    
    console.log('\n2. 使用service role检查admin_users表...')
    const { data: adminCheck, error: adminError } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .eq('user_id', authData.user.id)

    if (adminError) {
        console.error('❌ 查询admin_users失败:', adminError.message)
        return
    }

    console.log('✅ Admin查询结果:', adminCheck)

    // 测试JWT验证
    console.log('\n3. 使用access token验证用户...')
    const { data: jwtUser, error: jwtError } = await supabaseAdmin.auth.getUser(authData.session.access_token)
    
    if (jwtError) {
        console.error('❌ JWT验证失败:', jwtError.message)
        return
    }

    console.log('✅ JWT用户验证成功:', jwtUser.user.id)
    console.log('✅ 用户邮箱:', jwtUser.user.email)

    console.log('\n🎉 所有验证步骤完成！')
}

testAuth().catch(console.error)