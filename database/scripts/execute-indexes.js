#!/usr/bin/env node
/**
 * Civil AI Hub - 数据库索引自动执行脚本
 *
 * 使用方法:
 *   node database/scripts/execute-indexes.js
 *
 * 环境变量:
 *   DATABASE_URL      - PostgreSQL 连接字符串 (必需)
 *   SUPABASE_DB_URL   - Supabase 数据库 URL (可选，格式: postgresql://...)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) { log(`✅ ${message}`, 'green'); }
function error(message) { log(`❌ ${message}`, 'red'); }
function info(message) { log(`ℹ️  ${message}`, 'cyan'); }
function warn(message) { log(`⚠️  ${message}`, 'yellow'); }

// SQL 索引语句
const indexes = [
  // 1. 工具表状态和热度排序索引
  'CREATE INDEX IF NOT EXISTS tools_status_upvotes_idx ON tools(status, upvotes DESC)',

  // 2. 工具表状态和精选索引 (部分索引)
  'CREATE INDEX IF NOT EXISTS tools_status_featured_idx ON tools(status, featured) WHERE featured = true',

  // 3. 工具表状态和日期排序索引
  'CREATE INDEX IF NOT EXISTS tools_status_date_idx ON tools(status, date_added DESC)',

  // 4. 工具表评分排序索引
  'CREATE INDEX IF NOT EXISTS tools_status_rating_idx ON tools(status, rating DESC NULLS LAST)',

  // 5. 工具表浏览量排序索引
  'CREATE INDEX IF NOT EXISTS tools_status_views_idx ON tools(status, views DESC)',

  // 6. 用户收藏表复合索引
  'CREATE INDEX IF NOT EXISTS user_favorites_user_tool_idx ON user_favorites(user_id, tool_id)',

  // 7. 用户收藏表用户索引
  'CREATE INDEX IF NOT EXISTS user_favorites_user_idx ON user_favorites(user_id)',

  // 8. 工具表分类 GIN 索引 (数组包含查询)
  'CREATE INDEX IF NOT EXISTS tools_categories_gin_idx ON tools USING GIN (categories)',

  // 9. 工具表功能 GIN 索引 (数组包含查询)
  'CREATE INDEX IF NOT EXISTS tools_features_gin_idx ON tools USING GIN (features)',

  // 10. 工具表定价索引
  'CREATE INDEX IF NOT EXISTS tools_status_pricing_idx ON tools(status, pricing)'
];

// RPC 函数创建
const rpcFunctions = [
  // 批量浏览量更新函数
  `CREATE OR REPLACE FUNCTION increment_views_batch(tool_ids UUID[], amount INTEGER DEFAULT 1)
   RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
   DECLARE
     tool_record RECORD;
     updated_count INTEGER := 0;
   BEGIN
     IF NOT (current_setting('request.jwt.claim', true)::jsonb->>'role' = 'service_role' OR current_user = 'postgres') THEN
       RAISE EXCEPTION 'Permission denied';
     END IF;
     FOR tool_record IN SELECT UNNEST(tool_ids) AS tool_id LOOP
       UPDATE tools SET views = COALESCE(views, 0) + amount
       WHERE id = tool_record.tool_id AND status = 'published';
       IF FOUND THEN updated_count := updated_count + 1; END IF;
     END LOOP;
     RETURN jsonb_build_object('success', true, 'updated', updated_count, 'message', updated_count || ' tools updated');
   END;
   $$;`,

  // 单个工具浏览量更新函数
  `CREATE OR REPLACE FUNCTION increment_views(tool_id UUID, amount INTEGER DEFAULT 1)
   RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
   DECLARE
     updated BOOLEAN;
   BEGIN
     IF NOT (current_setting('request.jwt.claim', true)::jsonb->>'role' = 'service_role' OR current_user = 'postgres') THEN
       RAISE EXCEPTION 'Permission denied';
     END IF;
     UPDATE tools SET views = COALESCE(views, 0) + amount
     WHERE id = tool_id AND status = 'published';
     GET DIAGNOSTICS updated = ROW_COUNT;
     RETURN jsonb_build_object('success', true, 'updated', CASE WHEN updated THEN 1 ELSE 0 END, 'tool_id', tool_id);
   END;
   $$;`
];

// 从环境变量或 Supabase URL 构建 DATABASE_URL
function getDatabaseUrl() {
  // 1. 直接使用 DATABASE_URL
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // 2. 从 Supabase URL 构建
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.DATABASE_PASSWORD;

  if (supabaseUrl && supabaseKey) {
    // 从 Supabase URL 提取项目引用
    const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (match) {
      const projectRef = match[1];
      return `postgres://postgres:${supabaseKey}@db.${projectRef}.supabase.co:5432/postgres`;
    }
  }

  // 3. 尝试从 .env.local 读取
  try {
    const envPath = path.join(__dirname, '../../.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');

      let supabaseUrl, supabaseKey;

      for (const line of lines) {
        if (line.startsWith('VITE_SUPABASE_URL=')) {
          supabaseUrl = line.split('=')[1];
        } else if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
          supabaseKey = line.split('=')[1];
        }
      }

      if (supabaseUrl && supabaseKey) {
        const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
        if (match) {
          const projectRef = match[1];
          return `postgres://postgres:${supabaseKey}@db.${projectRef}.supabase.co:5432/postgres`;
        }
      }
    }
  } catch (e) {
    // 忽略读取错误
  }

  return null;
}

// 主执行函数
async function main() {
  log('\n' + '='.repeat(60), 'blue');
  log('Civil AI Hub - 数据库索引自动执行脚本', 'blue');
  log('='.repeat(60) + '\n', 'blue');

  // 获取数据库 URL
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    error('无法获取数据库连接字符串!');
    info('\n请设置以下环境变量之一:');
    info('  • DATABASE_URL - PostgreSQL 连接字符串');
    info('  • SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
    info('\n或者直接修改 .env.local 文件\n');
    process.exit(1);
  }

  success('数据库连接已获取');
  info(`连接地址: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}\n`);

  // 强制使用 IPv4 连接
  const client = new Client({
    connectionString: databaseUrl,
    // 强制 IPv4，避免 IPv6 连接问题
    connectionTimeoutMillis: 10000
  });

  try {
    // 连接数据库
    info('正在连接数据库...');
    await client.connect();
    success('数据库连接成功!\n');

    // 检查表是否存在
    info('检查表结构...');
    const tablesResult = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('tools', 'user_favorites')
    `);

    const existingTables = tablesResult.rows.map(r => r.tablename);
    info(`找到表: ${existingTables.join(', ')}\n`);

    // 创建索引
    log('开始创建索引...\n', 'bright');

    const indexResults = [];

    for (let i = 0; i < indexes.length; i++) {
      const sql = indexes[i];
      const indexName = sql.match(/IF NOT EXISTS (\w+)/)?.[1] || `index_${i + 1}`;

      process.stdout.write(`  [${i + 1}/${indexes.length}] 创建 ${indexName}... `);

      try {
        const start = Date.now();
        await client.query(sql);
        const duration = Date.now() - start;

        success(`完成 (${duration}ms)`);
        indexResults.push({ name: indexName, status: 'success', duration });
      } catch (err) {
        error(`失败: ${err.message}`);
        indexResults.push({ name: indexName, status: 'error', error: err.message });
      }
    }

    // 创建 RPC 函数
    log('\n创建 RPC 函数...\n', 'bright');

    for (let i = 0; i < rpcFunctions.length; i++) {
      const sql = rpcFunctions[i];
      const funcName = sql.match(/CREATE OR REPLACE FUNCTION (\w+)/)?.[1] || `function_${i + 1}`;

      process.stdout.write(`  [${i + 1}/${rpcFunctions.length}] 创建 ${funcName}... `);

      try {
        const start = Date.now();
        await client.query(sql);
        const duration = Date.now() - start;

        success(`完成 (${duration}ms)`);
      } catch (err) {
        error(`失败: ${err.message}`);
      }
    }

    // 更新统计信息
    log('\n更新表统计信息...\n', 'bright');
    await client.query('ANALYZE tools');
    await client.query('ANALYZE user_favorites');
    success('统计信息更新完成\n');

    // 验证索引
    log('验证创建的索引...\n', 'bright');

    const verifyResult = await client.query(`
      SELECT
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) AS size,
        idx_scan AS scans,
        idx_tup_read AS tuples_read,
        idx_tup_fetch AS tuples_fetched
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('tools', 'user_favorites')
      ORDER BY tablename, indexname
    `);

    if (verifyResult.rows.length > 0) {
      log('\n索引列表:', 'bright');
      log('─────────────────────────────────────────────────────────────', 'cyan');

      for (const row of verifyResult.rows) {
        log(`  • ${row.indexname}`, 'cyan');
        log(`    大小: ${row.size} | 扫描: ${row.scans || 0}`, 'reset');
      }

      log('─────────────────────────────────────────────────────────────\n', 'cyan');
    }

    // 验证 RPC 函数
    const rpcVerifyResult = await client.query(`
      SELECT
        proname as name,
        pg_get_function_arguments(oid) as arguments
      FROM pg_proc
      WHERE proname IN ('increment_views', 'increment_views_batch')
        AND pronamespace = 'public'::regnamespace
    `);

    if (rpcVerifyResult.rows.length > 0) {
      log('RPC 函数列表:', 'bright');
      log('─────────────────────────────────────────────────────────────', 'cyan');

      for (const row of rpcVerifyResult.rows) {
        log(`  • ${row.name}(${row.arguments})`, 'cyan');
      }

      log('─────────────────────────────────────────────────────────────\n', 'cyan');
    }

    // 总结
    log('='.repeat(60), 'blue');
    const successCount = indexResults.filter(r => r.status === 'success').length;
    success(`执行完成! ${successCount}/${indexes.length} 个索引创建成功`);
    log('='.repeat(60) + '\n', 'blue');

  } catch (err) {
    error(`执行失败: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
    info('数据库连接已关闭\n');
  }
}

// 运行脚本
main().catch(err => {
  error(`未处理的错误: ${err.message}`);
  process.exit(1);
});
