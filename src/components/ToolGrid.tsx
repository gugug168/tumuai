import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { VirtuosoGrid, Virtuoso } from 'react-virtuoso';
import ToolCard from './ToolCard';
import type { Tool } from '../types';

/**
 * ToolGrid 组件 - 工具网格/列表显示（支持虚拟滚动）
 *
 * 功能:
 * - 网格和列表视图切换
 * - 分页控制（兼容模式）/ 虚拟滚动（高性能模式）
 * - 结果摘要显示
 * - 空状态处理
 * - 滚动到顶部功能
 * - 无限滚动加载
 */
interface ToolGridProps {
  // 数据
  tools: Tool[];
  totalCount: number;
  allTools?: Tool[]; // 所有已加载的工具（用于无限滚动）
  loading?: boolean;

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

  // 预加载 / 加载更多
  onPreloadNext?: () => void;
  onLoadMore?: () => void; // 无限滚动加载更多
  isLoadingMore?: boolean; // 是否正在加载更多
  hasMore?: boolean; // 是否还有更多数据
  enableVirtualScroll?: boolean; // 是否启用虚拟滚动
}

const ToolGrid = React.memo<ToolGridProps>(({
  tools,
  totalCount,
  allTools,
  loading = false,
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
  onPreloadNext,
  onLoadMore,
  isLoadingMore = false,
  hasMore = false,
  enableVirtualScroll = false
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const preloadTriggeredRef = useRef(false); // 使用 ref 避免重复触发
  const loadMoreTriggeredRef = useRef(false); // 无限滚动加载标记

  // 处理收藏切换
  const handleFavoriteToggle = useCallback(async (toolId: string) => {
    if (!user) {
      // 显示登录模态框由父组件处理
      return;
    }
    onFavoriteToggle(toolId);
  }, [user, onFavoriteToggle]);

  // 滚动到顶部 - 使用 window.scrollTo 避免 scrollIntoView 导致的页面刷新问题
  const scrollToTop = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, []);

  // 页码变化时滚动到顶部
  useEffect(() => {
    if (currentPage > 1) {
      scrollToTop();
      // 重置预加载标记
      preloadTriggeredRef.current = false;
      loadMoreTriggeredRef.current = false;
    }
  }, [currentPage, scrollToTop]);

  // 滚动检测用于预加载（传统分页模式）
  useEffect(() => {
    if (!onPreloadNext || enableVirtualScroll) return;

    const handleScroll = () => {
      // 如果已经在最后一页或预加载已触发，不执行任何操作
      if (currentPage >= totalPages || preloadTriggeredRef.current) {
        return;
      }

      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.body.scrollHeight - 500; // 距离底部500px时触发

      if (scrollPosition >= threshold) {
        preloadTriggeredRef.current = true;
        onPreloadNext();
      }
    };

    // 使用被动监听器优化性能
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [currentPage, totalPages, onPreloadNext, enableVirtualScroll]);

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

  // 无限滚动：加载更多处理
  const handleLoadMore = useCallback(() => {
    if (!onLoadMore || isLoadingMore || !hasMore || loadMoreTriggeredRef.current) {
      return;
    }
    loadMoreTriggeredRef.current = true;
    onLoadMore();
    // 延迟重置标记，避免快速连续触发
    setTimeout(() => {
      loadMoreTriggeredRef.current = false;
    }, 1000);
  }, [onLoadMore, isLoadingMore, hasMore]);

  // 用于虚拟滚动的 Item 组件
  const ItemComponent = useCallback((index: number) => {
    const tool = (enableVirtualScroll ? allTools : tools)[index];
    if (!tool) return null;

    return (
      <ToolCard
        key={tool.id}
        tool={tool}
        isFavorited={favoriteStates[tool.id] || false}
        onFavoriteToggle={handleFavoriteToggle}
        viewMode={viewMode}
      />
    );
  }, [enableVirtualScroll, allTools, tools, favoriteStates, handleFavoriteToggle, viewMode]);

  // 虚拟滚动使用的完整数据集
  const displayTools = useMemo(() => {
    return enableVirtualScroll && allTools ? allTools : paginatedTools;
  }, [enableVirtualScroll, allTools, paginatedTools]);

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
  if (displayTools.length === 0) {
    if (loading) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="flex justify-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
          <p className="mt-4 text-gray-600">正在加载工具…</p>
        </div>
      );
    }

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

  // 虚拟滚动模式渲染（网格视图）
  if (enableVirtualScroll && viewMode === 'grid' && allTools && allTools.length > 0) {
    return (
      <div ref={scrollContainerRef}>
        {/* Results Summary */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-gray-600">
            {resultsSummary}
            {totalCount > displayTools.length && (
              <span className="ml-2 text-gray-500">
                (已加载 {displayTools.length} / {totalCount} 个)
              </span>
            )}
          </p>
        </div>

        {/* Virtual Grid */}
        <VirtuosoGrid
          useWindowScroll
          totalCount={allTools.length}
          endReached={hasMore ? handleLoadMore : undefined}
          overscan={200}
          listClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          itemClassName="virtuoso-grid-item"
          itemContent={(index) => {
            const tool = allTools[index];
            if (!tool) return null;
            return (
              <ToolCard
                key={tool.id}
                tool={tool}
                isFavorited={favoriteStates[tool.id] || false}
                onFavoriteToggle={handleFavoriteToggle}
                viewMode={viewMode}
              />
            );
          }}
          components={{
            Footer: () => (
              isLoadingMore ? (
                <div className="col-span-full py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : hasMore ? (
                <div className="col-span-full py-4 text-center text-gray-500 text-sm">
                  下拉加载更多
                </div>
              ) : null
            )
          }}
        />

        {/* 返回顶部按钮 */}
        {allTools.length > 24 && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
            aria-label="返回顶部"
          >
            <ChevronLeft className="w-5 h-5 transform rotate-90" />
          </button>
        )}
      </div>
    );
  }

  // 虚拟滚动模式渲染（列表视图）
  if (enableVirtualScroll && viewMode === 'list' && allTools && allTools.length > 0) {
    return (
      <div ref={scrollContainerRef}>
        {/* Results Summary */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-gray-600">
            {resultsSummary}
            {totalCount > displayTools.length && (
              <span className="ml-2 text-gray-500">
                (已加载 {displayTools.length} / {totalCount} 个)
              </span>
            )}
          </p>
        </div>

        {/* Virtual List */}
        <Virtuoso
          useWindowScroll
          data={allTools}
          endReached={hasMore ? handleLoadMore : undefined}
          overscan={200}
          itemContent={(index, tool) => {
            if (!tool) return null;
            return (
              <ToolCard
                key={tool.id}
                tool={tool}
                isFavorited={favoriteStates[tool.id] || false}
                onFavoriteToggle={handleFavoriteToggle}
                viewMode={viewMode}
              />
            );
          }}
          components={{
            Footer: () => (
              isLoadingMore ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : hasMore ? (
                <div className="py-4 text-center text-gray-500 text-sm">
                  下拉加载更多
                </div>
              ) : null
            )
          }}
        />

        {/* 返回顶部按钮 */}
        {allTools.length > 50 && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
            aria-label="返回顶部"
          >
            <ChevronLeft className="w-5 h-5 transform rotate-90" />
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

export { ToolGrid };
export default ToolGrid;
