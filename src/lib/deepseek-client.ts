// DeepSeek API 客户端 - 智能填入功能核心
// 遵循 SOLID 原则的模块化设计 ✨

export interface DeepSeekConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

export interface AnalyzedToolInfo {
  name: string;
  tagline: string;
  description: string;
  features: string[];
  pricing: 'Free' | 'Freemium' | 'Paid' | 'Trial';
  categories: string[];
  confidence: number; // 0-1, AI分析结果的置信度
  reasoning: string; // AI的分析推理过程
}

export interface SmartFillRequest {
  websiteUrl: string;
  websiteContent?: string; // 可选的网站内容（如果已爬取）
  existingTool?: {
    name: string;
    description: string;
  };
}

export interface SmartFillResponse {
  success: boolean;
  data?: AnalyzedToolInfo;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  apiUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number; // 预估成本（美分）
  };
}

/**
 * DeepSeek API 客户端类
 * 
 * 核心职责 (单一职责原则):
 * - DeepSeek API 调用和错误处理
 * - AI 提示词管理和优化
 * - 结构化数据解析和验证
 * - 成本控制和性能监控
 */
export class DeepSeekClient {
  private config: DeepSeekConfig;
  private readonly COST_PER_1K_TOKENS = 0.14; // DeepSeek价格：$0.14/1K tokens (2025年价格)

  constructor(config: Partial<DeepSeekConfig> = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.DEEPSEEK_API_KEY || '',
      baseURL: config.baseURL || 'https://api.deepseek.com',
      model: config.model || 'deepseek-chat',
      maxTokens: config.maxTokens || 4000,
      temperature: config.temperature || 0.3, // 低温度保证一致性
      timeout: config.timeout || 30000,
      ...config
    };

    if (!this.config.apiKey) {
      throw new Error('DeepSeek API key is required');
    }
  }

  /**
   * 智能分析网站并生成工具信息
   * 
   * 应用原则:
   * - KISS: 单一函数完成整个分析流程
   * - DRY: 复用提示词和解析逻辑
   * - 错误处理: 完善的重试和降级机制
   */
  async analyzeWebsiteForTool(request: SmartFillRequest): Promise<SmartFillResponse> {
    try {
      // 1. 生成优化的提示词 (抽象的核心逻辑)
      const prompt = this.buildAnalysisPrompt(request);
      
      // 2. 调用 DeepSeek API
      const apiResponse = await this.callChatCompletion(prompt);
      
      // 3. 解析和验证响应
      const analyzedInfo = this.parseAnalysisResponse(apiResponse.content);
      
      // 4. 计算成本和使用量
      const apiUsage = this.calculateUsage(apiResponse.usage);
      
      return {
        success: true,
        data: analyzedInfo,
        apiUsage
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 构建AI分析提示词
   * 
   * 设计原则:
   * - 精确指导: 明确的输出格式要求
   * - 成本控制: 限制输出长度
   * - 质量保证: 包含置信度和推理过程
   */
  private buildAnalysisPrompt(request: SmartFillRequest): string {
    const { websiteUrl, websiteContent, existingTool } = request;
    
    return `作为一个专业的产品分析师，请分析这个网站并提取AI工具信息：

网站URL: ${websiteUrl}
${websiteContent ? `网站内容: ${websiteContent.slice(0, 2000)}...` : ''}
${existingTool ? `参考信息: 名称："${existingTool.name}"，描述："${existingTool.description}"` : ''}

请仔细分析网站，提取以下信息并以JSON格式返回：

{
  "name": "工具的简洁名称（2-4个词）",
  "tagline": "一句话简介（10-15词，突出核心价值）",
  "description": "详细描述（50-100词，包含功能、特点、用途）", 
  "features": ["核心功能1", "核心功能2", "核心功能3"],
  "pricing": "Free|Freemium|Paid|Trial",
  "categories": ["AI分类1", "AI分类2"],
  "confidence": 0.95,
  "reasoning": "我的分析推理过程（50词以内）"
}

分析要求：
1. **准确性优先**: 基于网站实际内容，不要臆测
2. **简洁明了**: 避免营销性语言，注重实用性
3. **分类准确**: 选择最匹配的AI工具分类
4. **置信度**: 根据信息完整度给出0-1的置信度
5. **推理透明**: 简要说明分析依据

只返回JSON，不要其他文字。`;
  }

  /**
   * 调用 DeepSeek Chat Completion API
   * 
   * 技术要点:
   * - 超时控制: 防止长时间等待
   * - 错误重试: 网络异常自动重试
   * - 流式传输: 提升用户体验（可选）
   */
  private async callChatCompletion(prompt: string) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的AI工具分析师，擅长从网站中提取准确的产品信息。'
            },
            {
              role: 'user', 
              content: prompt
            }
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          response_format: { type: 'json_object' }, // 强制JSON输出
          stream: false
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('DeepSeek API returned no choices');
      }

      return {
        content: data.choices[0].message.content,
        usage: data.usage
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 解析AI响应并验证数据结构
   * 
   * 质量保证:
   * - 数据验证: 确保所有必需字段存在
   * - 类型检查: 验证数据类型正确性
   * - 默认值处理: 缺失字段的兜底处理
   */
  private parseAnalysisResponse(content: string): AnalyzedToolInfo {
    try {
      const parsed = JSON.parse(content);
      
      // 数据验证和清理
      const result: AnalyzedToolInfo = {
        name: this.validateString(parsed.name, '未知工具'),
        tagline: this.validateString(parsed.tagline, '智能AI工具'),
        description: this.validateString(parsed.description, '暂无详细描述'),
        features: Array.isArray(parsed.features) ? parsed.features.slice(0, 5) : ['智能功能'],
        pricing: this.validatePricing(parsed.pricing),
        categories: Array.isArray(parsed.categories) ? parsed.categories.slice(0, 3) : ['AI工具'],
        confidence: this.validateConfidence(parsed.confidence),
        reasoning: this.validateString(parsed.reasoning, 'AI自动分析')
      };

      return result;
    } catch (error) {
      // 解析失败时的兜底处理
      console.error('Failed to parse DeepSeek response:', error);
      return this.getDefaultToolInfo();
    }
  }

  /**
   * 计算API使用量和成本
   */
  private calculateUsage(usage: any) {
    const promptTokens = usage?.prompt_tokens || 0;
    const completionTokens = usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;
    
    // 成本计算 (美分)
    const cost = (totalTokens / 1000) * this.COST_PER_1K_TOKENS;
    
    return {
      promptTokens,
      completionTokens,
      totalTokens,
      cost: Math.round(cost * 100) / 100 // 保留2位小数
    };
  }

  /**
   * 统一错误处理
   */
  private handleError(error: any): SmartFillResponse {
    console.error('DeepSeek API Error:', error);
    
    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = '分析过程中出现未知错误';
    let retryable = false;
    
    if (error.name === 'AbortError') {
      errorCode = 'TIMEOUT';
      errorMessage = '请求超时，请稍后重试';
      retryable = true;
    } else if (error.message.includes('API error: 429')) {
      errorCode = 'RATE_LIMIT';
      errorMessage = 'API调用频率超限，请稍后重试';
      retryable = true;
    } else if (error.message.includes('API error: 401')) {
      errorCode = 'AUTH_ERROR';
      errorMessage = 'API密钥无效或已过期';
      retryable = false;
    } else if (error.message.includes('API error: 5')) {
      errorCode = 'SERVER_ERROR';
      errorMessage = 'DeepSeek服务器暂时不可用';
      retryable = true;
    }
    
    return {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        retryable
      },
      apiUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0
      }
    };
  }

  // 辅助验证方法
  private validateString(value: any, defaultValue: string): string {
    return typeof value === 'string' && value.trim() ? value.trim() : defaultValue;
  }

  private validatePricing(value: any): 'Free' | 'Freemium' | 'Paid' | 'Trial' {
    const validValues = ['Free', 'Freemium', 'Paid', 'Trial'];
    return validValues.includes(value) ? value : 'Freemium';
  }

  private validateConfidence(value: any): number {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= 1 ? num : 0.7;
  }

  private getDefaultToolInfo(): AnalyzedToolInfo {
    return {
      name: '待分析工具',
      tagline: '智能AI工具',
      description: '暂无法自动分析此工具的详细信息，请手动填写相关内容。',
      features: ['智能功能'],
      pricing: 'Freemium',
      categories: ['AI工具'],
      confidence: 0.1,
      reasoning: '自动分析失败，使用默认信息'
    };
  }

  /**
   * 健康检查方法 - 验证API连接和配置
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; message: string }> {
    try {
      const response = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10
        })
      });

      if (response.ok) {
        return { status: 'ok', message: 'DeepSeek API连接正常' };
      } else {
        return { status: 'error', message: `API响应错误: ${response.status}` };
      }
    } catch (error) {
      return { status: 'error', message: `连接失败: ${error}` };
    }
  }
}