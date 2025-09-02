// AI智能填入模拟测试API
// 用于测试端到端工作流，无需真实DeepSeek API密钥

import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * CORS配置
 */
function setCORSHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * 模拟AI分析结果生成
 */
function generateMockAnalysis(url: string, content?: string) {
  const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
  
  // 根据域名生成模拟数据
  const mockData = {
    'chatgpt.com': {
      name: 'ChatGPT',
      tagline: '强大的AI聊天助手，支持多种任务',
      description: 'OpenAI开发的大语言模型，可以回答问题、写作、编程、翻译等多种任务，支持自然语言对话交互。',
      features: ['自然语言对话', '代码生成', '文本创作', '多语言翻译', '问题解答'],
      pricing: 'Freemium',
      categories: ['聊天机器人', '文本生成', '代码助手']
    },
    'claude.ai': {
      name: 'Claude',
      tagline: 'Anthropic的AI助手，安全可靠',
      description: 'Anthropic开发的AI助手，注重安全性和有用性，能够进行深入的对话、分析和创作任务。',
      features: ['安全对话', '文档分析', '代码理解', '创意写作', '逻辑推理'],
      pricing: 'Freemium',
      categories: ['聊天机器人', '文档处理', '分析工具']
    },
    'github.com': {
      name: 'GitHub',
      tagline: '全球最大的代码托管平台',
      description: '微软旗下的代码托管和协作平台，支持版本控制、项目管理、CI/CD等开发工具链。',
      features: ['代码托管', '版本控制', '协作开发', 'CI/CD', '项目管理'],
      pricing: 'Freemium',
      categories: ['开发工具', '版本控制', '协作平台']
    }
  };
  
  // 默认数据
  const defaultData = {
    name: '未知工具',
    tagline: '基于网站分析的智能工具',
    description: '这是一个通过AI分析网站内容自动生成的工具描述，请手动完善相关信息。',
    features: ['智能功能', '网站服务'],
    pricing: 'Freemium',
    categories: ['AI工具', '网络服务']
  };
  
  const toolData = mockData[domain] || defaultData;
  
  return {
    ...toolData,
    confidence: 0.85,
    reasoning: `基于域名 ${domain} 和${content ? '网站内容' : 'URL'}分析生成`
  };
}

/**
 * 模拟网站内容抓取
 */
async function mockFetchWebsiteContent(url: string): Promise<string | null> {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
  
  const mockContent = {
    'chatgpt.com': 'ChatGPT | OpenAI - AI chat assistant for conversations and tasks',
    'claude.ai': 'Claude | Anthropic - Constitutional AI assistant for safe conversations', 
    'github.com': 'GitHub - Build and ship software on a single, collaborative platform'
  };
  
  return mockContent[domain] || `Mock content for ${domain}`;
}

/**
 * 模拟AI智能填入API处理函数
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { websiteUrl, includeContent = true } = req.body;
    
    if (!websiteUrl) {
      return res.status(400).json({ 
        error: 'websiteUrl is required',
        code: 'MISSING_URL'
      });
    }
    
    // URL验证
    try {
      new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Invalid URL format',
        code: 'INVALID_URL'
      });
    }
    
    console.log(`[MOCK] Analyzing: ${websiteUrl}`);
    
    // 模拟网站内容抓取
    let websiteContent = null;
    if (includeContent) {
      websiteContent = await mockFetchWebsiteContent(websiteUrl);
    }
    
    // 模拟AI分析延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 生成模拟分析结果
    const analysisData = generateMockAnalysis(websiteUrl, websiteContent);
    
    const responseTime = Date.now() - startTime;
    
    const mockResponse = {
      success: true,
      data: analysisData,
      apiUsage: {
        promptTokens: 150,
        completionTokens: 200,
        totalTokens: 350,
        cost: 0.003 // 模拟成本
      },
      metadata: {
        analysisTime: responseTime,
        timestamp: new Date().toISOString(),
        websiteContentFetched: !!websiteContent,
        apiVersion: '1.0-mock'
      }
    };
    
    console.log(`[MOCK] Analysis completed in ${responseTime}ms`);
    res.status(200).json(mockResponse);
    
  } catch (error) {
    console.error('[MOCK] Error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'MOCK_ERROR',
        message: 'Mock API simulation error',
        retryable: true
      },
      apiUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0
      },
      metadata: {
        analysisTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        websiteContentFetched: false,
        apiVersion: '1.0-mock'
      }
    });
  }
}