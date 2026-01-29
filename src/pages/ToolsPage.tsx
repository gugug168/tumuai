import React, { useState, useEffect, useMemo, useId, useCallback } from 'react';
import { WifiOff, RefreshCw, AlertCircle, Wifi, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast, createToastHelpers } from '../components/Toast';
import AuthModal from '../components/AuthModal';
import ToolCardSkeleton from '../components/ToolCardSkeleton';
import ToolFilters from '../components/ToolFilters';
import ToolGrid from '../components/ToolGrid';
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
    allFilteredTools,
    totalToolsCount,
    filteredToolsCount,
    loading,
    loadError,
    isOffline,
    retryCount,
    currentPage,
    categories,
    favoriteStates,
    loadTools,
    loadCategories,
    loadFavoriteStates,
    toggleFavorite,
    retryLoad,
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

  // 初始加载
  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([
        loadTools(false, 1),
        loadCategories()
      ]);
    };

    loadInitialData();
  }, [loadCategories]); // loadTools 通过依赖触发

  // 从 URL 参数初始化筛选
  useEffect(() => {
    const hasCategory = initializeFromUrl();
    if (hasCategory) {
      setShowFilters(true);
    }
  }, [initializeFromUrl]);

  // 筛选条件变化时重新加载数据 (服务端筛选)
  useEffect(() => {
    if (needsServerFiltering) {
      const searchFilters: ToolSearchFilters = {};
      if (filters.categories.length > 0) searchFilters.categories = filters.categories;
      if (filters.pricing) searchFilters.pricing = filters.pricing;
      if (filters.features.length > 0) searchFilters.features = filters.features;
      searchFilters.sortBy = filters.sortBy as any;

      loadTools(false, 1, searchFilters);
    }
  }, [filters.categories, filters.pricing, filters.features, filters.sortBy, needsServerFiltering, loadTools]);

  // 重置到第一页当筛选条件变化
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch, filters.categories, filters.features, filters.pricing, setCurrentPage]);

  // 页码变化时加载数据 (仅无服务端筛选时)
  useEffect(() => {
    if (currentPage > 1 && !needsServerFiltering) {
      loadTools(false, currentPage);
    }
  }, [currentPage, needsServerFiltering, loadTools]);

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
    return filterTools(tools, deferredSearch, filters);
  }, [tools, deferredSearch, filters]);

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
    if (needsServerFiltering) {
      const startIndex = (currentPage - 1) * TOOLS_PER_PAGE;
      const endIndex = startIndex + TOOLS_PER_PAGE;
      return allFilteredTools.slice(startIndex, endIndex);
    }
    if (hasActiveFilters) {
      const startIndex = (currentPage - 1) * TOOLS_PER_PAGE;
      const endIndex = startIndex + TOOLS_PER_PAGE;
      return filteredTools.slice(startIndex, endIndex);
    }
    return tools;
  }, [needsServerFiltering, allFilteredTools, hasActiveFilters, filteredTools, currentPage, tools, TOOLS_PER_PAGE]);

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
  }, [setCurrentPage]);

  // 处理预加载下一页
  const handlePreloadNext = useCallback(() => {
    if (currentPage < totalPages) {
      // 预加载下一页数据
      if (!needsServerFiltering) {
        loadTools(false, currentPage + 1);
      }
    }
  }, [currentPage, totalPages, needsServerFiltering, loadTools]);

  // ========================================
  // 渲染
  // ========================================

  // 加载骨架屏
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 页面标题骨架 */}
          <div className="mb-8">
            <div className="h-8 bg-gray-200 rounded w-32 animate-pulse mb-4"></div>
            <div className="h-5 bg-gray-200 rounded w-64 animate-pulse"></div>
          </div>

          {/* 搜索栏骨架 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>

          {/* 工具卡片骨架网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
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
                      onClick={retryLoad}
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

        {/* Tools Grid */}
        <ToolGrid
          tools={tools}
          totalCount={displayCount}
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
        />

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
