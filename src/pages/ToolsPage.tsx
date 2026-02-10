import React, { useState, useEffect, useMemo, useId, useCallback, lazy, Suspense } from 'react';
import { WifiOff, RefreshCw, AlertCircle, Wifi, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast, createToastHelpers } from '../components/Toast';
import AuthModal from '../components/AuthModal';
import ToolCardSkeleton from '../components/ToolCardSkeleton';

// 动态导入优化代码分割
const ToolFilters = lazy(() => import('../components/ToolFilters').then(m => ({ default: m.ToolFilters })));
const ToolGrid = lazy(() => import('../components/ToolGrid').then(m => ({ default: m.ToolGrid })));

import { useToolFilters, filterTools } from '../hooks/useToolFilters';
import { useToolData } from '../hooks/useToolData';
import { usePerformance } from '../hooks/usePerformance';
import type { ToolSearchFilters } from '../types';

/**
 * ToolsPage 组件 - 工具中心页面
 *
 * 架构优化:
 * - 使用 useToolFilters 管理筛选状态
 * - 使用 useToolData 管理数据获取
 * - 使用 ToolFilters 和 ToolGrid 组件分离UI
 * - 使用 useReducer 合并相关状态
 * - 使用 React.memo 优化渲染
 */
const ToolsPage = React.memo(() => {
  // Hooks
  const { user } = useAuth();
  const { showToast } = useToast();
  const toast = createToastHelpers(showToast);
  const searchId = useId();

  // 性能监控
  const { recordApiCall, recordInteraction, printReport } = usePerformance('ToolsPage');

  // 筛选状态管理
  const {
    filters,
    deferredSearch,
    isPending,
    activeFiltersCount,
    hasActiveFilters,
    needsServerFiltering,
    handleFilterChange,
    handleCategoryToggle,
    handleFeatureToggle,
    clearFilters,
    initializeFromUrl,
    cleanup: cleanupFilters
  } = useToolFilters();

  // 数据获取
  const {
    tools,
    totalToolsCount,
    filteredToolsCount,
    loading,
    loadError,
    isOffline,
    retryCount,
    currentPage,
    categories,
    favoriteStates,
    allTools,
    isLoadingMore,
    hasMore,
    loadTools,
    loadCategories,
    loadFavoriteStates,
    toggleFavorite,
    preloadToolsPage,
    loadMore,
    setCurrentPage,
    setUserId,
    TOOLS_PER_PAGE
  } = useToolData({ recordApiCall, recordInteraction });

  // UI 状态
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // ========================================
  // 数据加载
  // ========================================

  // 初始加载（分类）
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // 从 URL 参数初始化筛选
  useEffect(() => {
    const hasCategory = initializeFromUrl();
    if (hasCategory) {
      setShowFilters(true);
    }
  }, [initializeFromUrl]);

  // 组装服务端筛选参数（搜索/分类/功能/定价/排序）
  const serverFilters = useMemo<ToolSearchFilters | undefined>(() => {
    if (!needsServerFiltering) return undefined;

    const f: ToolSearchFilters = {};
    if (filters.search.trim()) f.search = filters.search.trim();
    if (filters.categories.length > 0) f.categories = filters.categories;
    if (filters.pricing) f.pricing = filters.pricing as any;
    if (filters.features.length > 0) f.features = filters.features;
    f.sortBy = filters.sortBy as any;
    return f;
  }, [needsServerFiltering, filters.search, filters.categories, filters.pricing, filters.features, filters.sortBy]);

  // 筛选条件变化时重新加载数据（回到第 1 页）
  useEffect(() => {
    setCurrentPage(1);
    loadTools(false, 1, serverFilters);
  }, [serverFilters, loadTools, setCurrentPage]);

  // 用户变化时加载收藏状态
  useEffect(() => {
    if (user) {
      setUserId(user.id);
      const toolIds = tools.map(t => t.id);
      if (toolIds.length > 0) {
        loadFavoriteStates(toolIds, user.id);
      }
    }
  }, [user, tools, setUserId, loadFavoriteStates]);

  // ========================================
  // 计算派生状态
  // ========================================

  // 客户端筛选结果
  const filteredTools = useMemo(() => {
    // 服务端已处理：直接使用当前页数据；离线时兜底用客户端筛选（可能只覆盖当前页/缓存）
    if (needsServerFiltering && !isOffline) return tools;
    return filterTools(tools, deferredSearch, filters);
  }, [needsServerFiltering, isOffline, tools, deferredSearch, filters]);

  // 计算总页数
  const totalPages = useMemo(() => {
    const count = needsServerFiltering
      ? filteredToolsCount
      : hasActiveFilters
      ? filteredTools.length
      : totalToolsCount;
    return Math.ceil(count / TOOLS_PER_PAGE);
  }, [needsServerFiltering, filteredToolsCount, hasActiveFilters, filteredTools.length, totalToolsCount, TOOLS_PER_PAGE]);

  // 计算显示的工具数量
  const displayCount = useMemo(() => {
    return needsServerFiltering
      ? filteredToolsCount
      : hasActiveFilters
      ? filteredTools.length
      : totalToolsCount;
  }, [needsServerFiltering, filteredToolsCount, hasActiveFilters, filteredTools.length, totalToolsCount]);

  // 当前页的工具
  const paginatedTools = useMemo(() => {
    // 服务端筛选/搜索/排序：tools 已经是当前页
    if (needsServerFiltering && !isOffline) return tools;
    if (hasActiveFilters) {
      const startIndex = (currentPage - 1) * TOOLS_PER_PAGE;
      const endIndex = startIndex + TOOLS_PER_PAGE;
      return filteredTools.slice(startIndex, endIndex);
    }
    return tools;
  }, [needsServerFiltering, isOffline, hasActiveFilters, filteredTools, currentPage, tools, TOOLS_PER_PAGE]);

  // ========================================
  // 事件处理
  // ========================================

  // 处理收藏切换
  const handleFavoriteToggle = useCallback(async (toolId: string) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    const currentState = favoriteStates[toolId];
    const success = await toggleFavorite(toolId, user.id, currentState);

    if (!success) {
      toast.error('操作失败', '请重试');
    }
  }, [user, favoriteStates, toggleFavorite, toast]);

  // 处理页码变化
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    loadTools(false, page, serverFilters);
  }, [setCurrentPage, loadTools, serverFilters]);

  // 处理预加载下一页
  const handlePreloadNext = useCallback(() => {
    if (currentPage < totalPages) {
      // 预加载下一页数据（仅预热，不改变 UI）
      if (!needsServerFiltering && !hasActiveFilters) {
        preloadToolsPage(currentPage + 1);
      }
    }
  }, [currentPage, totalPages, needsServerFiltering, hasActiveFilters, preloadToolsPage]);

  // 处理无限滚动加载更多
  const handleLoadMore = useCallback(() => {
    if (!needsServerFiltering && !hasActiveFilters) {
      loadMore(serverFilters);
    }
  }, [needsServerFiltering, hasActiveFilters, loadMore, serverFilters]);

  // 虚拟滚动（react-virtuoso）在部分环境会出现“已加载但不渲染卡片”的兼容性问题。
  // 为确保工具中心首屏稳定可见，默认关闭虚拟滚动，使用普通分页渲染。
  const enableVirtualScroll = false;

  // 统一重试（带上当前筛选/页码）
  const handleRetryLoad = useCallback(() => {
    loadTools(false, currentPage, serverFilters);
  }, [loadTools, currentPage, serverFilters]);

  // ========================================
  // 渲染
  // ========================================

  // 加载骨架屏
  // 仅在“首次无数据”时显示全屏骨架屏，避免底部预加载/翻页时出现闪动。
  if (loading && tools.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 页面标题（先渲染结构，避免用户看到“空白骨架”） */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">工具中心</h1>
            <p className="text-lg text-gray-600">
              发现最适合土木工程师的AI工具和效率工具
            </p>
          </div>

          {/* 搜索栏骨架 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>

          {/* 工具卡片骨架网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(typeof window !== 'undefined' && window.innerWidth < 768 ? 3 : window.innerWidth < 1024 ? 6 : 9)].map((_, index) => (
              <ToolCardSkeleton key={index} viewMode="grid" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">工具中心</h1>
          <p className="text-lg text-gray-600">
            发现最适合土木工程师的AI工具和效率工具
          </p>

          {/* 错误提示 */}
          {loadError && (
            <div className="mt-4 p-4 border rounded-lg">
              <div className="flex items-start space-x-3">
                {/* 状态图标 */}
                <div className="flex-shrink-0 mt-1">
                  {isOffline ? (
                    <WifiOff className="w-5 h-5 text-red-500" />
                  ) : loading ? (
                    <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                  ) : retryCount > 0 ? (
                    <Clock className="w-5 h-5 text-orange-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>

                {/* 错误信息和状态 */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${
                    isOffline ? 'text-red-700' :
                    loading ? 'text-blue-700' :
                    retryCount > 0 ? 'text-orange-700' : 'text-red-700'
                  }`}>
                    {isOffline ? '网络离线' :
                     loading ? '正在加载...' :
                     retryCount > 0 ? `正在重试 (第${retryCount}次)` : '加载失败'}
                  </div>

                  <div className={`text-sm mt-1 ${
                    isOffline ? 'text-red-600 bg-red-50' :
                    loading ? 'text-blue-600 bg-blue-50' :
                    retryCount > 0 ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50'
                  } p-2 rounded`}>
                    {loadError}
                  </div>

                  {/* 重试计数和进度提示 */}
                  {retryCount > 0 && !loading && (
                    <div className="mt-2 text-xs text-orange-600 flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>系统将在几秒后自动重试</span>
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="flex-shrink-0">
                  {isOffline ? (
                    <div className="flex flex-col space-y-2">
                      <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
                      >
                        <Wifi className="w-3 h-3 mr-1" />
                        检查网络
                      </button>
                    </div>
                  ) : !loading && (
                    <button
                      onClick={handleRetryLoad}
                      disabled={loading}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                      {retryCount > 0 ? '立即重试' : '重试'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search and Filters */}
        <Suspense fallback={
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="animate-pulse">
              <div className="h-12 bg-gray-200 rounded-lg mb-4"></div>
              <div className="h-10 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        }>
          <ToolFilters
            searchValue={filters.search}
            onSearchChange={(value) => handleFilterChange('search', value)}
            isPending={isPending}
            searchInputId={searchId}
            categories={categories}
            selectedCategories={filters.categories}
            onCategoryToggle={handleCategoryToggle}
            selectedFeatures={filters.features}
            onFeatureToggle={handleFeatureToggle}
            pricingValue={filters.pricing}
            onPricingChange={(value) => handleFilterChange('pricing', value)}
            sortBy={filters.sortBy}
            onSortChange={(value) => handleFilterChange('sortBy', value)}
            sortOptions={[
              { value: 'upvotes', label: '最受欢迎' },
              { value: 'date_added', label: '最新收录' },
              { value: 'rating', label: '评分最高' },
              { value: 'views', label: '浏览最多' }
            ]}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showFilters={showFilters}
            onFiltersToggle={() => setShowFilters(!showFilters)}
            onClearFilters={clearFilters}
          />
        </Suspense>

        {/* Tools Grid */}
        <Suspense fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
              <ToolCardSkeleton key={index} viewMode="grid" />
            ))}
          </div>
        }>
          <ToolGrid
            tools={tools}
            totalCount={displayCount}
            allTools={allTools}
            loading={loading}
            viewMode={viewMode}
            paginatedTools={paginatedTools}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            toolsPerPage={TOOLS_PER_PAGE}
            searchQuery={filters.search}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            favoriteStates={favoriteStates}
            onFavoriteToggle={handleFavoriteToggle}
            user={user}
            onPreloadNext={handlePreloadNext}
            onLoadMore={handleLoadMore}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            enableVirtualScroll={enableVirtualScroll}
          />
        </Suspense>

        {/* 开发模式性能报告按钮 */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => printReport()}
              className="text-xs bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded text-gray-600"
            >
              📊 性能报告
            </button>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode="login"
      />
    </div>
  );
});

ToolsPage.displayName = 'ToolsPage';

export default ToolsPage;
