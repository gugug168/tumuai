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

  // 判断 logo_url 是否有效
  const isValidLogoUrl = React.useMemo(() => {
    if (!tool.logo_url) return false;
    // 排除无效的 logo 来源
    if (tool.logo_url.includes('google.com/s2/favicons')) return false;
    if (tool.logo_url.includes('placeholder')) return false;
    if (tool.logo_url.includes('iconhorse')) return false;
    return true;
  }, [tool.logo_url]);

  // 生成兜底Logo的函数
  const getFallbackLogo = React.useCallback(() => {
    // 直接使用 generateInitialLogo，它已经包含了完善的兜底逻辑
    return generateInitialLogo(tool.name, tool.categories || []);
  }, [tool.name, tool.categories]);

  // 获取要显示的 logo URL
  const displayLogoUrl = React.useMemo(() => {
    return isValidLogoUrl ? tool.logo_url : getFallbackLogo();
  }, [isValidLogoUrl, tool.logo_url, getFallbackLogo]);

  // 生成兜底 SVG 元素
  const fallbackIcon = React.useMemo(() => {
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
        'Computer Vision': '#0891b2',
        'AI结构设计': '#6366f1',
        'default': '#6b7280'
      };

      const primaryCategory = tool.categories?.[0] || '';
      if (categoryColors[primaryCategory]) {
        return categoryColors[primaryCategory];
      }
      for (const [key, color] of Object.entries(categoryColors)) {
        if (primaryCategory.includes(key) || key.includes(primaryCategory)) {
          return color;
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
  }, [tool.name, tool.categories]);

  if (viewMode === 'list') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-200 transition-all duration-200 group flex items-center space-x-4 cursor-pointer">
        {/* Tool Logo */}
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100 p-2">
          <OptimizedImage
            src={displayLogoUrl}
            alt={tool.name}
            className="w-8 h-8"
            objectFit="contain"
            background={false}
            fallback={fallbackIcon}
            priority={false}
            lazyLoad={true}
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
      <div className="relative w-full h-40 bg-gray-50 flex items-center justify-center p-10">
        <OptimizedImage
          src={displayLogoUrl}
          alt={tool.name}
          className="max-w-[80px] max-h-[80px] w-auto h-auto"
          objectFit="contain"
          background={false}
          fallback={fallbackIcon}
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