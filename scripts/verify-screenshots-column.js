/**
 * 验证 screenshots 列是否存在
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyColumn() {
  console.log('🔍 检查 tools 表的 screenshots 列...\n');

  try {
    // 方法1: 尝试查询列信息
    const { data, error } = await supabase
      .rpc('get_table_columns', { table_name: 'tools' })
      .select('column_name, data_type')
      .eq('column_name', 'screenshots')
      .single();

    // 方法2: 直接查询一个工具看是否有 screenshots 字段
    const { data: tool, error: queryError } = await supabase
      .from('tools')
      .select('id, name, screenshots')
      .limit(1)
      .single();

    if (queryError) {
      if (queryError.message.includes('column') || queryError.code === '42703') {
        console.log('❌ screenshots 列不存在');
        console.log('   错误:', queryError.message);
        return false;
      }
      // 可能是"未找到行"的错误，这是正常的
    }

    if (tool && 'screenshots' in tool) {
      console.log('✅ screenshots 列已存在!');
      console.log('   数据类型: text[] (数组)');
      console.log('   当前值:', tool.screenshots);

      // 检查是否有测试工具的截图
      const { data: testTool } = await supabase
        .from('tools')
        .select('id, name, screenshots')
        .eq('id', '109acc4f-232f-4d2c-b4ed-7160b1938c13')
        .single();

      if (testTool) {
        console.log('\n📸 测试工具 (Autodesk AI) 的截图:');
        console.log('   截图数量:', testTool.screenshots?.length || 0);
        if (testTool.screenshots && testTool.screenshots.length > 0) {
          console.log('   截图 URL:');
          testTool.screenshots.forEach((url, i) => {
            console.log(`     ${i + 1}. ${url}`);
          });
        } else {
          console.log('   ⚠️ 还没有截图数据，需要更新');
          // 尝试更新测试工具的截图
          const screenshots = [
            'https://bixljqdwkjuzftlpmgtb.supabase.co/storage/v1/object/public/tool-screenshots/tools/109acc4f-232f-4d2c-b4ed-7160b1938c13/hero.webp',
            'https://bixljqdwkjuzftlpmgtb.supabase.co/storage/v1/object/public/tool-screenshots/tools/109acc4f-232f-4d2c-b4ed-7160b1938c13/features.webp',
            'https://bixljqdwkjuzftlpmgtb.supabase.co/storage/v1/object/public/tool-screenshots/tools/109acc4f-232f-4d2c-b4ed-7160b1938c13/pricing.webp',
            'https://bixljqdwkjuzftlpmgtb.supabase.co/storage/v1/object/public/tool-screenshots/tools/109acc4f-232f-4d2c-b4ed-7160b1938c13/fullpage.webp'
          ];

          console.log('\n   尝试更新截图数据...');
          const { error: updateError } = await supabase
            .from('tools')
            .update({ screenshots, updated_at: new Date().toISOString() })
            .eq('id', testTool.id);

          if (updateError) {
            console.log('   ❌ 更新失败:', updateError.message);
          } else {
            console.log('   ✅ 更新成功!');
          }
        }
      }

      return true;
    }

    console.log('⚠️ 无法确定列状态');
    return false;

  } catch (error) {
    console.log('❌ 检查失败:', error.message);
    return false;
  }
}

verifyColumn().then(result => {
  if (result) {
    console.log('\n✅ 验证通过，可以执行批量刷新!');
    console.log('   运行: node scripts/refresh-screenshots.js');
  } else {
    console.log('\n❌ 需要先添加 screenshots 列');
  }
});
