#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 手动加载环境变量
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'))
  
  envLines.forEach(line => {
    const [key, ...valueParts] = line.split('=')
    const value = valueParts.join('=').trim()
    if (key && value) {
      process.env[key.trim()] = value
    }
  })
  console.log(`📄 已加载环境变量文件: ${envPath}`)
} else {
  console.log(`⚠️  环境变量文件不存在: ${envPath}`)
}

// 从环境变量获取配置
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ 缺少Supabase配置环境变量')
  console.error('需要: SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applySQLFile(filePath) {
  try {
    console.log(`🔧 读取SQL文件: ${filePath}`)
    const sqlContent = fs.readFileSync(filePath, 'utf8')
    
    // 将SQL按分号分割成单独的语句
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`📄 发现 ${statements.length} 个SQL语句`)
    
    let successCount = 0
    let errorCount = 0
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      // 跳过注释行和空行
      if (statement.startsWith('/*') || statement.includes('RAISE NOTICE')) {
        console.log(`⏭️  跳过: ${statement.substring(0, 50)}...`)
        continue
      }
      
      try {
        console.log(`🔄 执行语句 ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`)
        
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        }).single()
        
        if (error) {
          console.error(`❌ 语句失败: ${error.message}`)
          errorCount++
        } else {
          console.log(`✅ 语句执行成功`)
          successCount++
        }
        
        // 添加小延迟避免速率限制
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (err) {
        console.error(`❌ 执行错误: ${err.message}`)
        errorCount++
      }
    }
    
    console.log('='.repeat(60))
    console.log(`📊 执行统计:`)
    console.log(`   ✅ 成功: ${successCount}`)
    console.log(`   ❌ 失败: ${errorCount}`)
    console.log(`   📈 总计: ${successCount + errorCount}`)
    console.log('='.repeat(60))
    
    if (errorCount === 0) {
      console.log('🎉 所有安全补丁应用成功!')
    } else {
      console.log('⚠️  部分补丁应用失败，请检查错误日志')
    }
    
  } catch (error) {
    console.error('❌ 应用安全补丁失败:', error.message)
    process.exit(1)
  }
}

// 使用rpc方式执行SQL的替代方案
async function executeDirectSQL() {
  try {
    console.log('🔧 使用直接SQL执行模式...')
    
    // 读取安全补丁文件
    const securityPatchesPath = path.join(__dirname, '..', 'database-security-patches.sql')
    const sqlContent = fs.readFileSync(securityPatchesPath, 'utf8')
    
    // 分批执行关键安全策略
    const criticalStatements = [
      // 启用RLS
      "ALTER TABLE tools ENABLE ROW LEVEL SECURITY",
      "ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY",
      
      // 删除旧策略
      "DROP POLICY IF EXISTS \"tools_public_read\" ON tools",
      "DROP POLICY IF EXISTS \"tools_admin_read_all\" ON tools", 
      "DROP POLICY IF EXISTS \"tools_admin_write\" ON tools",
      
      // 创建新的安全策略
      `CREATE POLICY "tools_public_read" ON tools
       FOR SELECT USING (status = 'published')`,
       
      `CREATE POLICY "tools_admin_read_all" ON tools
       FOR SELECT TO authenticated
       USING (
         EXISTS (
           SELECT 1 FROM admin_users 
           WHERE user_id = auth.uid() 
           AND (permissions->>'manage_tools')::boolean = true
         )
       )`,
       
      `CREATE POLICY "tools_admin_write" ON tools
       FOR ALL TO authenticated
       USING (
         EXISTS (
           SELECT 1 FROM admin_users 
           WHERE user_id = auth.uid() 
           AND (permissions->>'manage_tools')::boolean = true
         )
       )`
    ]
    
    console.log(`📄 执行 ${criticalStatements.length} 个关键安全语句`)
    
    for (let i = 0; i < criticalStatements.length; i++) {
      const statement = criticalStatements[i]
      console.log(`🔄 执行: ${statement.split('\n')[0].trim()}`)
      
      try {
        // 直接使用supabase客户端执行原生SQL
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sql: statement
          })
        })
        
        if (response.ok) {
          console.log('✅ 执行成功')
        } else {
          const error = await response.text()
          console.error(`❌ 执行失败: ${error}`)
        }
        
      } catch (err) {
        console.error(`❌ 请求失败: ${err.message}`)
      }
      
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    console.log('🎉 关键安全策略应用完成!')
    
  } catch (error) {
    console.error('❌ 执行失败:', error.message)
  }
}

// 主函数
async function main() {
  console.log('🔐 开始应用数据库安全补丁...')
  console.log(`🌐 Supabase URL: ${supabaseUrl}`)
  
  const securityPatchesPath = path.join(__dirname, '..', 'database-security-patches.sql')
  
  if (!fs.existsSync(securityPatchesPath)) {
    console.error(`❌ 安全补丁文件不存在: ${securityPatchesPath}`)
    process.exit(1)
  }
  
  // 尝试直接SQL执行
  await executeDirectSQL()
}

// 运行主函数
main().catch(error => {
  console.error('❌ 应用安全补丁时发生错误:', error)
  process.exit(1)
})

export { applySQLFile, executeDirectSQL }