import React, { useState, useEffect, useMemo, useId, useCallback } from 'react';
import { WifiOff, RefreshCw, AlertCircle, Wifi, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast, createToastHelpers } from '../components/Toast';
import AuthModal from '../components/AuthModal';
import ToolCardSkeleton from '../components/ToolCardSkeleton';

// Phase 1优化: 静态导入 ToolFilters 和 ToolGrid，消除嵌套懒加载瀑布
// App.tsx 已将 ToolsPage 设为 lazy，内部组件无需再次 lazy
// 访问工具页的用户 100% 需要这两个组件，不存在"可能不需要"的场景
import { ToolFilters } from '../components/ToolFilters';
import { ToolGrid } from '../components/ToolGrid';

import { useToolFilters, filterTools } from '../hooks/useToolFilters';
import { useToolData } from '../hooks/useToolData';
import { usePerformance } from '../hooks/usePerformance';
import { useMetaTags } from '../hooks/useMetaTags';
import { useLocale } from '../contexts/LocaleContext';
import { getToolsPageUIText } from '../lib/translations';
import type { ToolSearchFilters } from '../types';

const PRICING_VALUES = ['Free', 'Freemium', 'Paid', 'Trial'] as const;
const SORT_VALUES = ['upvotes', 'date_added', 'rating', 'views', 'name'] as const;

type PricingValue = ToolSearchFilters['pricing'];
type SortValue = Exclude<ToolSearchFilters['sortBy'], undefined>;

function isPricingValue(value: string): value is PricingValue {
  return PRICING_VALUES.includes(value as PricingValue);
}

function isSortValue(value: string): value is SortValue {
  return SORT_VALUES.includes(value as SortValue);
}

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
  // Phase 1优化: 接入 useMetaTags hook
  useMetaTags({
    title: '工具中心 - TumuAI.net',
    description: '发现最适合土木工程师的AI工具和效率工具，涵盖结构设计、BIM建模、施工管理、造价估算等专业领域。',
    canonical: 'https://www.tumuai.net/tools'
  });

  // Hooks
  const { user } = useAuth();
  const { showToast } = useToast();
  const toast = createToastHelpers(showToast);
  const searchId = useId();
  const { locale } = useLocale();
  const lang = locale;

  // 性能监控
  const { recordApiCall, recordInteraction, printReport } = usePerformance('ToolsPage');

  // 筛选状态管理
  const {
    filters,
    deferredSearch,
    isPending,
    hasActiveFilters,
    needsServerFiltering,
    handleFilterChange,
    handleCategoryToggle,
    handleFeatureToggle,
    clearFilters,
    initializeFromUrl
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
    if (filters.pricing && isPricingValue(filters.pricing)) {
      f.pricing = filters.pricing;
    }
    if (filters.features.length > 0) f.features = filters.features;
    if (isSortValue(filters.sortBy)) {
      f.sortBy = filters.sortBy;
    }
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
  // 仅在"首次无数据"时显示全屏骨架屏，避免底部预加载/翻页时出现闪动。
  if (loading && tools.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 页面标题（先渲染结构，避免用户看到"空白骨架"） */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{getToolsPageUIText('title', lang)}</h1>
            <p className="text-lg text-gray-600">
              {getToolsPageUIText('subtitle', lang)}
            </p>
          </div>

          {/* 搜索栏骨架 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>

          {/* 工具卡片骨架网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Phase 3优化: 固定渲染9个骨架屏，依赖 Tailwind grid 响应式自动适配显示数量 */}
            {[...Array(9)].map((_, index) => (
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
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{getToolsPageUIText('title', lang)}</h1>
          <p className="text-lg text-gray-600">
            {getToolsPageUIText('subtitle', lang)}
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
                    {isOffline ? getToolsPageUIText('offline', lang) :
                     loading ? getToolsPageUIText('loading', lang) :
                     retryCount > 0 ? `${getToolsPageUIText('retrying', lang)} (${retryCount})` : getToolsPageUIText('loadFailed', lang)}
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
                      <span>{getToolsPageUIText('autoRetryHint', lang)}</span>
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
                        {getToolsPageUIText('checkNetwork', lang)}
                      </button>
                    </div>
                  ) : !loading && (
                    <button
                      onClick={handleRetryLoad}
                      disabled={loading}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                      {retryCount > 0 ? getToolsPageUIText('retryNow', lang) : getToolsPageUIText('retry', lang)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search and Filters */}
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
              { value: 'upvotes', label: getToolsPageUIText('sortMostPopular', lang) },
              { value: 'date_added', label: getToolsPageUIText('sortNewest', lang) },
              { value: 'rating', label: getToolsPageUIText('sortHighestRated', lang) },
              { value: 'views', label: getToolsPageUIText('sortMostViewed', lang) }
            ]}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showFilters={showFilters}
            onFiltersToggle={() => setShowFilters(!showFilters)}
            onClearFilters={clearFilters}
          />

        {/* Tools Grid */}
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

        {/* 开发模式性能报告按钮 */}
        {import.meta.env.DEV && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => printReport()}
              className="text-xs bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded text-gray-600"
            >
              📊 {getToolsPageUIText('performanceReport', lang)}
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
