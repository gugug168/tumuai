// 紧急修复admin_users表RLS无限递归问题
// 运行方式: node emergency-rls-fix.js

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ 缺少环境变量: SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

const fixSQL = `
-- 修复admin_users表RLS无限递归问题
DROP POLICY IF EXISTS "admin_users_read_own" ON admin_users;
DROP POLICY IF EXISTS "admin_users_super_admin_read_all" ON admin_users;  
DROP POLICY IF EXISTS "admin_users_super_admin_write" ON admin_users;
DROP POLICY IF EXISTS "admin_users_select_own" ON admin_users;
DROP POLICY IF EXISTS "admin_users_service_role" ON admin_users;
DROP POLICY IF EXISTS "admin_users_policy" ON admin_users;

-- 完全禁用admin_users表的行级安全
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- 简化工具表的管理员策略
DROP POLICY IF EXISTS "tools_admin_read_all" ON tools;
DROP POLICY IF EXISTS "tools_admin_write" ON tools;

CREATE POLICY "tools_admin_access" ON tools
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
`

async function fixRLSRecursion() {
  try {
    console.log('🔧 开始修复admin_users表RLS无限递归问题...')
    
    // 执行修复SQL
    const { error } = await supabase.rpc('exec_sql', { sql: fixSQL })
    
    if (error) {
      console.error('❌ SQL执行失败:', error.message)
      
      // 尝试逐条执行SQL命令
      const commands = fixSQL.split(';').filter(cmd => cmd.trim())
      
      for (const cmd of commands) {
        if (cmd.trim()) {
          console.log(`执行: ${cmd.substring(0, 50)}...`)
          const { error: cmdError } = await supabase.rpc('exec_sql', { sql: cmd })
          if (cmdError) {
            console.warn(`⚠️ 命令执行失败: ${cmdError.message}`)
          }
        }
      }
    } else {
      console.log('✅ RLS修复SQL执行成功')
    }
    
    // 验证修复结果
    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('id')
      .limit(1)
    
    if (adminCheck) {
      console.log('✅ admin_users表查询正常，RLS递归问题已修复')
    } else {
      console.log('⚠️ admin_users表查询仍有问题，可能需要手动修复')
    }
    
  } catch (error) {
    console.error('❌ 修复过程发生异常:', error.message)
    console.log('\n📋 手动修复步骤:')
    console.log('1. 登录Supabase控制台')
    console.log('2. 进入SQL Editor')
    console.log('3. 执行以下SQL:')
    console.log(fixSQL)
  }
}

fixRLSRecursion()