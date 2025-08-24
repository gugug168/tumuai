/**
 * 类型安全的工具详情组件示例
 * 展示TypeScript最佳实践和类型推断优化
 */

import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { Tool, ToolReview } from '../types';
import { useTypedQuery, useTypedMutation } from '../hooks/useTypedAsyncOperation';
import { getToolById, incrementToolViews } from '../lib/supabase';
import { addToolReview } from '../lib/community';
import type { 
  BaseComponentProps, 
  FormState, 
  ClickEventHandler,
  FormEventHandler 
} from '../lib/type-utils';

// 组件专用类型定义
interface ToolDetailParams {
  readonly toolId: string;
}

interface ReviewFormData {
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
}

interface ToolDetailProps extends BaseComponentProps {
  /** 自定义工具数据（可选，用于测试或预览） */
  toolOverride?: Tool;
  /** 是否显示编辑按钮 */
  showEditButton?: boolean;
  /** 编辑按钮点击处理器 */
  onEditClick?: ClickEventHandler;
}

// 内部组件Props类型
interface ToolHeaderProps {
  tool: Tool;
  loading?: boolean;
  onFavoriteClick: ClickEventHandler;
  onVisitClick: ClickEventHandler;
}

interface ReviewSectionProps {
  toolId: string;
  reviews: ToolReview[];
  onSubmitReview: (data: ReviewFormData) => Promise<void>;
  loading?: boolean;
}

// 类型守卫函数
function isValidToolId(toolId: string | undefined): toolId is string {
  return typeof toolId === 'string' && toolId.length > 0;
}

// 工具头部组件
const ToolHeader: React.FC<ToolHeaderProps> = React.memo(({ 
  tool, 
  loading = false, 
  onFavoriteClick, 
  onVisitClick 
}) => {
  return (
    <header className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
        <img
          src={tool.logo_url || '/default-tool-logo.png'}
          alt={`${tool.name} logo`}
          className="w-20 h-20 rounded-xl object-cover"
          loading="lazy"
        />
        
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{tool.name}</h1>
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
              {tool.categories[0] || '工具'}
            </span>
          </div>
          
          <p className="text-lg text-gray-600 mb-4">{tool.tagline}</p>
          
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>⭐ {tool.rating} ({tool.review_count} 评价)</span>
            <span>👁 {tool.views.toLocaleString()} 次浏览</span>
            <span>📅 更新于 {new Date(tool.updated_at).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex flex-col space-y-3">
          <button
            type="button"
            onClick={onVisitClick}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            访问官网
          </button>
          
          <button
            type="button"
            onClick={onFavoriteClick}
            disabled={loading}
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            收藏工具
          </button>
        </div>
      </div>
    </header>
  );
});

ToolHeader.displayName = 'ToolHeader';

// 评论区组件
const ReviewSection: React.FC<ReviewSectionProps> = React.memo(({ 
  toolId, 
  reviews, 
  onSubmitReview, 
  loading = false 
}) => {
  const [formState, setFormState] = React.useState<FormState<ReviewFormData>>({
    values: { rating: 5, comment: '' },
    errors: {},
    touched: {},
    isSubmitting: false,
    isValid: true
  });

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    
    if (!formState.isValid || formState.isSubmitting) return;
    
    setFormState(prev => ({ ...prev, isSubmitting: true }));
    
    try {
      await onSubmitReview(formState.values);
      setFormState(prev => ({
        ...prev,
        values: { rating: 5, comment: '' },
        touched: {},
        isSubmitting: false
      }));
    } catch (error) {
      setFormState(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const updateField = <K extends keyof ReviewFormData>(
    field: K,
    value: ReviewFormData[K]
  ) => {
    setFormState(prev => ({
      ...prev,
      values: { ...prev.values, [field]: value },
      touched: { ...prev.touched, [field]: true }
    }));
  };

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">用户评价</h2>
      
      {/* 提交评论表单 */}
      <form onSubmit={handleSubmit} className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">发表评价</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            评分
          </label>
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => updateField('rating', star as ReviewFormData['rating'])}
                className="p-1 hover:scale-110 transition-transform"
              >
                <span className={`text-2xl ${
                  star <= formState.values.rating 
                    ? 'text-yellow-400' 
                    : 'text-gray-300'
                }`}>
                  ⭐
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            评论内容
          </label>
          <textarea
            value={formState.values.comment}
            onChange={(e) => updateField('comment', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="分享您使用这个工具的体验..."
            required
          />
        </div>

        <button
          type="submit"
          disabled={formState.isSubmitting || loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {formState.isSubmitting ? '提交中...' : '提交评价'}
        </button>
      </form>

      {/* 评论列表 */}
      <div className="space-y-6">
        {reviews.length === 0 ? (
          <p className="text-center py-8 text-gray-500">
            暂无评论，快来发表第一条评论吧！
          </p>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0">
              <div className="flex items-start space-x-4">
                <img
                  src={review.user_profiles?.avatar_url || '/default-avatar.png'}
                  alt={review.user_profiles?.full_name || '用户头像'}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-semibold text-gray-900">
                      {review.user_profiles?.full_name || '匿名用户'}
                    </h4>
                    <div className="flex items-center">
                      {Array.from({ length: 5 }, (_, i) => (
                        <span
                          key={i}
                          className={`text-sm ${
                            i < review.rating ? 'text-yellow-400' : 'text-gray-300'
                          }`}
                        >
                          ⭐
                        </span>
                      ))}
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(review.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <p className="text-gray-700 leading-relaxed">{review.content}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
});

ReviewSection.displayName = 'ReviewSection';

// 主组件
export const TypeSafeToolDetail: React.FC<ToolDetailProps> = ({
  toolOverride,
  showEditButton = false,
  onEditClick,
  className,
  testId = 'tool-detail',
  children
}) => {
  const { toolId } = useParams<ToolDetailParams>();

  // 类型安全的参数验证
  if (!isValidToolId(toolId) && !toolOverride) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">参数错误</h2>
          <p className="text-gray-600">无效的工具ID</p>
        </div>
      </div>
    );
  }

  // 数据获取
  const toolQuery = useTypedQuery(
    async () => {
      if (toolOverride) return toolOverride;
      if (!isValidToolId(toolId)) throw new Error('Invalid tool ID');
      
      const tool = await getToolById(toolId);
      if (!tool) throw new Error('Tool not found');
      
      return tool;
    },
    {
      enabled: Boolean(toolId || toolOverride),
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    }
  );

  // 评论提交mutation
  const reviewMutation = useTypedMutation(
    async (reviewData: ReviewFormData) => {
      if (!toolQuery.data?.id) throw new Error('No tool selected');
      
      return addToolReview(toolQuery.data.id, {
        rating: reviewData.rating,
        content: reviewData.comment
      });
    },
    {
      onSuccess: () => {
        // 重新获取工具数据以更新评论
        toolQuery.refetch();
      }
    }
  );

  // 浏览量更新
  React.useEffect(() => {
    if (toolQuery.data?.id && !toolOverride) {
      incrementToolViews(toolQuery.data.id);
    }
  }, [toolQuery.data?.id, toolOverride]);

  // 事件处理器
  const handleFavoriteClick: ClickEventHandler = React.useCallback((event) => {
    event.preventDefault();
    // TODO: 实现收藏功能
    console.log('Toggle favorite for tool:', toolQuery.data?.id);
  }, [toolQuery.data?.id]);

  const handleVisitClick: ClickEventHandler = React.useCallback((event) => {
    event.preventDefault();
    if (toolQuery.data?.website_url) {
      window.open(toolQuery.data.website_url, '_blank', 'noopener,noreferrer');
    }
  }, [toolQuery.data?.website_url]);

  const handleSubmitReview = React.useCallback(async (reviewData: ReviewFormData) => {
    await reviewMutation.mutate(reviewData);
  }, [reviewMutation.mutate]);

  // 加载状态
  if (toolQuery.loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" data-testid={`${testId}-loading`}>
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载工具详情中...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (toolQuery.error || !toolQuery.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" data-testid={`${testId}-error`}>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">工具未找到</h2>
          <p className="text-gray-600 mb-4">
            {toolQuery.error?.message || '抱歉，您访问的工具不存在或已被删除。'}
          </p>
          <button
            onClick={() => toolQuery.retry()}
            className="text-blue-600 hover:text-blue-700 underline"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  const tool = toolQuery.data;
  
  // Mock reviews data - 在实际应用中应该从API获取
  const mockReviews: ToolReview[] = useMemo(() => [], []);

  return (
    <div 
      className={`min-h-screen bg-gray-50 ${className || ''}`}
      data-testid={testId}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHeader
          tool={tool}
          loading={toolQuery.loading}
          onFavoriteClick={handleFavoriteClick}
          onVisitClick={handleVisitClick}
        />

        <div className="mt-8 space-y-8">
          {/* 工具详情内容 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">详细介绍</h2>
            <div className="prose prose-lg max-w-none">
              <p className="text-gray-700 leading-relaxed">
                {tool.description || tool.tagline}
              </p>
            </div>
          </section>

          {/* 功能列表 */}
          {tool.features.length > 0 && (
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">核心功能</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tool.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <span className="text-green-500">✓</span>
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 评论区 */}
          <ReviewSection
            toolId={tool.id}
            reviews={mockReviews}
            onSubmitReview={handleSubmitReview}
            loading={reviewMutation.loading}
          />

          {children}
        </div>

        {/* 编辑按钮 */}
        {showEditButton && (
          <button
            onClick={onEditClick}
            className="fixed bottom-8 right-8 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
            aria-label="编辑工具"
          >
            ✏️
          </button>
        )}
      </div>
    </div>
  );
};

// 默认导出和类型导出
export default TypeSafeToolDetail;
export type { ToolDetailProps, ReviewFormData };