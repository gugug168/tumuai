/**
 * AI智能填入功能：智能URL输入框组件
 * 支持实时重复检测、URL验证和友好的状态提示
 *
 * 已重构为模块化结构，提升可维护性：
 * - 使用 useDuplicateCheck hook 处理重复检测
 * - 使用 useAIAnalysis hook 处理 AI 分析
 * - 子组件分离：DuplicateWarningPanel, AIAnalysisResultPanel
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Globe,
  ExternalLink,
  Clock,
  Loader2,
  Info,
  Sparkles,
  Wand2,
  AlertCircle as AlertCircleIcon
} from 'lucide-react';

import { useDuplicateCheck, CheckStatus, type DuplicateInfo } from '../hooks/useDuplicateCheck';
import { useAIAnalysis, AIAnalysisStatus, type AIAnalysisResult, getConfidenceColor, getPricingColor } from '../hooks/useAIAnalysis';
import { getBestDisplayLogoUrl } from '../lib/logoUtils';

// 导出 hooks 的类型供外部使用
export type { CheckStatus, DuplicateInfo, AIAnalysisResult, AIAnalysisStatus };
export { useDuplicateCheck, useAIAnalysis };

// 重复网站警告面板组件
const DuplicateWarningPanel: React.FC<{
  tool: NonNullable<DuplicateInfo['tool']>
}> = ({ tool }) => (
  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
    <div className="flex items-start space-x-3">
      <div className="flex-shrink-0">
        <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-800 mb-2">
              该网站已存在于平台
            </h4>

            <div className="space-y-2">
              {/* 工具信息 */}
              <div className="flex items-center space-x-2">
                <img
                  src={getBestDisplayLogoUrl(tool.logo_url, tool.name, tool.categories || [])}
                  alt={tool.name}
                  className="w-5 h-5 rounded object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="font-medium text-red-900 text-sm">{tool.name}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  tool.status === 'published'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {tool.status === 'published' ? '已发布' : '待审核'}
                </span>
              </div>

              {/* 工具描述 */}
              {tool.tagline && (
                <p className="text-sm text-red-700 leading-relaxed">
                  {tool.tagline}
                </p>
              )}

              {/* 分类标签 */}
              {tool.categories && tool.categories.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tool.categories.slice(0, 3).map((category, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-100 text-red-700"
                    >
                      {category}
                    </span>
                  ))}
                  {tool.categories.length > 3 && (
                    <span className="text-xs text-red-600">
                      +{tool.categories.length - 3} 更多
                    </span>
                  )}
                </div>
              )}

              {/* 添加时间 */}
              <p className="text-xs text-red-600">
                添加时间: {new Date(tool.created_at).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`/tools/${tool.id}`}
            className="inline-flex items-center space-x-1 text-sm text-red-600 hover:text-red-800 transition-colors"
          >
            <span>查看工具详情</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <a
            href={tool.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 text-sm text-red-600 hover:text-red-800 transition-colors"
          >
            <span>访问原网站</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  </div>
);

// AI分析结果面板组件
const AIAnalysisResultPanel: React.FC<{
  data: AIAnalysisResult;
  cost: number;
}> = ({ data, cost }) => {
  return (
    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <Sparkles className="w-5 h-5 text-purple-500 mt-0.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-3">
            <h4 className="text-sm font-semibold text-purple-800">
              AI智能分析结果
            </h4>
            <div className="flex items-center space-x-2 text-xs">
              <span className={`px-2 py-1 rounded-full font-medium ${getConfidenceColor(data.confidence)}`}>
                置信度: {Math.round(data.confidence * 100)}%
              </span>
              {cost > 0 && (
                <span className="text-gray-500">
                  成本: ${cost.toFixed(3)}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {/* 基本信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  工具名称
                </label>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {data.name}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  定价模式
                </label>
                <span className={`mt-1 inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPricingColor(data.pricing)}`}>
                  {data.pricing}
                </span>
              </div>
            </div>

            {/* 标语 */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                产品标语
              </label>
              <p className="mt-1 text-sm text-gray-800 leading-relaxed">
                {data.tagline}
              </p>
            </div>

            {/* 描述 */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                详细描述
              </label>
              <p className="mt-1 text-sm text-gray-700 leading-relaxed">
                {data.description}
              </p>
            </div>

            {/* 功能特性 */}
            {data.features && data.features.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  核心功能
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.features.map((feature, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-purple-100 text-purple-800"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 分类标签 */}
            {data.categories && data.categories.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  工具分类
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.categories.map((category, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-indigo-100 text-indigo-800"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI推理过程 */}
            {data.reasoning && (
              <div className="pt-3 border-t border-purple-200">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  AI分析推理
                </label>
                <p className="mt-1 text-xs text-gray-600 italic">
                  {data.reasoning}
                </p>
              </div>
            )}

            {/* 操作提示 */}
            <div className="pt-2 border-t border-purple-200">
              <div className="flex items-center space-x-1 text-xs text-purple-600">
                <Info className="w-3 h-3" />
                <span>AI已为您智能填入信息，请在表单中确认并完善细节</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SmartURLInputProps {
  value: string;
  onChange: (url: string) => void;
  onDuplicateChange: (info: DuplicateInfo) => void;
  onAIFillComplete?: (data: AIAnalysisResult) => void;
  enableAIFill?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * SmartURLInput 组件
 *
 * 功能:
 * - URL 格式验证
 * - 重复检测（防抖）
 * - AI 智能填入
 * - 友好的状态提示
 */
const SmartURLInput: React.FC<SmartURLInputProps> = ({
  value,
  onChange,
  onDuplicateChange,
  onAIFillComplete,
  enableAIFill = true,
  placeholder = '输入工具网站地址，如：https://chatgpt.com',
  disabled = false,
  className = ''
}) => {
  // 重复检测
  const {
    status: checkStatus,
    duplicateInfo,
    displayURL,
    errorMessage,
    processingTime,
    check: checkDuplicate
  } = useDuplicateCheck({
    onDuplicateFound: onDuplicateChange,
    onValid: onDuplicateChange
  });

  // AI 分析
  const {
    status: aiStatus,
    data: aiAnalysisData,
    error: aiError,
    cost: aiCost,
    analyze: analyzeWithAI
  } = useAIAnalysis({
    enabled: enableAIFill,
    onComplete: onAIFillComplete
  });

  // 控制 AI 按钮显示
  const [showAIButton, setShowAIButton] = useState(false);

  // 监听 URL 变化触发检测
  useEffect(() => {
    checkDuplicate(value);
  }, [value, checkDuplicate]);

  // 根据检测状态更新 AI 按钮显示
  useEffect(() => {
    if (checkStatus === 'valid') {
      setShowAIButton(enableAIFill);
    } else {
      setShowAIButton(false);
    }
  }, [checkStatus, enableAIFill]);

  /**
   * 处理 AI 分析按钮点击
   */
  const handleAIAnalyze = useCallback(() => {
    analyzeWithAI(value);
  }, [value, analyzeWithAI]);

  /**
   * 获取状态图标
   */
  const getStatusIcon = () => {
    const iconProps = { className: "w-5 h-5" };

    if (aiStatus === 'analyzing') {
      return <Wand2 className="w-5 h-5 animate-pulse text-purple-500" />;
    }
    if (aiStatus === 'complete') {
      return <Sparkles {...iconProps} className="w-5 h-5 text-purple-500" />;
    }

    switch (checkStatus) {
      case 'checking':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      case 'valid':
        return <CheckCircle {...iconProps} className="w-5 h-5 text-green-500" />;
      case 'duplicate':
        return <XCircle {...iconProps} className="w-5 h-5 text-red-500" />;
      case 'invalid':
        return <AlertTriangle {...iconProps} className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <AlertTriangle {...iconProps} className="w-5 h-5 text-red-500" />;
      default:
        return <Globe {...iconProps} className="w-5 h-5 text-gray-400" />;
    }
  };

  /**
   * 获取输入框样式
   */
  const getInputStyle = () => {
    const baseStyle = `w-full rounded-lg border px-4 py-3 pr-12 transition-all duration-200 focus:ring-2 focus:ring-offset-2 ${className}`;

    if (disabled) {
      return `${baseStyle} border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed`;
    }

    if (aiStatus === 'analyzing' || aiStatus === 'complete') {
      return `${baseStyle} border-purple-300 bg-purple-50 text-purple-900 focus:border-purple-500 focus:ring-purple-500`;
    }

    switch (checkStatus) {
      case 'valid':
        return `${baseStyle} border-green-300 bg-green-50 text-green-900 focus:border-green-500 focus:ring-green-500`;
      case 'duplicate':
        return `${baseStyle} border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500`;
      case 'invalid':
      case 'error':
        return `${baseStyle} border-yellow-300 bg-yellow-50 text-yellow-900 focus:border-yellow-500 focus:ring-yellow-500`;
      case 'checking':
        return `${baseStyle} border-blue-300 bg-blue-50 text-blue-900 focus:border-blue-500 focus:ring-blue-500`;
      default:
        return `${baseStyle} border-gray-300 bg-white text-gray-900 focus:border-indigo-500 focus:ring-indigo-500`;
    }
  };

  /**
   * 获取状态文本
   */
  const getStatusText = () => {
    if (aiStatus === 'analyzing') {
      return 'AI正在分析网站内容...';
    }
    if (aiStatus === 'complete') {
      return `AI分析完成 ${aiCost > 0 ? `(成本: $${aiCost.toFixed(3)})` : ''}`;
    }

    switch (checkStatus) {
      case 'checking':
        return '正在检测...';
      case 'valid':
        return `网站可添加 ${processingTime > 0 ? `(${processingTime}ms)` : ''}`;
      case 'duplicate':
        return '该网站已存在';
      case 'invalid':
      case 'error':
        return errorMessage;
      default:
        return '';
    }
  };

  /**
   * 获取状态文本颜色
   */
  const getStatusTextColor = () => {
    if (aiStatus === 'analyzing' || aiStatus === 'complete') {
      return 'text-purple-600';
    }

    switch (checkStatus) {
      case 'checking':
        return 'text-blue-600';
      case 'valid':
        return 'text-green-600';
      case 'duplicate':
        return 'text-red-600';
      case 'invalid':
      case 'error':
        return 'text-yellow-600';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-3">
      {/* 主输入框 */}
      <div className="relative">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={getInputStyle()}
          autoComplete="url"
          spellCheck={false}
        />

        {/* 状态图标 */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
          {getStatusIcon()}
        </div>
      </div>

      {/* 状态信息栏和AI按钮 */}
      <div className="flex items-center justify-between min-h-[24px]">
        <div className="flex items-center space-x-2">
          {/* 状态文本 */}
          {getStatusText() && (
            <div className={`flex items-center space-x-1 text-sm font-medium ${getStatusTextColor()}`}>
              <span>{getStatusText()}</span>
            </div>
          )}

          {/* 显示URL */}
          {displayURL && checkStatus !== 'invalid' && checkStatus !== 'error' && (
            <div className="text-xs text-gray-500">
              检测地址: {displayURL}
            </div>
          )}

          {/* AI错误提示 */}
          {aiError && aiStatus !== 'analyzing' && (
            <div className="flex items-center space-x-1 text-xs text-red-500">
              <AlertCircleIcon className="w-3 h-3" />
              <span>{aiError}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* AI智能填入按钮 */}
          {showAIButton && checkStatus === 'valid' && (
            <button
              onClick={handleAIAnalyze}
              disabled={disabled}
              className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 border border-purple-200 rounded-md hover:bg-purple-200 hover:text-purple-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI智能填入</span>
            </button>
          )}

          {/* 性能信息 */}
          {processingTime > 0 && checkStatus !== 'checking' && aiStatus !== 'analyzing' && (
            <div className="flex items-center space-x-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              <span>{processingTime}ms {duplicateInfo?.cached ? '(缓存)' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* AI分析结果面板 */}
      {aiStatus === 'complete' && aiAnalysisData && (
        <AIAnalysisResultPanel data={aiAnalysisData} cost={aiCost} />
      )}

      {/* 重复网站详情面板 */}
      {checkStatus === 'duplicate' && duplicateInfo?.tool && (
        <DuplicateWarningPanel tool={duplicateInfo.tool} />
      )}

      {/* 帮助信息 */}
      {checkStatus === 'idle' && (
        <div className="flex items-start space-x-2 p-3 bg-gray-50 rounded-lg">
          <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-600">
            <p>输入网站地址后将自动检测是否已存在相同工具。</p>
            <p className="mt-1 text-xs text-gray-500">
              支持格式：example.com 或 https://example.com
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartURLInput;
