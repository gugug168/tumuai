import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Category } from '../types';
import { getCategories, getToolsSmart } from '../lib/supabase';

export interface HomeDataContextValue {
  categories: Category[];
  categoriesLoading: boolean;
  categoriesError: string | null;

  toolsCount: number;
  toolsCountLoading: boolean;
  toolsCountError: string | null;

  refresh: () => Promise<void>;
}

const HomeDataContext = createContext<HomeDataContextValue | null>(null);

export function HomeDataProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [toolsCount, setToolsCount] = useState(0);
  const [toolsCountLoading, setToolsCountLoading] = useState(true);
  const [toolsCountError, setToolsCountError] = useState<string | null>(null);

  const loadCategories = async (cancelledRef: { cancelled: boolean }) => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const data = await getCategories();
      if (cancelledRef.cancelled) return;
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      if (cancelledRef.cancelled) return;
      const message = error instanceof Error ? error.message : '获取分类失败';
      setCategoriesError(message);
      setCategories([]);
    } finally {
      if (!cancelledRef.cancelled) setCategoriesLoading(false);
    }
  };

  const loadToolsCount = async (cancelledRef: { cancelled: boolean }) => {
    setToolsCountLoading(true);
    setToolsCountError(null);
    try {
      // Use the smart strategy:
      // - production: Vercel `/api/tools-cache` (CDN cached, 2s timeout)
      // - fallback: cached direct Supabase queries
      const result = await getToolsSmart(1, 0, true);
      if (cancelledRef.cancelled) return;
      setToolsCount(typeof result.count === 'number' ? result.count : 0);
    } catch (error) {
      if (cancelledRef.cancelled) return;
      const message = error instanceof Error ? error.message : '获取工具数量失败';
      setToolsCountError(message);
      setToolsCount(0);
    } finally {
      if (!cancelledRef.cancelled) setToolsCountLoading(false);
    }
  };

  const refresh = async () => {
    const cancelledRef = { cancelled: false };
    await Promise.allSettled([loadCategories(cancelledRef), loadToolsCount(cancelledRef)]);
  };

  useEffect(() => {
    const cancelledRef = { cancelled: false };

    // Load in parallel; pages can render partial content as soon as one finishes.
    void Promise.allSettled([loadCategories(cancelledRef), loadToolsCount(cancelledRef)]);

    return () => {
      cancelledRef.cancelled = true;
    };
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<HomeDataContextValue>(() => {
    return {
      categories,
      categoriesLoading,
      categoriesError,

      toolsCount,
      toolsCountLoading,
      toolsCountError,

      refresh
    };
  }, [
    categories,
    categoriesLoading,
    categoriesError,
    toolsCount,
    toolsCountLoading,
    toolsCountError
  ]);

  return <HomeDataContext.Provider value={value}>{children}</HomeDataContext.Provider>;
}

export function useHomeData(): HomeDataContextValue | null {
  return useContext(HomeDataContext);
}

