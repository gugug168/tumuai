/**
 * 批量刷新所有工具截图
 *
 * 用法: node scripts/refresh-screenshots.js
 *
 * 功能:
 * 1. 获取所有已发布的工具
 * 2. 为每个工具生成多张 WebP 截图
 * 3. 上传到 Supabase Storage
 * 4. 更新数据库
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
async function generateToolScreenshots(tool, context) {
  console.log(`\n📸 处理: ${tool.name} (${tool.website_url})`);

  const uploadedUrls = [];

  // 定义区域截图配置
  const regions = [
    { name: 'hero', width: 1200, height: 800 },
    { name: 'features', width: 1000, height: 800 },
    { name: 'pricing', width: 1000, height: 800 },
    { name: 'fullpage', width: 1200, height: 1200 }
  ];

  const page = await context.newPage();
  let pngs = null;
  try {
    pngs = await captureRegionPngs(page, tool.website_url);
  } catch (error) {
    console.log(`  ❌ 页面加载/截图失败: ${error.message}`);
  } finally {
    await page.close().catch(() => {});
  }

  if (!pngs) {
    console.log('  ⚠️  跳过：未生成截图');
    return 0;
  }

  const pngByRegion = {
    hero: pngs.hero,
    features: pngs.features,
    pricing: pngs.pricing,
    fullpage: pngs.fullpage
  };

  // Cache-bust query for immediate refresh after upsert.
  const version = Date.now();

  for (const region of regions) {
    try {
      console.log(`  - 生成 ${region.name} (${region.width}x${region.height})...`);

      const buffer = pngByRegion[region.name];

      if (!buffer || buffer.length === 0) {
        console.log(`    ⚠️  截图失败`);
        continue;
      }

      // 转换为 WebP
      const webpBuffer = await convertToWebP(buffer, 85);
      console.log(`    ✅ WebP: ${(webpBuffer.length / 1024).toFixed(1)} KB`);

      // 上传到 Supabase
      const objectPath = `tools/${tool.id}/${region.name}.webp`;
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
        console.log(`    ✅ 已上传: ${objectPath}`);
      }

    } catch (error) {
      console.log(`    ❌ ${region.name} 失败: ${error.message}`);
    }
  }

  // 更新数据库
  if (uploadedUrls.length > 0) {
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
      console.log(`  ✅ 已更新数据库 (${uploadedUrls.length} 张截图)`);
    }
  }

  return uploadedUrls.length;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始批量刷新工具截图...\n');

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ 缺少 SUPABASE 配置（SUPABASE_URL/VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY）');
    process.exit(1);
  }

  // 获取所有已发布的工具
  const { data: tools, error } = await supabase
    .from('tools')
    .select('id, name, website_url')
    .eq('status', 'published')
    .order('date_added', { ascending: false });

  if (error) {
    console.error('❌ 获取工具列表失败:', error);
    process.exit(1);
  }

  if (!tools || tools.length === 0) {
    console.log('✅ 没有需要处理的工具');
    process.exit(0);
  }

  console.log(`📋 找到 ${tools.length} 个工具\n`);

  const limitEnv = parseInt(process.env.SCREENSHOT_LIMIT || '', 10);
  const toolsToProcess = Number.isFinite(limitEnv) && limitEnv > 0 ? tools.slice(0, limitEnv) : tools;

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });

  // 统计
  let successCount = 0;
  let totalScreenshots = 0;
  const errors = [];

  // 批量处理 (每 5 个一组，避免过载)
  const batchSize = 5;
  for (let i = 0; i < toolsToProcess.length; i += batchSize) {
    const batch = toolsToProcess.slice(i, i + batchSize);
    console.log(`\n${'='.repeat(50)}`);
    console.log(`批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(toolsToProcess.length / batchSize)}`);
    console.log(`${'='.repeat(50)}`);

    for (const tool of batch) {
      try {
        const count = await generateToolScreenshots(tool, context);
        if (count > 0) {
          successCount++;
          totalScreenshots += count;
        }
      } catch (error) {
        console.log(`  ❌ ${tool.name} 处理失败: ${error.message}`);
        errors.push({ tool: tool.name, error: error.message });
      }
    }

    // 批次间延迟
    if (i + batchSize < toolsToProcess.length) {
      console.log('\n⏳ 等待 2 秒后继续...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  await context.close().catch(() => {});
  await browser.close().catch(() => {});

  // 总结
  console.log('\n' + '='.repeat(50));
  console.log('📊 处理完成!');
  console.log('='.repeat(50));
  console.log(`✅ 成功: ${successCount}/${toolsToProcess.length} 个工具`);
  console.log(`📸 截图: ${totalScreenshots} 张`);
  console.log(`❌ 失败: ${errors.length} 个`);

  if (errors.length > 0) {
    console.log('\n❌ 失败列表:');
    errors.forEach(e => console.log(`  - ${e.tool}: ${e.error}`));
  }
}

main().catch(console.error);
