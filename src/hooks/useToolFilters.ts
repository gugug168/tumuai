import { useState, useCallback, useDeferredValue, useTransition, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SORT_OPTIONS } from '../lib/config';
import type { Tool } from '../types';

const DEFAULT_SORT_BY = 'upvotes';

function normalizeSortBy(raw: string | null | undefined): string {
  const v = (raw || '').trim();
  if (!v) return DEFAULT_SORT_BY;
  if (['upvotes', 'date_added', 'rating', 'views', 'name'].includes(v)) return v;
  return DEFAULT_SORT_BY;
}

function parseCsvParam(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * 筛选状态接口
 */
export interface ToolFiltersState {
  search: string;
  categories: string[];
  features: string[];
  pricing: string;
  sortBy: string;
}

/**
 * useToolFilters Hook - 管理工具筛选状态和逻辑
 *
 * 功能:
 * - 统一管理所有筛选状态
 * - 搜索输入防抖优化 (300ms)
 * - 非紧急更新使用 useTransition
 * - 使用 useDeferredValue 优化搜索体验
 * - 从 URL 参数初始化状态
 * - 同步状态到 URL 参数
 */
export function useToolFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const initialFromUrl = useMemo<ToolFiltersState>(() => {
    const search = searchParams.get('search') || '';
    const categoryRaw = searchParams.get('category') || searchParams.get('categories') || '';
    const featuresRaw = searchParams.get('features') || '';
    const pricing = searchParams.get('pricing') || '';
    const sortBy = normalizeSortBy(searchParams.get('sortBy') || searchParams.get('sort'));

    return {
      search,
      categories: parseCsvParam(categoryRaw),
      features: parseCsvParam(featuresRaw),
      pricing,
      sortBy
    };
  }, [searchParams]);

  // 筛选状态
  const [filters, setFiltersState] = useState<ToolFiltersState>({
    search: initialFromUrl.search,
    categories: initialFromUrl.categories,
    features: initialFromUrl.features,
    pricing: initialFromUrl.pricing,
    sortBy: initialFromUrl.sortBy
  });

  // 搜索防抖定时器引用
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // React 18优化：使用useDeferredValue优化搜索体验
  const deferredSearch = useDeferredValue(filters.search);

  /**
   * 清理防抖定时器
   */
  const clearDebounce = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
  }, []);

  /**
   * 统一的筛选变更处理函数
   * 搜索输入使用 300ms 防抖，其他筛选使用 transition
   */
  const handleFilterChange = useCallback((type: keyof ToolFiltersState, value: string | string[]) => {
    if (type === 'search') {
      // 搜索输入使用防抖优化
      clearDebounce();
      searchDebounceRef.current = setTimeout(() => {
        setFiltersState(prev => ({ ...prev, [type]: value }));
        // 同步到 URL
        setSearchParams((params) => {
          const newParams = new URLSearchParams(params);
          if (value) {
            newParams.set('search', value as string);
          } else {
            newParams.delete('search');
          }

          return newParams.toString() === params.toString() ? params : newParams;
        }, { replace: true });
      }, 300);
    } else {
      // 其他筛选使用transition（非紧急更新）
      startTransition(() => {
        setFiltersState(prev => ({ ...prev, [type]: value }));
      });

      // 同步到 URL（不做防抖）
      setSearchParams((params) => {
        const newParams = new URLSearchParams(params);

        const strValue = Array.isArray(value) ? value.join(',') : String(value || '');
        if (type === 'categories') {
          if (strValue) newParams.set('category', strValue);
          else newParams.delete('category');
          // Back-compat cleanup
          newParams.delete('categories');
        } else if (type === 'features') {
          if (strValue) newParams.set('features', strValue);
          else newParams.delete('features');
        } else if (type === 'pricing') {
          if (strValue) newParams.set('pricing', strValue);
          else newParams.delete('pricing');
        } else if (type === 'sortBy') {
          const normalized = normalizeSortBy(strValue);
          if (normalized !== DEFAULT_SORT_BY) newParams.set('sortBy', normalized);
          else newParams.delete('sortBy');
          // Back-compat cleanup
          newParams.delete('sort');
        }

        return newParams.toString() === params.toString() ? params : newParams;
      }, { replace: true });
    }
  }, [clearDebounce, setSearchParams]);

  /**
   * 切换分类选择
   */
  const handleCategoryToggle = useCallback((category: string) => {
    let nextCategories: string[] = [];
    startTransition(() => {
      setFiltersState(prev => ({
        ...prev,
        categories: (nextCategories = prev.categories.includes(category)
          ? prev.categories.filter(c => c !== category)
          : [...prev.categories, category])
      }));
    });

    setSearchParams((params) => {
      const newParams = new URLSearchParams(params);
      if (nextCategories.length > 0) newParams.set('category', nextCategories.join(','));
      else newParams.delete('category');
      newParams.delete('categories');
      return newParams.toString() === params.toString() ? params : newParams;
    }, { replace: true });
  }, [setSearchParams, startTransition]);

  /**
   * 切换功能特性选择
   */
  const handleFeatureToggle = useCallback((feature: string) => {
    let nextFeatures: string[] = [];
    startTransition(() => {
      setFiltersState(prev => ({
        ...prev,
        features: (nextFeatures = prev.features.includes(feature)
          ? prev.features.filter(f => f !== feature)
          : [...prev.features, feature])
      }));
    });

    setSearchParams((params) => {
      const newParams = new URLSearchParams(params);
      if (nextFeatures.length > 0) newParams.set('features', nextFeatures.join(','));
      else newParams.delete('features');
      return newParams.toString() === params.toString() ? params : newParams;
    }, { replace: true });
  }, [setSearchParams, startTransition]);

  /**
   * 清除所有筛选条件
   */
  const clearFilters = useCallback(() => {
    setFiltersState({
      search: '',
      categories: [],
      features: [],
      pricing: '',
      sortBy: DEFAULT_SORT_BY
    });
    setSearchParams({}, { replace: true });
    clearDebounce();
  }, [setSearchParams, clearDebounce]);

  /**
   * 计算激活的筛选器数量
   */
  const activeFiltersCount = useMemo(() => {
    return filters.categories.length +
      filters.features.length +
      (filters.pricing ? 1 : 0) +
      (filters.search ? 1 : 0);
  }, [filters]);

  /**
   * 检查是否有激活的筛选器
   */
  const hasActiveFilters = useMemo(() => {
    return activeFiltersCount > 0;
  }, [activeFiltersCount]);

  /**
   * 检查是否需要服务端筛选
   * (搜索/分类/定价/功能/排序需要服务端处理，避免“只筛第一页”的问题)
   */
  const needsServerFiltering = useMemo(() => {
    return filters.categories.length > 0 ||
      filters.pricing ||
      filters.features.length > 0 ||
      filters.search.trim().length > 0 ||
      filters.sortBy !== 'upvotes';
  }, [filters]);

  /**
   * 从 URL 参数初始化筛选状态
   */
  const initializeFromUrl = useCallback(() => {
    const searchQuery = searchParams.get('search');
    const categoryRaw = searchParams.get('category') || searchParams.get('categories');
    const featuresRaw = searchParams.get('features');
    const pricing = searchParams.get('pricing') || '';
    const sortBy = normalizeSortBy(searchParams.get('sortBy') || searchParams.get('sort'));

    const categories = parseCsvParam(categoryRaw);
    const features = parseCsvParam(featuresRaw);

    setFiltersState(prev => ({
      ...prev,
      search: searchQuery || '',
      categories,
      features,
      pricing,
      sortBy
    }));

    const hasNonSearchFilters = categories.length > 0 ||
      features.length > 0 ||
      !!pricing ||
      sortBy !== DEFAULT_SORT_BY;

    return hasNonSearchFilters;
  }, [searchParams]);

  /**
   * 组件卸载时清理定时器
   */
  const cleanup = useCallback(() => {
    clearDebounce();
  }, [clearDebounce]);

  return {
    // 状态
    filters,
    deferredSearch,
    isPending,

    // 计算值
    activeFiltersCount,
    hasActiveFilters,
    needsServerFiltering,

    // 方法
    handleFilterChange,
    handleCategoryToggle,
    handleFeatureToggle,
    clearFilters,
    initializeFromUrl,
    cleanup,

    // 排序选项
    sortOptions: SORT_OPTIONS
  };
}

/**
 * 筛选工具函数 - 客户端筛选逻辑
 */
export function filterTools(
  tools: Tool[],
  searchQuery: string,
  filters: ToolFiltersState
): Tool[] {
  let filtered = [...tools];

  // 搜索筛选
  if (searchQuery) {
    const searchLower = searchQuery.toLowerCase();
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
      filters.features.every(feature => tool.features.includes(feature))
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
        return Date.parse(b.date_added) - Date.parse(a.date_added);
      case 'rating':
        return (b.rating || 0) - (a.rating || 0);
      case 'views':
        return (b.views || 0) - (a.views || 0);
      case 'upvotes':
      default:
        return (b.upvotes || 0) - (a.upvotes || 0);
    }
  });

  return filtered;
}
