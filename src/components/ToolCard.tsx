import React, { useState, useRef, useEffect } from 'react';
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
  className?: string;
}

/**
 * ToolCard 组件 - 增强交互体验版本
 *
 * 优化:
 * - 收藏动画效果
 * - 触摸反馈
 * - 键盘导航支持
 * - 更好的悬停效果
 * - 无障碍性增强
 */
const ToolCard = React.memo(({
  tool,
  isFavorited,
  onFavoriteToggle,
  viewMode,
  className = ''
}: ToolCardProps) => {
  const [favoriteAnimating, setFavoriteAnimating] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const favoriteButtonRef = useRef<HTMLButtonElement>(null);

  // 处理收藏点击 - 带动画效果
  const handleFavoriteClick = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 触发动画
    setFavoriteAnimating(true);
    setTimeout(() => setFavoriteAnimating(false), 300);

    onFavoriteToggle(tool.id);
  }, [tool.id, onFavoriteToggle]);

  // 键盘导航支持
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      favoriteButtonRef.current?.click();
    }
  }, []);

  // 触摸/鼠标按下效果
  const handleMouseDown = React.useCallback(() => {
    setIsPressed(true);
  }, []);

  const handleMouseUp = React.useCallback(() => {
    setIsPressed(false);
  }, []);

  // 判断 logo_url 是否有效
  const isValidLogoUrl = React.useMemo(() => {
    if (!tool.logo_url) return false;
    if (tool.logo_url.includes('google.com/s2/favicons')) return false;
    if (tool.logo_url.includes('placeholder')) return false;
    if (tool.logo_url.includes('iconhorse')) return false;
    return true;
  }, [tool.logo_url]);

  // 生成兜底Logo的函数
  const getFallbackLogo = React.useCallback(() => {
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
  }, [tool.name, tool.categories]);

  // 收藏按钮动画类名
  const favoriteAnimationClass = `
    ${favoriteAnimating ? 'animate-favorite-bounce' : ''}
    ${isFavorited ? 'fill-red-500 text-red-500' : ''}
  `.trim();

  // 列表视图
  if (viewMode === 'list') {
    return (
      <article
        ref={cardRef}
        className={`
          bg-white border border-gray-200 rounded-lg p-4
          hover:shadow-lg hover:border-blue-300
          active:scale-[0.99]
          transition-all duration-200 ease-out
          group flex items-center space-x-4 cursor-pointer
          focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2
          ${className}
        `}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
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

          {/* 收藏按钮 - 增强版 */}
          <button
            ref={favoriteButtonRef}
            onClick={handleFavoriteClick}
            onKeyDown={handleKeyDown}
            className={`
              p-2 rounded-full transition-all duration-200
              ${isFavorited
                ? 'text-red-500 bg-red-50 hover:bg-red-100'
                : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'
              }
              focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
              active:scale-90
              ${favoriteAnimating ? 'animate-heart-pop' : ''}
            `}
            aria-label={isFavorited ? '取消收藏' : '添加收藏'}
            aria-pressed={isFavorited}
            type="button"
          >
            <Heart className={`w-5 h-5 ${favoriteAnimationClass}`} />
          </button>

          <Link
            to={`/tools/${tool.id}`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium
                     hover:bg-blue-700 active:bg-blue-800 active:scale-95
                     transition-all duration-200 inline-block"
          >
            查看
          </Link>
        </div>
      </article>
    );
  }

  // 网格视图
  return (
    <article
      ref={cardRef}
      className={`
        bg-white rounded-xl shadow-sm border border-gray-100
        hover:shadow-xl hover:-translate-y-1 hover:border-blue-200
        active:scale-[0.98] active:shadow-md
        transition-all duration-300 ease-out overflow-hidden group cursor-pointer
        focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2
        ${className}
      `}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Tool Image */}
      <div className="relative w-full h-40 bg-gray-50 flex items-center justify-center p-10">
        <OptimizedImage
          src={displayLogoUrl}
          alt={tool.name}
          className="max-w-[80px] max-h-[80px] w-auto h-auto transition-transform duration-300 group-hover:scale-110"
          objectFit="contain"
          background={false}
          fallback={fallbackIcon}
          priority={false}
          lazyLoad={true}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />

        {/* 收藏按钮 - 增强版 */}
        <div className="absolute top-3 right-3">
          <button
            ref={favoriteButtonRef}
            onClick={handleFavoriteClick}
            onKeyDown={handleKeyDown}
            className={`
              bg-white/90 backdrop-blur-sm p-1.5 rounded-full
              hover:bg-white hover:scale-110
              active:scale-95
              transition-all duration-200 shadow-sm
              ${isFavorited
                ? 'text-red-500 ring-2 ring-red-100'
                : 'text-gray-600 hover:text-red-500'
              }
              focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
              ${favoriteAnimating ? 'animate-heart-pop' : ''}
            `}
            aria-label={isFavorited ? '取消收藏' : '添加收藏'}
            aria-pressed={isFavorited}
            type="button"
          >
            <Heart className={`w-4 h-4 transition-all duration-200 ${favoriteAnimationClass}`} />
          </button>
        </div>
      </div>

      {/* Tool Content */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
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
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-medium">
            {tool.categories?.[0] || '未分类'}
          </span>
        </div>

        {/* Features as Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {tool.features?.slice(0, 3).map((feature, index) => (
            <span
              key={index}
              className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs transition-colors hover:bg-gray-200"
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
          <span className="text-xs font-medium text-blue-600">
            {tool.pricing || '免费'}
          </span>
        </div>

        {/* Action Button */}
        <Link
          to={`/tools/${tool.id}`}
          className="
            w-full bg-blue-600 text-white py-2.5 px-3 text-sm
            flex items-center justify-center
            hover:bg-blue-700 active:bg-blue-800
            active:scale-[0.98]
            transition-all duration-200 shadow-sm hover:shadow-md
            group-hover:shadow
          "
        >
          查看详情
          <ExternalLink className="ml-1 w-3 h-3 group-hover:translate-x-0.5 transition-transform duration-200" />
        </Link>
      </div>
    </article>
  );
});

ToolCard.displayName = 'ToolCard';

export default ToolCard;
