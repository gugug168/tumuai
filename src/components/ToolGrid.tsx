import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import ToolCard from './ToolCard';
import type { Tool } from '../types';

/**
 * ToolGrid 组件 - 工具网格/列表显示
 *
 * 功能:
 * - 网格和列表视图切换
 * - 分页控制
 * - 结果摘要显示
 * - 空状态处理
 * - 滚动到顶部功能
 */
interface ToolGridProps {
  // 数据
  tools: Tool[];
  totalCount: number;

  // 显示
  viewMode: 'grid' | 'list';
  paginatedTools: Tool[];

  // 分页
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  toolsPerPage?: number;

  // 搜索/筛选
  searchQuery?: string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;

  // 收藏
  favoriteStates: Record<string, boolean>;
  onFavoriteToggle: (toolId: string) => void;
  user?: any;

  // 预加载
  onPreloadNext?: () => void;
}

const ToolGrid = React.memo<ToolGridProps>(({
  tools,
  totalCount,
  viewMode,
  paginatedTools,
  currentPage,
  totalPages,
  onPageChange,
  toolsPerPage = 12,
  searchQuery = '',
  hasActiveFilters = false,
  onClearFilters,
  favoriteStates,
  onFavoriteToggle,
  user,
  onPreloadNext
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(false);

  // 处理收藏切换
  const handleFavoriteToggle = useCallback(async (toolId: string) => {
    if (!user) {
      // 显示登录模态框由父组件处理
      return;
    }
    onFavoriteToggle(toolId);
  }, [user, onFavoriteToggle]);

  // 滚动到顶部
  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // 页码变化时滚动到顶部
  useEffect(() => {
    scrollToTop();
  }, [currentPage, scrollToTop]);

  // 滚动检测用于预加载
  useEffect(() => {
    if (!onPreloadNext) return;

    const handleScroll = () => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.body.scrollHeight - 500; // 距离底部500px时触发

      if (scrollPosition >= threshold && !isNearBottom && currentPage < totalPages) {
        setIsNearBottom(true);
        onPreloadNext();
      } else if (scrollPosition < threshold) {
        setIsNearBottom(false);
      }
    };

    // 使用被动监听器优化性能
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [currentPage, totalPages, isNearBottom, onPreloadNext]);

  // 处理上一页
  const handlePreviousPage = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  // 处理下一页
  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  // 结果摘要文本
  const resultsSummary = useMemo(() => {
    const countText = (
      <span className="font-semibold text-gray-900">{totalCount}</span>
    );

    if (searchQuery) {
      return (
        <>
          找到 {countText} 个包含 "<span className="font-semibold">{searchQuery}</span>" 的工具
        </>
      );
    }

    return <>找到 {countText} 个工具</>;
  }, [totalCount, searchQuery]);

  // 空状态
  if (paginatedTools.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">未找到匹配的工具</h3>
        <p className="text-gray-600 mb-6">
          尝试调整筛选条件或搜索关键词
        </p>
        {onClearFilters && (
          <button
            onClick={onClearFilters}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            清除筛选条件
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef}>
      {/* Results Summary */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-gray-600">
          {resultsSummary}
          {totalPages > 1 && (
            <span className="ml-2 text-gray-500">
              (第 {currentPage}/{totalPages} 页)
            </span>
          )}
        </p>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300 transition-all duration-200 shadow-sm hover:shadow"
              aria-label="上一页"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              上一页
            </button>

            {/* 页码显示 */}
            <div className="flex items-center px-4 py-2 bg-blue-50 rounded-lg font-medium text-blue-700">
              <span className="text-sm">第</span>
              <span className="mx-1 font-bold">{currentPage}</span>
              <span className="text-sm">/ {totalPages}</span>
              <span className="text-sm">页</span>
            </div>

            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300 transition-all duration-200 shadow-sm hover:shadow"
              aria-label="下一页"
            >
              下一页
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        )}
      </div>

      {/* Tools Grid/List */}
      <div className={viewMode === 'grid'
        ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
        : 'space-y-4'
      }>
        {paginatedTools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            isFavorited={favoriteStates[tool.id] || false}
            onFavoriteToggle={handleFavoriteToggle}
            viewMode={viewMode}
          />
        ))}
      </div>

      {/* 底部分页 */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300 transition-all duration-200 shadow-sm hover:shadow"
              aria-label="上一页"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              上一页
            </button>

            <div className="flex items-center px-4 py-2 bg-blue-50 rounded-lg font-medium text-blue-700">
              <span className="text-sm">第</span>
              <span className="mx-1 font-bold">{currentPage}</span>
              <span className="text-sm">/ {totalPages}</span>
              <span className="text-sm">页</span>
            </div>

            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300 transition-all duration-200 shadow-sm hover:shadow"
              aria-label="下一页"
            >
              下一页
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

ToolGrid.displayName = 'ToolGrid';

export default ToolGrid;
