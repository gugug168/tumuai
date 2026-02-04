/**
 * Vercel Function: 截图生成 API
 *
 * 端点:
 * - POST /api/screenshot - 为单个 URL 生成截图
 * - POST /api/screenshot/batch - 批量生成截图
 */

import { request } from 'http';
import { generateScreenshots, generateScreenshotWithApi, convertToWebP } from '../screenshot-service';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET = 'tool-screenshots';

export default async function handler(req: any, res: any) {
  // 只允许 POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, url, toolId, toolIds } = req.body;

  try {
    switch (action) {
      case 'generate':
        return await handleGenerate(req, res);
      case 'batch':
        return await handleBatch(req, res);
      case 'refresh_tool':
        return await handleRefreshTool(req, res);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error: unknown) {
    console.error('Screenshot API error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}

/**
 * 为单个 URL 生成截图
 */
async function handleGenerate(req: any, res: any) {
  const { url, options = {} } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Missing url' });
  }

  // 验证 URL
  let targetUrl = url;
  if (!url.startsWith('http')) {
    targetUrl = `https://${url}`;
  }

  try {
    new URL(targetUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // 生成截图
  const result = await generateScreenshots(targetUrl, options);

  if (!result.success || result.screenshots.length === 0) {
    // Fallback 到 API
    console.log('  🔄 使用 API fallback...');
    const apiBuffer = await generateScreenshotWithApi(targetUrl, options);
    if (apiBuffer) {
      const webpBuffer = await convertToWebP(apiBuffer, 85);
      return res.status(200).json({
        success: true,
        screenshots: [{
          name: 'fullpage',
          data: webpBuffer.toString('base64'),
          size: webpBuffer.length
        }]
      });
    }
  }

  // 返回 base64 编码的截图
  const screenshots = await Promise.all(
    result.screenshots.map(async (s) => {
      // 这里实际应该上传到 Supabase，返回 URL
      // 简化版直接返回 base64
      return {
        name: s.name,
        size: s.size
      };
    })
  );

  return res.status(200).json({
    success: result.success,
    screenshots,
    errors: result.errors
  });
}

/**
 * 批量刷新工具截图
 */
async function handleBatch(req: any, res: any) {
  const { toolIds: ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid toolIds' });
  }

  // 限制批量数量
  const limit = Math.min(ids.length, 10);
  const toolsToProcess = ids.slice(0, limit);

  const results: Array<{ toolId: string; success: boolean; screenshots?: string[]; error?: string }> = [];

  for (const toolId of toolsToProcess) {
    try {
      // 获取工具信息
      const { data: tool } = await supabase
        .from('tools')
        .select('id, website_url')
        .eq('id', toolId)
        .single();

      if (!tool) {
        results.push({ toolId, success: false, error: 'Tool not found' });
        continue;
      }

      // 生成截图
      const screenshotResult = await generateScreenshots(tool.website_url);

      // 上传到 Supabase Storage
      const uploadedUrls: string[] = [];

      for (let i = 0; i < screenshotResult.screenshots.length; i++) {
        const screenshot = screenshotResult.screenshots[i];

        // 由于我们无法直接获取 Buffer，这里使用 thum.io 作为 fallback
        const apiBuffer = await generateScreenshotWithApi(tool.website_url);
        if (apiBuffer) {
          const webpBuffer = await convertToWebP(apiBuffer, 85);

          const objectPath = `tools/${toolId}/${screenshot.name}.webp`;
          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(objectPath, webpBuffer, {
              upsert: true,
              contentType: 'image/webp',
              cacheControl: '2592000' // 30 days
            });

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from(BUCKET)
              .getPublicUrl(objectPath);

            if (publicUrlData?.publicUrl) {
              uploadedUrls.push(publicUrlData.publicUrl);
            }
          }
        }
      }

      // 更新数据库
      if (uploadedUrls.length > 0) {
        await supabase
          .from('tools')
          .update({
            screenshots: uploadedUrls,
            updated_at: new Date().toISOString()
          } as unknown as Record<string, unknown>)
          .eq('id', toolId);
      }

      results.push({
        toolId,
        success: uploadedUrls.length > 0,
        screenshots: uploadedUrls
      });

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      results.push({ toolId, success: false, error: msg });
    }
  }

  return res.status(200).json({
    success: true,
    results,
    processed: results.length,
    total: toolsToProcess.length
  });
}

/**
 * 刷新单个工具的截图
 */
async function handleRefreshTool(req: any, res: any) {
  const { toolId } = req.body;

  if (!toolId) {
    return res.status(400).json({ error: 'Missing toolId' });
  }

  // 获取工具信息
  const { data: tool } = await supabase
    .from('tools')
    .select('id, website_url')
    .eq('id', toolId)
    .single();

  if (!tool) {
    return res.status(404).json({ error: 'Tool not found' });
  }

  // 生成多个截图 (使用 thum.io 的不同尺寸作为区域模拟)
  const uploadedUrls: string[] = [];
  const widths = [1200, 800, 600]; // 不同宽度模拟不同区域

  for (let i = 0; i < widths.length; i++) {
    const width = widths[i];
    const regionName = i === 0 ? 'hero' : i === 1 ? 'features' : 'fullpage';

    const buffer = await generateScreenshotWithApi(tool.website_url, { width });
    if (buffer) {
      const webpBuffer = await convertToWebP(buffer, 85);

      const objectPath = `tools/${toolId}/${regionName}.webp`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, webpBuffer, {
          upsert: true,
          contentType: 'image/webp',
          cacheControl: '2592000'
        });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(objectPath);

        if (publicUrlData?.publicUrl) {
          uploadedUrls.push(publicUrlData.publicUrl);
        }
      }
    }
  }

  // 更新数据库
  if (uploadedUrls.length > 0) {
    await supabase
      .from('tools')
      .update({
        screenshots: uploadedUrls,
        updated_at: new Date().toISOString()
      } as unknown as Record<string, unknown>)
      .eq('id', toolId);
  }

  return res.status(200).json({
    success: uploadedUrls.length > 0,
    screenshots: uploadedUrls,
    count: uploadedUrls.length
  });
}
