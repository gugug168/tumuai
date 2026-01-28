import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ExternalLink, Heart, Eye } from 'lucide-react';
import OptimizedImage from './OptimizedImage';
import { generateInitialLogo } from '../lib/logoUtils';
import type { Tool } from '../types';

interface ToolCardProps {
  tool: Tool;
  isFavorited: boolean;
  onFavoriteToggle: (toolId: string) => void;
  viewMode: 'grid' | 'list';
}

const ToolCard = React.memo(({ tool, isFavorited, onFavoriteToggle, viewMode }: ToolCardProps) => {
  const handleFavoriteClick = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFavoriteToggle(tool.id);
  }, [tool.id, onFavoriteToggle]);

  // 生成兜底Logo的函数
  const getFallbackLogo = React.useCallback(() => {
    try {
      return generateInitialLogo(tool.name, tool.categories || []);
    } catch (error) {
      console.warn('生成兜底Logo失败:', error);
      // 最终兜底：简单的SVG
      return `data:image/svg+xml,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
          <rect width="100" height="100" fill="#6b7280" rx="12"/>
          <text x="50" y="50" font-family="Arial" font-size="24" text-anchor="middle" dominant-baseline="central" fill="white">
            ${tool.name?.charAt(0)?.toUpperCase() || 'T'}
          </text>
        </svg>
      `)}`;
    }
  }, [tool.name, tool.categories]);

  if (viewMode === 'list') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-200 transition-all duration-200 group flex items-center space-x-4 cursor-pointer">
        {/* Tool Logo */}
        <div className="flex-shrink-0 rounded-lg overflow-hidden border border-gray-100">
          <OptimizedImage
            src={tool.logo_url || getFallbackLogo()}
            alt={tool.name}
            className="w-12 h-12"
            objectFit="contain"
            background={true}
            priority={false}
            lazyLoad={true}
            sizes="48px"
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
            onClick={handleFavoriteClick}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            aria-label={isFavorited ? '取消收藏' : '添加收藏'}
          >
            <Heart className={`w-5 h-5 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
          </button>
          <Link
            to={`/tools/${tool.id}`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors inline-block"
          >
            查看
          </Link>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden group cursor-pointer">
      {/* Tool Image */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
        <OptimizedImage
          src={tool.logo_url || getFallbackLogo()}
          alt={tool.name}
          className="w-full h-40 group-hover:scale-110 transition-transform duration-500"
          objectFit="contain"
          background={true}
          priority={false}
          lazyLoad={true}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />
        <div className="absolute top-3 right-3">
          <button
            onClick={handleFavoriteClick}
            className="bg-white/90 backdrop-blur-sm p-1.5 rounded-full hover:bg-white hover:scale-110 transition-all duration-200 shadow-sm"
            aria-label={isFavorited ? '取消收藏' : '添加收藏'}
          >
            <Heart className={`w-4 h-4 transition-all duration-200 ${isFavorited ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-600 hover:text-red-500'}`} />
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
            <span className="text-xs font-medium text-gray-700">
              {tool.review_count && tool.review_count > 0
                ? tool.rating?.toFixed(1) || '4.5'
                : '新工具'}
            </span>
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
          className="w-full btn-primary py-2.5 px-3 text-sm flex items-center justify-center hover:bg-blue-700 transition-colors duration-200 shadow-sm hover:shadow group-hover:shadow-md"
        >
          查看详情
          <ExternalLink className="ml-1 w-3 h-3 group-hover:translate-x-0.5 transition-transform duration-200" />
        </Link>
      </div>
    </div>
  );
});

ToolCard.displayName = 'ToolCard';

export default ToolCard;