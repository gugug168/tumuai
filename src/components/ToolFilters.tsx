import React, { useCallback, useMemo } from 'react';
import {
  Filter,
  Search,
  RefreshCw,
  Grid,
  List,
  X
} from 'lucide-react';
import { PRICING_OPTIONS, FALLBACK_FEATURES } from '../lib/config';

/**
 * ToolFilters 组件 - 工具筛选器 UI
 *
 * 功能:
 * - 搜索输入 (带防抖)
 * - 分类筛选
 * - 功能特性筛选
 * - 定价筛选
 * - 排序选项
 * - 视图切换 (网格/列表)
 * - 移动端适配
 */
interface ToolFiltersProps {
  // 搜索
  searchValue: string;
  onSearchChange: (value: string) => void;
  isPending: boolean;
  searchInputId: string;

  // 分类
  categories: string[];
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;

  // 功能特性
  selectedFeatures: string[];
  onFeatureToggle: (feature: string) => void;

  // 定价
  pricingValue: string;
  onPricingChange: (value: string) => void;

  // 排序
  sortBy: string;
  onSortChange: (value: string) => void;
  sortOptions: readonly { value: string; label: string }[];

  // 视图模式
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;

  // 筛选面板
  showFilters: boolean;
  onFiltersToggle: () => void;
  onClearFilters: () => void;

  // 移动端
  isMobile?: boolean;
}

const ToolFilters = React.memo<ToolFiltersProps>(({
  searchValue,
  onSearchChange,
  isPending,
  searchInputId,
  categories,
  selectedCategories,
  onCategoryToggle,
  selectedFeatures,
  onFeatureToggle,
  pricingValue,
  onPricingChange,
  sortBy,
  onSortChange,
  sortOptions,
  viewMode,
  onViewModeChange,
  showFilters,
  onFiltersToggle,
  onClearFilters,
  isMobile = false
}) => {
  // 计算激活的筛选器数量
  const activeFiltersCount = useMemo(() => {
    return selectedCategories.length +
      selectedFeatures.length +
      (pricingValue ? 1 : 0) +
      (searchValue ? 1 : 0);
  }, [selectedCategories.length, selectedFeatures.length, pricingValue, searchValue]);

  // 处理搜索输入变化 (由父组件的 useToolFilters 处理防抖)
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  }, [onSearchChange]);

  // 处理排序变化
  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onSortChange(e.target.value);
  }, [onSortChange]);

  // 处理定价变化
  const handlePricingChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onPricingChange(e.target.value);
  }, [onPricingChange]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 mb-8">
      {/* 移动端筛选按钮 */}
      {isMobile && (
        <div className="md:hidden mb-4">
          <button
            onClick={onFiltersToggle}
            className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border transition-all ${
              showFilters || activeFiltersCount > 0
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700'
            }`}
          >
            <Filter className="w-5 h-5" />
            <span className="font-medium">筛选工具</span>
            {activeFiltersCount > 0 && (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        {/* Search Bar */}
        <div className="flex-1 max-w-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              id={searchInputId}
              name="search"
              type="text"
              value={searchValue}
              onChange={handleSearchChange}
              placeholder="搜索工具名称、功能、分类..."
              className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
              aria-label="搜索AI工具"
            />
            {/* 加载指示器 */}
            {isPending && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <RefreshCw className="animate-spin text-gray-400 w-4 h-4" />
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-4">
          {/* Filter Toggle */}
          <button
            onClick={onFiltersToggle}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
              showFilters || activeFiltersCount > 0
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>筛选</span>
            {activeFiltersCount > 0 && (
              <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={handleSortChange}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              aria-label="网格视图"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              aria-label="列表视图"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <>
          {/* 移动端遮罩 */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={onFiltersToggle}
          />

          {/* 筛选面板 */}
          <div className={`${
            showFilters
              ? 'md:mt-6 md:pt-6 md:border-t relative md:relative fixed md:bg-transparent bg-white z-50'
              : 'hidden'
          } md:block ${
            showFilters ? 'block' : ''
          } ${showFilters ? 'inset-y-0 left-0 w-full md:w-auto md:inset-auto' : ''}`}>
            {/* 移动端关闭按钮 */}
            <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">筛选条件</h3>
              <button
                onClick={onFiltersToggle}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 md:p-0 md:mt-6 md:pt-6 md:border-t border-gray-200 max-h-[60vh] md:max-h-none overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Categories */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">分类</h4>
                  <div className="space-y-2">
                    {categories.map(category => {
                      const checkboxId = `category-${category.replace(/\s+/g, '-')}`;
                      return (
                        <label key={category} htmlFor={checkboxId} className="flex items-center cursor-pointer">
                          <input
                            id={checkboxId}
                            type="checkbox"
                            checked={selectedCategories.includes(category)}
                            onChange={() => onCategoryToggle(category)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{category}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Features */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">功能特性</h4>
                  <div className="space-y-2">
                    {FALLBACK_FEATURES.map(feature => {
                      const checkboxId = `feature-${feature.replace(/\s+/g, '-')}`;
                      return (
                        <label key={feature} htmlFor={checkboxId} className="flex items-center cursor-pointer">
                          <input
                            id={checkboxId}
                            type="checkbox"
                            checked={selectedFeatures.includes(feature)}
                            onChange={() => onFeatureToggle(feature)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{feature}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Pricing */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">定价模式</h4>
                  <div className="space-y-2">
                    {PRICING_OPTIONS.map(option => {
                      const radioId = `pricing-${option.value}`;
                      return (
                        <label key={option.value} htmlFor={radioId} className="flex items-center cursor-pointer">
                          <input
                            id={radioId}
                            type="radio"
                            name="pricing"
                            value={option.value}
                            checked={pricingValue === option.value}
                            onChange={handlePricingChange}
                            className="border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Clear Filters */}
              {activeFiltersCount > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 hidden md:block">
                  <button
                    onClick={onClearFilters}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    清除所有筛选条件
                  </button>
                </div>
              )}
            </div>

            {/* 移动端应用按钮 */}
            <div className="md:hidden sticky bottom-0 bg-white border-t border-gray-200 p-4 space-y-2">
              {activeFiltersCount > 0 && (
                <button
                  onClick={onClearFilters}
                  className="w-full py-3 text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  清除所有筛选条件
                </button>
              )}
              <button
                onClick={onFiltersToggle}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                应用筛选
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

ToolFilters.displayName = 'ToolFilters';

export { ToolFilters };
export default ToolFilters;
