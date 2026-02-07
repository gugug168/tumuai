/**
 * 测试脚本 - 单个工具截图
 *
 * 用法: node scripts/test-single-screenshot.js
 *
 * 只处理第一个工具，用于验证功能
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
const { captureRegionPngs } = require('./screenshot-utils');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET = 'tool-screenshots';

/**
 * 转换为 WebP
 */
async function convertToWebP(buffer, quality = 85) {
  const sharp = (await import('sharp')).default;
  return await sharp(buffer)
    .webp({ quality })
    .toBuffer();
}

/**
 * 为单个工具生成截图
 */
async function generateToolScreenshots(tool) {
  console.log(`\n📸 处理: ${tool.name} (${tool.website_url})`);
  console.log(`   ID: ${tool.id}`);

  const uploadedUrls = [];

  // 定义区域截图配置
  const regions = [
    { name: 'hero', width: 1200, height: 800 },
    { name: 'features', width: 1000, height: 800 },
    { name: 'pricing', width: 1000, height: 800 },
    { name: 'fullpage', width: 1200, height: 1200 }
  ];

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await context.newPage();

  const pngs = await captureRegionPngs(page, tool.website_url);
  await browser.close();

  if (!pngs) {
    console.log('    ❌ 无法生成截图（URL 无效或加载失败）');
    return 0;
  }

  const pngByRegion = {
    hero: pngs.hero,
    features: pngs.features,
    pricing: pngs.pricing,
    fullpage: pngs.fullpage
  };

  const version = Date.now();

  for (const region of regions) {
    try {
      console.log(`\n  - 生成 ${region.name} (${region.width}x${region.height})...`);

      const buffer = pngByRegion[region.name];

      if (!buffer || buffer.length === 0) {
        console.log(`    ⚠️  截图失败`);
        continue;
      }

      console.log(`    原始大小: ${(buffer.length / 1024).toFixed(1)} KB`);

      // 转换为 WebP
      const webpBuffer = await convertToWebP(buffer, 85);
      console.log(`    WebP 大小: ${(webpBuffer.length / 1024).toFixed(1)} KB`);
      console.log(`    压缩率: ${((1 - webpBuffer.length / buffer.length) * 100).toFixed(1)}%`);

      // 上传到 Supabase
      const objectPath = `tools/${tool.id}/${region.name}.webp`;
      console.log(`    上传路径: ${objectPath}`);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, webpBuffer, {
          upsert: true,
          contentType: 'image/webp',
          cacheControl: '2592000' // 30 days
        });

      if (uploadError) {
        console.log(`    ❌ 上传失败: ${uploadError.message}`);
        continue;
      }

      // 获取公共 URL
      const { data: publicUrlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(objectPath);

      if (publicUrlData?.publicUrl) {
        uploadedUrls.push(`${publicUrlData.publicUrl}?v=${version}`);
        console.log(`    ✅ 已上传: ${publicUrlData.publicUrl}`);
      }

    } catch (error) {
      console.log(`    ❌ ${region.name} 失败: ${error.message}`);
    }
  }

  // 更新数据库
  if (uploadedUrls.length > 0) {
    console.log(`\n  更新数据库...`);
    const { error: updateError } = await supabase
      .from('tools')
      .update({
        screenshots: uploadedUrls,
        updated_at: new Date().toISOString()
      })
      .eq('id', tool.id);

    if (updateError) {
      console.log(`  ❌ 数据库更新失败: ${updateError.message}`);
    } else {
      console.log(`  ✅ 数据库已更新 (${uploadedUrls.length} 张截图)`);
    }
  }

  return uploadedUrls.length;
}

/**
 * 主函数
 */
async function main() {
  console.log('🧪 测试模式 - 单个工具截图\n');
  console.log(`环境: ${supabaseUrl}`);
  console.log(`Bucket: ${BUCKET}\n`);

  // 只获取第一个已发布的工具
  const { data: tools, error } = await supabase
    .from('tools')
    .select('id, name, website_url')
    .eq('status', 'published')
    .limit(1);

  if (error) {
    console.error('❌ 获取工具列表失败:', error);
    process.exit(1);
  }

  if (!tools || tools.length === 0) {
    console.log('✅ 没有找到已发布的工具');
    process.exit(0);
  }

  const tool = tools[0];
  console.log(`📋 测试工具: ${tool.name}`);
  console.log(`   URL: ${tool.website_url}\n`);

  try {
    const count = await generateToolScreenshots(tool);

    console.log('\n' + '='.repeat(50));
    console.log('✅ 测试完成!');
    console.log('='.repeat(50));
    console.log(`生成截图: ${count} 张`);
    console.log('\n验证步骤:');
    console.log('1. 访问 Supabase Storage 检查文件');
    console.log('2. 查询数据库: SELECT screenshots FROM tools WHERE id = $1');
    console.log('3. 测试通过后运行: node scripts/refresh-screenshots.js');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

main().catch(console.error);
