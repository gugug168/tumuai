// AI智能填入 API - Vercel Functions
// 基于DeepSeek的网站内容分析和自动填入服务

import { DeepSeekClient, SmartFillRequest, SmartFillResponse } from '../src/lib/deepseek-client';
import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * CORS配置 - 允许前端调用
 */
function setCORSHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * 简单的网站内容抓取
 * 
 * 注意事项:
 * - 仅抓取基本HTML内容
 * - 超时控制防止长时间等待
 * - 错误处理保证服务可用性
 */
async function fetchWebsiteContent(url: string): Promise<string | null> {
  try {
    // 添加协议前缀
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
    
    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // 提取页面标题和描述
    const titleMatch = html.match(/<title[^>]*>([^<]+)</i);
    const descMatch = html.match(/<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"']+)["\'][^>]*>/i);
    const h1Match = html.match(/<h1[^>]*>([^<]+)</i);
    
    const title = titleMatch ? titleMatch[1].trim() : '';
    const description = descMatch ? descMatch[1].trim() : '';
    const h1 = h1Match ? h1Match[1].trim() : '';
    
    // 组合关键信息
    const content = [title, h1, description].filter(Boolean).join(' | ');
    return content || html.slice(0, 1000); // 兜底：返回前1000字符
    
  } catch (error) {
    console.error('Website fetch error:', error);
    return null;
  }
}

/**
 * 记录API性能数据
 */
async function logPerformance(endpoint: string, responseTime: number, statusCode: number) {
  try {
    // 这里可以记录到数据库或监控系统
    console.log(`API Performance: ${endpoint} - ${responseTime}ms - ${statusCode}`);
    
    // 如果需要持久化，可以调用 performance-analytics API
    // await fetch('/api/performance-analytics', {
    //   method: 'POST',
    //   body: JSON.stringify({ endpoint, responseTime, statusCode })
    // });
  } catch (error) {
    console.error('Failed to log performance:', error);
  }
}

/**
 * 主要的 API 处理函数
 * 
 * 功能:
 * 1. 接收网站URL和可选参数
 * 2. 抓取网站内容（如果需要）
 * 3. 调用 DeepSeek API 分析
 * 4. 返回结构化的工具信息
 * 5. 记录性能和错误日志
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  // 处理 CORS 预检请求
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 仅允许 POST 请求
  if (req.method !== 'POST') {
    await logPerformance('ai-smart-fill', Date.now() - startTime, 405);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // 1. 验证请求参数
    const { websiteUrl, includeContent = true, existingTool }: {
      websiteUrl: string;
      includeContent?: boolean;
      existingTool?: { name: string; description: string; };
    } = req.body;
    
    if (!websiteUrl) {
      await logPerformance('ai-smart-fill', Date.now() - startTime, 400);
      return res.status(400).json({ 
        error: 'websiteUrl is required',
        code: 'MISSING_URL'
      });
    }
    
    // 2. URL 格式验证
    try {
      new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
    } catch (error) {
      await logPerformance('ai-smart-fill', Date.now() - startTime, 400);
      return res.status(400).json({ 
        error: 'Invalid URL format',
        code: 'INVALID_URL'
      });
    }
    
    // 3. 抓取网站内容（可选）
    let websiteContent = null;
    if (includeContent) {
      console.log(`Fetching content for: ${websiteUrl}`);
      websiteContent = await fetchWebsiteContent(websiteUrl);
      
      if (!websiteContent) {
        console.warn(`Failed to fetch content for ${websiteUrl}, proceeding with URL only`);
      }
    }
    
    // 4. 初始化 DeepSeek 客户端
    const deepseekClient = new DeepSeekClient({
      apiKey: process.env.DEEPSEEK_API_KEY,
      maxTokens: 2000, // 控制成本
      temperature: 0.2, // 提高一致性
    });
    
    // 5. 构建分析请求
    const analysisRequest: SmartFillRequest = {
      websiteUrl,
      websiteContent: websiteContent || undefined,
      existingTool
    };
    
    // 6. 调用 AI 分析
    console.log(`Analyzing tool for: ${websiteUrl}`);
    const analysisResult: SmartFillResponse = await deepseekClient.analyzeWebsiteForTool(analysisRequest);
    
    // 7. 记录性能和成本
    const responseTime = Date.now() - startTime;
    await logPerformance('ai-smart-fill', responseTime, analysisResult.success ? 200 : 500);
    
    // 8. 添加元数据
    const response = {
      ...analysisResult,
      metadata: {
        analysisTime: responseTime,
        timestamp: new Date().toISOString(),
        websiteContentFetched: !!websiteContent,
        apiVersion: '1.0'
      }
    };
    
    // 9. 返回结果
    const statusCode = analysisResult.success ? 200 : 500;
    res.status(statusCode).json(response);
    
    // 记录成功分析
    if (analysisResult.success) {
      console.log(`Successfully analyzed ${websiteUrl}:`, {
        name: analysisResult.data?.name,
        confidence: analysisResult.data?.confidence,
        cost: analysisResult.apiUsage.cost
      });
    }
    
  } catch (error) {
    // 统一错误处理
    console.error('AI Smart Fill API Error:', error);
    
    const responseTime = Date.now() - startTime;
    await logPerformance('ai-smart-fill', responseTime, 500);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error occurred',
        retryable: true
      },
      apiUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0
      },
      metadata: {
        analysisTime: responseTime,
        timestamp: new Date().toISOString(),
        websiteContentFetched: false,
        apiVersion: '1.0'
      }
    });
  }
}

/**
 * API 健康检查端点 (GET 请求)
 * 
 * 用途:
 * - 验证 DeepSeek API 连接状态
 * - 监控服务可用性
 * - 调试配置问题
 */
export async function healthCheck(req: VercelRequest, res: VercelResponse) {
  setCORSHeaders(res);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const deepseekClient = new DeepSeekClient({
      apiKey: process.env.DEEPSEEK_API_KEY,
    });
    
    const healthResult = await deepseekClient.healthCheck();
    
    res.status(healthResult.status === 'ok' ? 200 : 500).json({
      status: healthResult.status,
      message: healthResult.message,
      timestamp: new Date().toISOString(),
      version: '1.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Health check failed: ${error}`,
      timestamp: new Date().toISOString(),
      version: '1.0'
    });
  }
}