import React, { useEffect } from 'react';
import Hero from '../components/Hero';
import FeaturedTools from '../components/FeaturedTools';
import CategoryBrowser from '../components/CategoryBrowser';
import QuickFilters from '../components/QuickFilters';
import { unifiedCache } from '../lib/unified-cache-manager';
import { getToolsWithCache, getFeaturedToolsWithCache, getLatestToolsWithCache, getCategories } from '../lib/supabase';

const HomePage = React.memo(() => {
  // 预取关键数据，提升用户体验
  useEffect(() => {
    // 预取精选工具
    unifiedCache.prefetch('featured_tools', () => getFeaturedToolsWithCache(), {
      ttl: 10 * 60 * 1000,
      staleWhileRevalidate: true
    });

    // 预取最新工具
    unifiedCache.prefetch('latest_tools', () => getLatestToolsWithCache(), {
      ttl: 5 * 60 * 1000,
      staleWhileRevalidate: true
    });

    // 预取分类数据
    unifiedCache.prefetch('categories_list', () => getCategories(), {
      ttl: 15 * 60 * 1000,
      staleWhileRevalidate: true
    });
  }, []);

  return (
    <div>
      <Hero />
      <QuickFilters />
      <CategoryBrowser />
      <FeaturedTools />
    </div>
  );
});

HomePage.displayName = 'HomePage';

export default HomePage;