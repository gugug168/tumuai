/**
 * 迁移脚本 - 添加 screenshots 列
 *
 * 用法: node scripts/run-migration-add-screenshots.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🔄 执行迁移: 添加 screenshots 列\n');

  // 使用 rpc 执行 SQL (需要创建一个 SQL 函数，或者直接执行 DDL)
  // 由于 Supabase JS 客户端不支持直接执行 DDL，我们需要使用 SQL Editor 或 Postgres 客户端

  // 方案：使用 supabase.rpc() 调用 exec_sql 函数（如果存在）
  // 或者提示用户在 Supabase Dashboard 中执行

  console.log('⚠️  Supabase JS 客户端无法直接执行 DDL 语句');
  console.log('请按以下步骤操作：\n');
  console.log('1. 访问 Supabase Dashboard: https://supabase.com/dashboard');
  console.log('2. 选择项目');
  console.log('3. 进入 SQL Editor');
  console.log('4. 执行以下 SQL:\n');

  const sql = `-- 修复 screenshots 列问题
-- Date: 2026-02-03

-- 确保 screenshots 列存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tools'
    AND column_name = 'screenshots'
  ) THEN
    ALTER TABLE public.tools ADD COLUMN screenshots text[];
  END IF;
END $$;

-- 添加注释
COMMENT ON COLUMN public.tools.screenshots IS 'Public screenshot URLs (uploaded to Supabase Storage bucket tool-screenshots)';`;

  console.log(sql);
  console.log('\n' + '='.repeat(50));

  // 尝试使用 PostgreSQL 客户端直接执行
  try {
    const { Client } = require('pg');
    const connectionString = `${supabaseUrl.replace('https://', 'postgresql://').replace('/rest/v1', ':5432/postgres')}`;

    console.log('\n尝试使用 pg 客户端直接连接...\n');
    console.log('连接字符串需要格式: postgresql://postgres:[password]@host:5432/postgres');
    console.log('请在 .env.local 中添加 DATABASE_URL');

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.log('\n❌ 未找到 DATABASE_URL 环境变量');
      console.log('请在 Supabase Dashboard > Settings > Database > Connection string > URI 获取');
      return;
    }

    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    console.log('✅ 已连接到数据库\n');
    console.log('执行 SQL...');

    await client.query(sql);

    console.log('✅ 迁移完成!');
    await client.end();

  } catch (error) {
    console.log('\n⚠️  pg 客户端不可用或连接失败');
    console.log('请使用上述 SQL 在 Supabase Dashboard 中手动执行');
  }
}

runMigration();
