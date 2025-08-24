import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Star, 
  ExternalLink, 
  Heart, 
  Eye, 
  Filter,
  Grid,
  List,
  Search
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getToolsOptimized } from '../lib/supabase-optimized';
import type { Tool } from '../types';
import { apiRequestWithRetry } from '../lib/api';
import { addToFavorites, removeFromFavorites, isFavorited } from '../lib/community';
import AuthModal from '../components/AuthModal';
import OptimizedImage from '../components/OptimizedImage';

const categories = [
  'AI结构设计',
  'BIM软件', 
  '智能施工管理',
  '效率工具',
  '岩土工程',
  '项目管理'
];

const features = [
  'AI优化',
  '参数化设计',
  '自动生成',
  '智能分析',
  '云端协作',
  '实时计算'
];

const pricingOptions = [
  { value: 'Free', label: '免费' },
  { value: 'Freemium', label: '免费增值' },
  { value: 'Paid', label: '付费' },
  { value: 'Trial', label: '试用' }
];

const sortOptions = [
  { value: 'upvotes', label: '最受欢迎' },
  { value: 'date_added', label: '最新收录' },
  { value: 'rating', label: '评分最高' },
  { value: 'views', label: '浏览最多' }
];

const ToolsPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tools, setTools] = useState<Tool[]>([]);
  const [filteredTools, setFilteredTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [favoriteStates, setFavoriteStates] = useState<{[key: string]: boolean}>({});
  
  // 筛选状态
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    categories: [] as string[],
    features: [] as string[],
    pricing: '',
    sortBy: 'upvotes'
  });

  useEffect(() => {
    loadTools();
  }, []);

  useEffect(() => {
    // 从URL参数初始化搜索
    const searchQuery = searchParams.get('search');
    if (searchQuery) {
      setFilters(prev => ({ ...prev, search: searchQuery }));
    }
  }, [searchParams]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  useEffect(() => {
    if (user) {
      loadFavoriteStates();
    }
  }, [user, loadFavoriteStates]);

  const loadTools = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const data = await apiRequestWithRetry(() => getToolsOptimized({ limit: 60 }), 2, 1500);
      setTools(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('加载工具失败:', error);
      setLoadError(error instanceof Error ? error.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const loadFavoriteStates = useCallback(async () => {
    if (!user) return;
    
    const states: {[key: string]: boolean} = {};
    for (const tool of tools) {
      try {
        const favorited = await isFavorited(tool.id);
        states[tool.id] = favorited;
      } catch (error) {
        console.error('检查收藏状态失败:', error);
        states[tool.id] = false;
      }
    }
    setFavoriteStates(states);
  }, [user, tools]);

  const applyFilters = useCallback(() => {
    let filtered = [...tools];

    // 搜索筛选
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(tool => 
        tool.name.toLowerCase().includes(searchLower) ||
        tool.tagline.toLowerCase().includes(searchLower) ||
        tool.description?.toLowerCase().includes(searchLower) ||
        tool.categories.some(cat => cat.toLowerCase().includes(searchLower)) ||
        tool.features.some(feat => feat.toLowerCase().includes(searchLower))
      );
    }

    // 分类筛选
    if (filters.categories.length > 0) {
      filtered = filtered.filter(tool =>
        filters.categories.some(category => tool.categories.includes(category))
      );
    }

    // 功能筛选
    if (filters.features.length > 0) {
      filtered = filtered.filter(tool =>
        filters.features.some(feature => tool.features.includes(feature))
      );
    }

    // 定价筛选
    if (filters.pricing) {
      filtered = filtered.filter(tool => tool.pricing === filters.pricing);
    }

    // 排序
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'date_added':
          return new Date(b.date_added).getTime() - new Date(a.date_added).getTime();
        case 'rating':
          return b.rating - a.rating;
        case 'views':
          return b.views - a.views;
        case 'upvotes':
        default:
          return b.upvotes - a.upvotes;
      }
    });

    setFilteredTools(filtered);
  }, [tools, filters]);

  const handleFilterChange = (type: string, value: string | string[]) => {
    setFilters(prev => ({
      ...prev,
      [type]: value
    }));
  };

  const handleCategoryToggle = (category: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const handleFeatureToggle = (feature: string) => {
    setFilters(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }));
  };

  const handleFavoriteToggle = async (toolId: string) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      const currentState = favoriteStates[toolId];
      if (currentState) {
        await removeFromFavorites(toolId);
        setFavoriteStates(prev => ({ ...prev, [toolId]: false }));
      } else {
        await addToFavorites(toolId);
        setFavoriteStates(prev => ({ ...prev, [toolId]: true }));
      }
    } catch (error) {
      console.error('收藏操作失败:', error);
      alert('操作失败，请重试');
    }
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      categories: [],
      features: [],
      pricing: '',
      sortBy: 'upvotes'
    });
    setSearchParams({});
  };

  const activeFiltersCount = filters.categories.length + filters.features.length + 
    (filters.pricing ? 1 : 0) + (filters.search ? 1 : 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载工具中...</p>
          {loadError && (
            <p className="text-red-500 mt-2">{loadError}</p>
          )}
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
          {loadError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {loadError}
            </div>
          )}
        </div>

        {/* Search and Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            {/* Search Bar */}
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="搜索工具名称、功能、分类..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-4">
              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
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
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
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
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Categories */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">分类</h4>
                  <div className="space-y-2">
                    {categories.map(category => (
                      <label key={category} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.categories.includes(category)}
                          onChange={() => handleCategoryToggle(category)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{category}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Features */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">功能特性</h4>
                  <div className="space-y-2">
                    {features.map(feature => (
                      <label key={feature} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.features.includes(feature)}
                          onChange={() => handleFeatureToggle(feature)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{feature}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Pricing */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">定价模式</h4>
                  <div className="space-y-2">
                    {pricingOptions.map(option => (
                      <label key={option.value} className="flex items-center">
                        <input
                          type="radio"
                          name="pricing"
                          value={option.value}
                          checked={filters.pricing === option.value}
                          onChange={(e) => handleFilterChange('pricing', e.target.value)}
                          className="border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Clear Filters */}
              {activeFiltersCount > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={clearFilters}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    清除所有筛选条件
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-gray-600">
            找到 <span className="font-semibold text-gray-900">{filteredTools.length}</span> 个工具
            {filters.search && (
              <span> 包含 "<span className="font-semibold">{filters.search}</span>"</span>
            )}
          </p>
        </div>

        {/* Tools Grid/List */}
        {filteredTools.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">未找到匹配的工具</h3>
            <p className="text-gray-600 mb-6">
              尝试调整筛选条件或搜索关键词
            </p>
            <button
              onClick={clearFilters}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              清除筛选条件
            </button>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-4'
          }>
            {filteredTools.map((tool) => (
              <div
                key={tool.id}
                className={`bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-300 overflow-hidden group ${
                  viewMode === 'list' ? 'flex items-center p-6' : 'p-6'
                }`}
              >
                {viewMode === 'grid' ? (
                  // Grid View
                  <>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <OptimizedImage
                          src={tool.logo_url || 'https://images.pexels.com/photos/3862132/pexels-photo-3862132.jpeg?auto=compress&cs=tinysrgb&w=100'}
                          alt={tool.name}
                          className="w-12 h-12 rounded-lg"
                          priority={false}
                          lazyLoad={true}
                          sizes="48px"
                        />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                            {tool.name}
                          </h3>
                          <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="text-sm text-gray-600">{tool.rating}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleFavoriteToggle(tool.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Heart className={`w-5 h-5 ${favoriteStates[tool.id] ? 'fill-current text-red-500' : ''}`} />
                      </button>
                    </div>

                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                      {tool.tagline}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {tool.categories.slice(0, 2).map((category, index) => (
                        <span key={index} className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                          {category}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-green-600">
                        {tool.pricing === 'Free' ? '完全免费' : 
                         tool.pricing === 'Freemium' ? '提供免费版' :
                         tool.pricing === 'Paid' ? '付费' : '免费试用'}
                      </span>
                      <div className="flex items-center space-x-3 text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Eye className="w-3 h-3" />
                          <span>{tool.views}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Link
                        to={`/tools/${tool.id}`}
                        className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors text-center"
                      >
                        查看详情
                      </Link>
                      <a
                        href={tool.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-gray-100 text-gray-700 py-2 px-3 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </>
                ) : (
                  // List View
                  <>
                    <div className="flex items-center space-x-4 flex-1">
                      <OptimizedImage
                        src={tool.logo_url || 'https://images.pexels.com/photos/3862132/pexels-photo-3862132.jpeg?auto=compress&cs=tinysrgb&w=100'}
                        alt={tool.name}
                        className="w-16 h-16 rounded-lg"
                        priority={false}
                        lazyLoad={true}
                        sizes="64px"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                            {tool.name}
                          </h3>
                          <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="text-sm text-gray-600">{tool.rating}</span>
                          </div>
                        </div>
                        <p className="text-gray-600 mb-2">{tool.tagline}</p>
                        <div className="flex items-center space-x-4">
                          <div className="flex flex-wrap gap-2">
                            {tool.categories.slice(0, 3).map((category, index) => (
                              <span key={index} className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                                {category}
                              </span>
                            ))}
                          </div>
                          <span className="text-sm font-medium text-green-600">
                            {tool.pricing === 'Free' ? '完全免费' : 
                             tool.pricing === 'Freemium' ? '提供免费版' :
                             tool.pricing === 'Paid' ? '付费' : '免费试用'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleFavoriteToggle(tool.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Heart className={`w-5 h-5 ${favoriteStates[tool.id] ? 'fill-current text-red-500' : ''}`} />
                      </button>
                      <Link
                        to={`/tools/${tool.id}`}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        查看详情
                      </Link>
                      <a
                        href={tool.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-gray-100 text-gray-700 p-2 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </>
                )}
              </div>
            ))}
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
};

export default ToolsPage;