import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Star, Heart } from 'lucide-react';
import OptimizedImage from './OptimizedImage';
import { getFeaturedTools } from '../lib/supabase';
import { generateInitialLogo } from '../lib/logoUtils';
import { apiRequestWithRetry } from '../lib/api';
import { useCache } from '../hooks/useCache';
import { usePerformance } from '../hooks/usePerformance';
import type { Tool } from '../types/index';

// 已移除硬编码的featuredTools数组，现在使用动态数据

const FeaturedTools = React.memo(() => {
  // 状态管理
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 性能监控和缓存hooks
  const { fetchWithCache } = useCache();
  const { recordApiCall, recordInteraction } = usePerformance('FeaturedTools');

  // 优化的数据获取逻辑 - 使用缓存和性能监控
  const fetchFeaturedTools = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 使用缓存API调用，3分钟缓存，30秒stale-while-revalidate
      const fetchedTools = await recordApiCall('fetch_featured_tools', async () => {
        return await fetchWithCache('featured_tools',
          () => apiRequestWithRetry(() => getFeaturedTools()),
          { ttl: 3 * 60 * 1000, staleWhileRevalidate: 30 * 1000 }
        );
      });
      
      setTools(Array.isArray(fetchedTools) ? fetchedTools : []);
      console.log('✅ 成功加载精选工具:', fetchedTools.length + '个');
    } catch (error) {
      console.error('❌ 加载精选工具失败:', error);
      setError(error instanceof Error ? error.message : '加载精选工具失败');
    } finally {
      setLoading(false);
    }
  }, [fetchWithCache, recordApiCall]);

  // 初始加载
  useEffect(() => {
    fetchFeaturedTools();
  }, [fetchFeaturedTools]);

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              编辑推荐 · 精选工具
            </h2>
            <p className="text-gray-600">经过专业评测，为土木工程师精心挑选的优质工具</p>
          </div>
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">加载精选工具中...</p>
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <div className="text-center py-8">
            <p className="text-red-600">加载失败: {error}</p>
            <button 
              onClick={() => {
                recordInteraction('retry_featured_tools');
                fetchFeaturedTools();
              }} 
              className="mt-2 text-blue-600 hover:underline"
            >
              重新加载
            </button>
          </div>
        )}

        {/* 精选工具列表 */}
        {!loading && !error && (
          <div className="space-y-4">
            {tools.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">暂无精选工具数据</p>
                <button 
                  onClick={() => {
                    recordInteraction('retry_featured_tools');
                    fetchFeaturedTools();
                  }} 
                  className="mt-2 text-blue-600 hover:underline"
                >
                  重新加载
                </button>
              </div>
            ) : (
              tools.map((tool) => (
            <div
              key={tool.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow group flex items-center space-x-4"
            >
              {/* Tool Logo */}
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100 p-2">
                <OptimizedImage
                  src={tool.logo_url || generateInitialLogo(tool.name, tool.categories || [])}
                  alt={tool.name}
                  className="w-8 h-8"
                  objectFit="contain"
                  background={false}
                  priority={true}
                  lazyLoad={false}
                  sizes="32px"
                />
              </div>

              {/* Tool Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                    {tool.name}
                  </h3>
                  {tool.categories && tool.categories[0] && (
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                      {tool.categories[0]}
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">
                  {tool.tagline || tool.description || '专业的土木工程工具'}
                </p>
              </div>

              {/* Tool Actions */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="flex items-center space-x-1 mb-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm font-medium text-gray-700">
                      {tool.review_count && tool.review_count > 0
                        ? tool.rating?.toFixed(1) || '4.5'
                        : '新工具'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{tool.pricing || '免费'}</span>
                </div>
                <button 
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  onClick={() => recordInteraction('favorite_click', { toolId: tool.id, toolName: tool.name })}
                >
                  <Heart className="w-5 h-5" />
                </button>
                <Link
                  to={`/tools/${tool.id}`}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors inline-block"
                  onClick={() => recordInteraction('view_tool_detail', { toolId: tool.id, toolName: tool.name })}
                >
                  查看
                </Link>
              </div>
            </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
});

FeaturedTools.displayName = 'FeaturedTools';

export default FeaturedTools;