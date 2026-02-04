/**
 * 检查工具的 screenshots 数据
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkScreenshots() {
  console.log('🔍 检查数据库中的 screenshots 数据...\n');

  // 检查 nPlan
  const { data: nplan } = await supabase
    .from('tools')
    .select('id, name, screenshots')
    .eq('id', 'aa771ba5-2c10-4e30-b3f8-962612b28c8f')
    .single();

  console.log('📸 nPlan 截图数据:');
  console.log('   ID:', nplan?.id);
  console.log('   名称:', nplan?.name);
  console.log('   screenshots 字段:', JSON.stringify(nplan?.screenshots, null, 2));

  // 检查有几个工具有截图
  const { data: tools } = await supabase
    .from('tools')
    .select('id, name, screenshots')
    .not('screenshots', 'is', null);

  console.log('\n📊 有截图的工具数量:', tools?.length || 0);

  // 统计截图数量分布
  const { data: allTools } = await supabase
    .from('tools')
    .select('screenshots');

  const distribution = {};
  let withScreenshots = 0;
  let withoutScreenshots = 0;

  allTools?.forEach(tool => {
    const count = tool.screenshots?.length || 0;
    if (count > 0) {
      withScreenshots++;
      distribution[count] = (distribution[count] || 0) + 1;
    } else {
      withoutScreenshots++;
    }
  });

  console.log('\n📈 截图数量分布:');
  Object.entries(distribution).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([count, numTools]) => {
    console.log(`   ${count} 张截图: ${numTools} 个工具`);
  });
  console.log(`   0 张截图: ${withoutScreenshots} 个工具`);
  console.log(`   总计: ${withScreenshots} / ${allTools?.length || 0} 个工具有截图`);
}

checkScreenshots().catch(console.error);
