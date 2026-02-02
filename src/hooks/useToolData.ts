import { useState, useCallback, useEffect, useRef } from 'react';
import type { Tool, ToolSearchFilters } from '../types';
import {
  getTools,
  getCategories,
  getToolsCount,
  getToolsSmart
} from '../lib/supabase';
import { EMERGENCY_CATEGORIES } from '../lib/config';

/**
 * 分页配置
 */
const TOOLS_PER_PAGE = 12;

/**
 * 数据状态接口
 */
interface ToolDataState {
  tools: Tool[];
  totalToolsCount: number;
  filteredToolsCount: number;
  loading: boolean;
  loadError: string | null;
  isOffline: boolean;
  retryCount: number;
}

/**
 * 虚拟滚动状态
 */
interface VirtualScrollState {
  allTools: Tool[];          // 所有已加载的工具（用于虚拟滚动）
  isLoadingMore: boolean;    // 是否正在加载更多
  hasMore: boolean;          // 是否还有更多数据
  currentPage: number;       // 当前已加载到的页码
}

/**
 * useToolData Hook - 管理工具数据获取和状态
 *
 * 功能:
 * - 统一数据获取 (支持服务端筛选和普通分页)
 * - 错误处理和重试机制
 * - 离线状态监听
 * - 分类数据加载
 * - 收藏状态管理
 * - 性能监控集成
 */
export function useToolData(performanceHooks?: {
  recordApiCall: <T>(name: string, apiCall: () => Promise<T>, metadata?: any) => Promise<T>;
  recordInteraction: (name: string, metadata?: any) => void;
}) {
  // 工具数据状态
  const [state, setState] = useState<ToolDataState>({
    tools: [],
    totalToolsCount: 0,
    filteredToolsCount: 0,
    loading: true,
    loadError: null,
    isOffline: !navigator.onLine,
    retryCount: 0
  });

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);

  // 虚拟滚动状态（无限滚动）
  const [virtualScrollState, setVirtualScrollState] = useState<VirtualScrollState>({
    allTools: [],
    isLoadingMore: false,
    hasMore: true,
    currentPage: 0
  });
  const [categories, setCategories] = useState<string[]>([]);
  const currentPageRef = useRef<number>(currentPage);
  const stateRef = useRef<ToolDataState>(state);

  // 收藏状态
  const [favoriteStates, setFavoriteStates] = useState<Record<string, boolean>>({});

  // 引用
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userIdRef = useRef<string | null>(null);
  const preloadingPagesRef = useRef<Set<string>>(new Set());

  const { recordApiCall, recordInteraction } = performanceHooks || {};

  // Keep refs in sync so callbacks don't need to depend on frequently-changing state.
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /**
   * 预加载某一页的数据（不更新 UI 状态）
   *
   * 目的：只做网络/缓存预热，避免触发 ToolsPage 的全屏 loading skeleton，
   * 否则在页面底部会出现“闪动/抖动”的体验问题。
   */
  const preloadToolsPage = useCallback(async (page: number, filters?: ToolSearchFilters) => {
    if (page < 1) return;

    const hasFilters = !!filters &&
      ((filters.search && filters.search.trim().length > 0) ||
       (filters.categories && filters.categories.length > 0) ||
       filters.pricing ||
       (filters.features && filters.features.length > 0) ||
       (filters.sortBy && filters.sortBy !== 'upvotes'));

    // 只对“默认列表（无筛选、无搜索、默认排序）”做预加载；其它情况预加载更耗资源且命中率低。
    if (hasFilters) return;

    const limit = TOOLS_PER_PAGE;
    const offset = (page - 1) * TOOLS_PER_PAGE;
    const key = `tools_page_${page}`;

    if (preloadingPagesRef.current.has(key)) return;
    preloadingPagesRef.current.add(key);

    try {
      const apiCall = () => getToolsSmart(limit, offset, false);
      if (recordApiCall) {
        await recordApiCall('preload_tools_page', apiCall, { page, limit, offset });
      } else {
        await apiCall();
      }
    } catch {
      // 预加载失败不影响主流程，静默忽略
    } finally {
      preloadingPagesRef.current.delete(key);
    }
  }, [recordApiCall]);

  /**
   * 更新状态的辅助函数
   */
  const updateState = useCallback((updates: Partial<ToolDataState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * 加载工具数据
   */
  const loadTools = useCallback(async (
    autoRetry = false,
    page: number = currentPageRef.current,
    filters?: ToolSearchFilters
  ) => {
    // Mark the start of a load. Avoid incrementing retryCount on normal loads; it should reflect retries only.
    const nextRetryCount = autoRetry ? (stateRef.current.retryCount + 1) : 0;
    updateState({ loadError: null, loading: true, retryCount: nextRetryCount });

    try {
      // 判断是否需要使用筛选 API
      const needsServerFiltering = filters &&
        ((filters.search && filters.search.trim().length > 0) ||
         (filters.categories && filters.categories.length > 0) ||
         filters.pricing ||
         (filters.features && filters.features.length > 0) ||
         (filters.sortBy && filters.sortBy !== 'upvotes'));

      if (needsServerFiltering) {
        // 使用筛选 API 获取匹配结果（服务端分页）
        const limit = TOOLS_PER_PAGE;
        const offset = (page - 1) * TOOLS_PER_PAGE;
        const shouldIncludeCount = page === 1;

        const result = recordApiCall
          ? await recordApiCall('load_tools_filtered', async () => {
              return await getToolsSmart(limit, offset, shouldIncludeCount, filters);
            }, { autoRetry, retryCount: nextRetryCount })
          : await getToolsSmart(limit, offset, shouldIncludeCount, filters);

        console.log(`✅ 筛选数据加载成功: ${result.tools.length}个工具, 总数${result.count ?? 'N/A'}`);
        setState(prev => ({
          ...prev,
          tools: Array.isArray(result.tools) ? result.tools : [],
          filteredToolsCount: typeof result.count === 'number' ? result.count : prev.filteredToolsCount,
          loading: false,
          retryCount: 0
        }));
      } else {
        // 普通分页加载
        const limit = TOOLS_PER_PAGE;
        const offset = (page - 1) * TOOLS_PER_PAGE;
        // 只有在首次加载时请求总数，避免每次翻页都触发一次 count 查询（会明显拖慢响应）。
        const shouldIncludeCount = page === 1 && stateRef.current.totalToolsCount === 0;

        console.log(`🔄 开始加载工具数据 (limit: ${limit}, offset: ${offset}, page: ${page})...`);

        const result = recordApiCall
          ? await recordApiCall('load_tools_smart', async () => {
              return await getToolsSmart(limit, offset, shouldIncludeCount);
            }, { autoRetry, retryCount: nextRetryCount })
          : await getToolsSmart(limit, offset, shouldIncludeCount);

        const newTools = Array.isArray(result.tools) ? result.tools : [];
        const totalCount = typeof result.count === 'number' ? result.count : stateRef.current.totalToolsCount;

        console.log(`✅ 工具数据加载成功: ${newTools.length}个工具, 总数${result.count}`);

        setState(prev => ({
          ...prev,
          tools: newTools,
          totalToolsCount: totalCount,
          loading: false,
          retryCount: 0
        }));

        // 同步更新虚拟滚动状态（首次加载时）
        if (page === 1) {
          setVirtualScrollState({
            allTools: newTools,
            isLoadingMore: false,
            hasMore: newTools.length < totalCount,
            currentPage: 1
          });
        }
      }
    } catch (error) {
      console.error('❌ 加载工具失败:', error);

      // 兜底：直接使用原始方法
      try {
        const [data, totalCount] = await Promise.all([
          getTools(TOOLS_PER_PAGE, (page - 1) * TOOLS_PER_PAGE),
          getToolsCount()
        ]);
        setState(prev => ({
          ...prev,
          tools: Array.isArray(data) ? data : [],
          totalToolsCount: totalCount,
          loading: false,
          retryCount: 0
        }));
      } catch (fallbackError) {
        // 错误分类和用户友好的错误信息
        let errorMessage = '加载失败，请稍后重试';

        if (error instanceof Error) {
          if (error.message.includes('网络') || error.message.includes('fetch')) {
            errorMessage = stateRef.current.isOffline
              ? '网络连接已断开，请检查网络设置'
              : '网络连接不稳定，正在重试...';
          } else if (error.message.includes('404')) {
            errorMessage = '服务暂时不可用，请稍后再试';
          } else if (error.message.includes('500')) {
            errorMessage = '服务器繁忙，请稍后再试';
          } else {
            errorMessage = error.message;
          }
        }

        setState(prev => ({
          ...prev,
          loadError: errorMessage,
          loading: false
        }));
      }
    }
  }, [updateState, recordApiCall]);

  /**
   * 加载更多工具（用于虚拟滚动无限加载）
   */
  const loadMore = useCallback(async (filters?: ToolSearchFilters) => {
    // 如果有筛选条件，禁用无限滚动
    if (filters &&
        ((filters.search && filters.search.trim().length > 0) ||
         (filters.categories && filters.categories.length > 0) ||
         filters.pricing ||
         (filters.features && filters.features.length > 0) ||
         (filters.sortBy && filters.sortBy !== 'upvotes'))) {
      return;
    }

    // 防止重复加载或没有更多数据
    if (virtualScrollState.isLoadingMore || !virtualScrollState.hasMore) {
      return;
    }

    const nextPage = virtualScrollState.currentPage + 1;
    const limit = TOOLS_PER_PAGE;
    const offset = (nextPage - 1) * TOOLS_PER_PAGE;

    setVirtualScrollState(prev => ({ ...prev, isLoadingMore: true }));

    try {
      const result = recordApiCall
        ? await recordApiCall('load_more_tools', async () => {
            return await getToolsSmart(limit, offset, false);
          }, { page: nextPage })
        : await getToolsSmart(limit, offset, false);

      const newTools = Array.isArray(result.tools) ? result.tools : [];
      const totalCount = stateRef.current.totalToolsCount;

      setVirtualScrollState(prev => ({
        allTools: [...prev.allTools, ...newTools],
        isLoadingMore: false,
        hasMore: prev.allTools.length + newTools.length < totalCount,
        currentPage: nextPage
      }));

      console.log(`✅ 加载更多成功: ${newTools.length}个工具, 已加载${virtualScrollState.currentPage + 1}页`);
    } catch (error) {
      console.error('❌ 加载更多失败:', error);
      setVirtualScrollState(prev => ({ ...prev, isLoadingMore: false }));
    }
  }, [virtualScrollState, recordApiCall, stateRef]);

  /**
   * 加载分类数据
   */
  const loadCategories = useCallback(async () => {
    try {
      console.log('🔍 开始获取分类数据...');

      const categoriesData = recordApiCall
        ? await recordApiCall('load_categories', () => getCategories())
        : await getCategories();

      if (categoriesData && Array.isArray(categoriesData) && categoriesData.length > 0) {
        const categoryNames = categoriesData.map((cat: any) => cat.name).filter(Boolean);
        setCategories(categoryNames);
        console.log('✅ 分类数据加载成功:', categoryNames.length + '个分类');
      } else {
        console.log('⚠️ 数据库无分类数据，使用后备分类');
        setCategories([...EMERGENCY_CATEGORIES]);
      }
    } catch (error) {
      console.error('❌ 获取分类失败，使用后备分类:', error);
      setCategories([...EMERGENCY_CATEGORIES]);
    }
  }, [recordApiCall]);

  /**
   * 批量检查收藏状态
   */
  const loadFavoriteStates = useCallback(async (
    toolIds: string[],
    userId: string
  ) => {
    if (toolIds.length === 0) return;

    try {
      // 使用批量查询替代循环单独查询
      const { batchCheckFavorites } = await import('../lib/community');
      const states = await batchCheckFavorites(toolIds);
      setFavoriteStates(states);
    } catch (error) {
      // 静默处理错误，设置所有工具为未收藏状态
      const result: Record<string, boolean> = {};
      toolIds.forEach(id => result[id] = false);
      setFavoriteStates(result);
    }
  }, []);

  /**
   * 切换收藏状态
   */
  const toggleFavorite = useCallback(async (
    toolId: string,
    userId: string,
    currentState: boolean
  ) => {
    if (!userId) return false;

    try {
      recordInteraction?.('favorite_toggle', { toolId, previousState: currentState });

      const { addToFavorites, removeFromFavorites } = await import('../lib/community');

      if (currentState) {
        await removeFromFavorites(toolId);
        setFavoriteStates(prev => ({ ...prev, [toolId]: false }));
      } else {
        await addToFavorites(toolId);
        setFavoriteStates(prev => ({ ...prev, [toolId]: true }));
      }
      return true;
    } catch (error) {
      console.error('收藏操作失败:', error);
      return false;
    }
  }, [recordInteraction]);

  /**
   * 重试加载
   */
  const retryLoad = useCallback(() => {
    updateState({ retryCount: 0 });
    loadTools(false);
  }, [loadTools, updateState]);

  /**
   * 网络状态监听
   */
  useEffect(() => {
    const handleOnline = () => {
      updateState({ isOffline: false });
      // 网络恢复时，仅在页面没有任何数据且之前加载失败时，尝试重新拉取数据。
      if (stateRef.current.tools.length === 0 && stateRef.current.loadError) {
        loadTools(false, 1);
      }
    };

    const handleOffline = () => {
      updateState({ isOffline: true });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateState, loadTools]);

  /**
   * 清理定时器
   */
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    // 状态
    tools: state.tools,
    totalToolsCount: state.totalToolsCount,
    filteredToolsCount: state.filteredToolsCount,
    loading: state.loading,
    loadError: state.loadError,
    isOffline: state.isOffline,
    retryCount: state.retryCount,
    currentPage,
    categories,
    favoriteStates,

    // 虚拟滚动状态
    allTools: virtualScrollState.allTools,
    isLoadingMore: virtualScrollState.isLoadingMore,
    hasMore: virtualScrollState.hasMore,

    // 方法
    loadTools,
    loadCategories,
    loadFavoriteStates,
    toggleFavorite,
    retryLoad,
    preloadToolsPage,
    loadMore,
    setCurrentPage,
    setUserId: (id: string) => { userIdRef.current = id; },

    // 常量
    TOOLS_PER_PAGE
  };
}
