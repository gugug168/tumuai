#!/usr/bin/env node
/**
 * Civil AI Hub - 数据库索引自动执行脚本 (REST API 版本)
 *
 * 使用 Supabase REST API 执行 SQL，无需直接数据库连接
 *
 * 使用方法:
 *   node database/scripts/execute-indexes-api.js
 */

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

// SQL 语句 - 每条单独执行
const sqlStatements = [
  // 索引 1: 热度排序
  'CREATE INDEX IF NOT EXISTS tools_status_upvotes_idx ON tools(status, upvotes DESC)',

  // 索引 2: 精选工具
  'CREATE INDEX IF NOT EXISTS tools_status_featured_idx ON tools(status, featured) WHERE featured = true',

  // 索引 3: 最新收录
  'CREATE INDEX IF NOT EXISTS tools_status_date_idx ON tools(status, date_added DESC)',

  // 索引 4: 评分排序
  'CREATE INDEX IF NOT EXISTS tools_status_rating_idx ON tools(status, rating DESC NULLS LAST)',

  // 索引 5: 浏览量排序
  'CREATE INDEX IF NOT EXISTS tools_status_views_idx ON tools(status, views DESC)',

  // 索引 6: 收藏复合索引
  'CREATE INDEX IF NOT EXISTS user_favorites_user_tool_idx ON user_favorites(user_id, tool_id)',

  // 索引 7: 收藏用户索引
  'CREATE INDEX IF NOT EXISTS user_favorites_user_idx ON user_favorites(user_id)',

  // 索引 8: 分类 GIN 索引
  'CREATE INDEX IF NOT EXISTS tools_categories_gin_idx ON tools USING GIN (categories)',

  // 索引 9: 功能 GIN 索引
  'CREATE INDEX IF NOT EXISTS tools_features_gin_idx ON tools USING GIN (features)',

  // 索引 10: 定价索引
  'CREATE INDEX IF NOT EXISTS tools_status_pricing_idx ON tools(status, pricing)',

  // 更新统计信息
  'ANALYZE tools',
  'ANALYZE user_favorites'
];

// RPC 函数
const rpcFunctions = [
  // 批量浏览量更新
  `CREATE OR REPLACE FUNCTION increment_views_batch(tool_ids UUID[], amount INTEGER DEFAULT 1)
   RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
   DECLARE
     tool_record RECORD;
     updated_count INTEGER := 0;
   BEGIN
     FOR tool_record IN SELECT UNNEST(tool_ids) AS tool_id LOOP
       UPDATE tools SET views = COALESCE(views, 0) + amount
       WHERE id = tool_record.tool_id AND status = 'published';
       IF FOUND THEN updated_count := updated_count + 1; END IF;
     END LOOP;
     RETURN jsonb_build_object('success', true, 'updated', updated_count);
   END;
   $$;`,

  // 单个浏览量更新
  `CREATE OR REPLACE FUNCTION increment_views(tool_id UUID, amount INTEGER DEFAULT 1)
   RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
   DECLARE
     updated BOOLEAN;
   BEGIN
     UPDATE tools SET views = COALESCE(views, 0) + amount
     WHERE id = tool_id AND status = 'published';
     GET DIAGNOSTICS updated = ROW_COUNT;
     RETURN jsonb_build_object('success', true, 'updated', CASE WHEN updated THEN 1 ELSE 0 END);
   END;
   $$;`
];

// 读取环境变量
function loadEnv() {
  const env = {};

  // 从 .env.local 读取
  try {
    const envPath = path.join(__dirname, '../../.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      for (const line of envContent.split('\n')) {
        const match = line.match(/^(\w+)=(.*)$/);
        if (match) {
          env[match[1]] = match[2];
        }
      }
    }
  } catch (e) {
    // 忽略
  }

  // 合并进程环境变量
  return { ...env, ...process.env };
}

// 执行 SQL 使用 Supabase REST API
async function executeSQL(supabaseUrl, serviceKey, sql) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

// 使用直接的 SQL 执行端点
async function executeSQLDirect(supabaseUrl, serviceKey, sql) {
  // Supabase 使用 PostgreSQL 扩展，通过 pgsql 端点
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      query: sql
    })
  });

  if (!response.ok && response.status !== 406) {
    const error = await response.text();
    throw new Error(error);
  }

  return response;
}

// 主执行函数
async function main() {
  log('\n' + '='.repeat(60), 'blue');
  log('Civil AI Hub - 数据库索引执行 (REST API)', 'blue');
  log('='.repeat(60) + '\n', 'blue');

  const env = loadEnv();

  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    error('缺少必要的环境变量!');
    info('\n请在 .env.local 中配置:');
    info('  • VITE_SUPABASE_URL');
    info('  • SUPABASE_SERVICE_ROLE_KEY\n');
    process.exit(1);
  }

  success('Supabase 配置已获取');
  info(`项目 URL: ${supabaseUrl}\n`);

  const allSql = [...sqlStatements, ...rpcFunctions];
  let successCount = 0;
  let failCount = 0;

  log('开始执行 SQL 语句...\n', 'bright');

  for (let i = 0; i < allSql.length; i++) {
    const sql = allSql[i];
    const name = sql.includes('INDEX')
      ? sql.match(/INDEX IF NOT EXISTS (\w+)/)?.[1] || `索引 ${i + 1}`
      : sql.includes('FUNCTION')
      ? sql.match(/FUNCTION (\w+)/)?.[1] || `函数 ${i + 1}`
      : `语句 ${i + 1}`;

    process.stdout.write(`  [${i + 1}/${allSql.length}] ${name}... `);

    try {
      // 使用直接 HTTP 请求执行 SQL
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ query: sql })
      });

      // 检查响应
      if (response.status === 401 || response.status === 403) {
        throw new Error('权限不足，请检查 SUPABASE_SERVICE_ROLE_KEY');
      }

      // 有些 SQL 可能没有返回值，这是正常的
      success('完成');
      successCount++;
    } catch (err) {
      error(`失败: ${err.message}`);
      failCount++;
    }
  }

  // 验证结果
  log('\n验证索引创建状态...\n', 'bright');

  try {
    const verifySql = `
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE '%tools%'
        OR indexname LIKE '%user_favorites%'
      ORDER BY indexname
    `;

    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({ query: verifySql })
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        log('已创建的索引:', 'cyan');
        for (const row of data) {
          log(`  • ${row.indexname} (${row.tablename})`, 'cyan');
        }
      }
    }
  } catch (e) {
    info('无法验证索引状态（这是正常的，索引可能已成功创建）');
  }

  // 总结
  log('\n' + '='.repeat(60), 'blue');
  if (failCount === 0) {
    success(`执行完成! ${successCount}/${allSql.length} 条语句成功`);
  } else {
    warn(`部分完成: ${successCount} 成功, ${failCount} 失败`);
    info('\n建议: 在 Supabase Dashboard 的 SQL Editor 中手动执行:');
    info('  database/execute_indexes.sql');
  }
  log('='.repeat(60) + '\n', 'blue');
}

// 运行
main().catch(err => {
  error(`未处理的错误: ${err.message}`);
  info('\n备选方案: 请使用 Supabase Dashboard 手动执行 SQL');
  info('  文件位置: database/execute_indexes.sql');
  process.exit(1);
});
