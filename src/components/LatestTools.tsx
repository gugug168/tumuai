import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, ExternalLink, Heart, Eye, Clock } from 'lucide-react';
import { getLatestTools } from '../lib/supabase';
import { getBestDisplayLogoUrl } from '../lib/logoUtils';
import OptimizedImage from './OptimizedImage';
import { SkeletonCard, SkeletonWrapper } from './SkeletonLoader';
import type { Tool } from '../types';

const LatestTools = () => {
  const [latestTools, setLatestTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取要显示的 logo URL（使用共享工具函数）
  const getDisplayLogo = (tool: Tool): string => {
    return getBestDisplayLogoUrl(tool.logo_url, tool.name, tool.categories || []);
  };

  // 生成兜底 SVG 图标
  const getFallbackIcon = (tool: Tool): React.ReactNode => {
    const initials = (() => {
      if (!tool.name) return 'T';
      const cleanName = tool.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, ' ');
      const words = cleanName.trim().split(/\s+/);
      if (words.length === 1) {
        return words[0].substring(0, 2).toUpperCase();
      } else {
        return words.slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase();
      }
    })();

    const color = (() => {
      const categoryColors: Record<string, string> = {
        'AI工具': '#6366f1',
        '结构设计': '#059669',
        'BIM建模': '#0891b2',
        '工程计算': '#dc2626',
        '项目管理': '#9333ea',
        '数据分析': '#ea580c',
        '建筑设计': '#16a34a',
        '施工管理': '#0f172a',
        'default': '#6b7280'
      };

      const primaryCategory = tool.categories?.[0] || '';
      if (categoryColors[primaryCategory]) {
        return categoryColors[primaryCategory];
      }
      for (const [key, c] of Object.entries(categoryColors)) {
        if (primaryCategory.includes(key) || key.includes(primaryCategory)) {
          return c;
        }
      }
      return categoryColors.default;
    })();

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 80 80"
        className="w-full h-full"
        style={{ maxWidth: '80px', maxHeight: '80px' }}
      >
        <rect width="80" height="80" fill={color} rx="12"/>
        <text
          x="40"
          y="40"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
          fontSize="28"
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
        >
          {initials}
        </text>
      </svg>
    );
  };

  const fetchLatestTools = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getLatestTools();
      setLatestTools(Array.isArray(data) ? data : []);
    } catch (err) {
      const error = err as Error;
      setError(error?.message || '获取工具失败');
      console.error('获取最新工具失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestTools();
  }, []);
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            最新收录
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            最新加入网站的优质工具，第一时间发现行业前沿技术
          </p>
        </div>

        {/* 错误状态 */}
        {error && (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-red-600 mb-4">加载失败: {error}</p>
              <button 
                onClick={fetchLatestTools}
                className="btn-primary px-6 py-2"
              >
                重新加载
              </button>
            </div>
          </div>
        )}

        {/* 加载状态 - 使用骨架屏 */}
        <SkeletonWrapper
          loading={loading}
          skeleton={
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="stagger-in" style={{ animationDelay: `${index * 50}ms` }}>
                  <SkeletonCard
                    showAvatar={true}
                    showTitle={true}
                    textLines={3}
                    showActions={true}
                    className="border-0 shadow-sm"
                  />
                </div>
              ))}
            </div>
          }
        >

        {/* 工具列表 */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {latestTools.map((tool) => (
            <div
              key={tool.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 overflow-hidden group"
            >
              {/* Tool Image */}
              <div className="relative w-full h-40 bg-gray-50 flex items-center justify-center p-10">
                <OptimizedImage
                  src={getDisplayLogo(tool)}
                  alt={tool.name}
                  className="max-w-[80px] max-h-[80px] w-auto h-auto"
                  objectFit="contain"
                  background={false}
                  fallback={getFallbackIcon(tool)}
                  priority={false}
                  lazyLoad={true}
                />
                <div className="absolute top-3 left-3">
                  <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    新收录
                  </span>
                </div>
                <div className="absolute top-3 right-3">
                  <button className="bg-white/90 p-1.5 rounded-full hover:bg-white transition-colors">
                    <Heart className="w-3 h-3 text-gray-600 hover:text-red-500" />
                  </button>
                </div>
              </div>

              {/* Tool Content */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-primary-800 group-hover:text-accent-600 transition-colors line-clamp-1">
                    {tool.name}
                  </h3>
                  <div className="flex items-center space-x-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span className="text-xs font-medium text-gray-700">{tool.rating}</span>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-3 leading-relaxed line-clamp-2">
                  {tool.tagline}
                </p>

                <div className="mb-3">
                  <span className="tag-primary px-2 py-1 rounded-md text-xs font-medium">
                    {tool.categories?.[0] || '未分类'}
                  </span>
                </div>

                {/* Features as Tags */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {tool.features?.slice(0, 3).map((feature, index) => (
                    <span
                      key={index}
                      className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {/* Stats and Pricing */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Eye className="w-3 h-3" />
                      <span>{tool.views || 0}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3" />
                      <span>{tool.review_count || 0}</span>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-accent-600">
                    {tool.pricing || '免费'}
                  </span>
                </div>

                {/* Action Button */}
                <Link
                  to={`/tools/${tool.id}`}
                  state={{ tool }}
                  className="w-full btn-primary py-2 px-3 text-sm flex items-center justify-center"
                >
                  查看详情
                  <ExternalLink className="ml-1 w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
          </div>
        )}

        {/* 查看更多按钮 */}
        {!loading && !error && latestTools.length > 0 && (
          <div className="text-center mt-12">
            <button className="btn-secondary px-8 py-3">
              查看更多最新工具
            </button>
          </div>
        )}
        </SkeletonWrapper>
      </div>
    </section>
  );
};

export default LatestTools;
