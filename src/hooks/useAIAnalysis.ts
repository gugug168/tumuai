/**
 * useAIAnalysis Hook - AI 智能分析功能
 *
 * 从 SmartURLInput 组件中提取的 AI 分析逻辑
 */

import { useState, useCallback } from 'react';

// AI分析结果类型
export interface AIAnalysisResult {
  name: string;
  tagline: string;
  description: string;
  features: string[];
  pricing: 'Free' | 'Freemium' | 'Paid' | 'Trial';
  categories: string[];
  confidence: number;
  reasoning: string;
}

// AI响应类型
interface AISmartFillResponse {
  success: boolean;
  data?: AIAnalysisResult;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  apiUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
  metadata: {
    analysisTime: number;
    timestamp: string;
    websiteContentFetched: boolean;
    apiVersion: string;
  };
}

// 分析状态
export type AIAnalysisStatus = 'idle' | 'analyzing' | 'complete' | 'error';

export interface UseAIAnalysisOptions {
  enabled?: boolean;
  onComplete?: (data: AIAnalysisResult) => void;
}

export interface UseAIAnalysisResult {
  status: AIAnalysisStatus;
  data: AIAnalysisResult | null;
  error: string;
  cost: number;
  analyze: (url: string) => Promise<void>;
  reset: () => void;
}

/**
 * AI 分析 Hook
 */
export function useAIAnalysis(options: UseAIAnalysisOptions = {}): UseAIAnalysisResult {
  const { enabled = true, onComplete } = options;

  const [status, setStatus] = useState<AIAnalysisStatus>('idle');
  const [data, setData] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [cost, setCost] = useState(0);

  /**
   * 执行 AI 分析
   */
  const analyze = useCallback(async (url: string) => {
    if (!enabled || !url.trim()) return;

    try {
      setStatus('analyzing');
      setError('');

      const response = await fetch('/api/ai-smart-fill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          websiteUrl: url,
          includeContent: true
        })
      });

      // 检查响应状态
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = `API请求失败 (${response.status})`;

        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || errorData.error || errorMessage;
          } catch {
            // JSON解析失败，使用默认错误信息
          }
        } else {
          const textResponse = await response.text();
          console.error('Non-JSON API response:', textResponse.substring(0, 500));
          errorMessage = '服务器返回了非预期的响应格式';
        }

        throw new Error(errorMessage);
      }

      const result: AISmartFillResponse = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setCost(result.apiUsage.cost);
        setStatus('complete');

        // 触发完成回调
        onComplete?.(result.data);
      } else {
        setError(result.error?.message || 'AI分析失败');
        setStatus('error');
      }
    } catch (err) {
      console.error('AI Analysis Error:', err);
      setError('AI分析服务暂时不可用，请稍后重试');
      setStatus('error');
    }
  }, [enabled, onComplete]);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setStatus('idle');
    setData(null);
    setError('');
    setCost(0);
  }, []);

  return {
    status,
    data,
    error,
    cost,
    analyze,
    reset
  };
}

/**
 * 获取置信度颜色类名
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600 bg-green-100';
  if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
  return 'text-red-600 bg-red-100';
}

/**
 * 获取定价颜色类名
 */
export function getPricingColor(pricing: string): string {
  switch (pricing) {
    case 'Free': return 'bg-green-100 text-green-800';
    case 'Freemium': return 'bg-blue-100 text-blue-800';
    case 'Paid': return 'bg-red-100 text-red-800';
    case 'Trial': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}
