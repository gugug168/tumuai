import React, { useEffect } from 'react';
import Hero from '../components/Hero';
import FeaturedTools from '../components/FeaturedTools';
import CategoryBrowser from '../components/CategoryBrowser';
import QuickFilters from '../components/QuickFilters';
import { HomeDataProvider } from '../contexts/HomeDataContext';
import { prefetchToolDetailPage, prefetchToolsPage } from '../lib/route-prefetch';

const HomePage = React.memo(() => {
  // Warm up the most common next navigation (Tools page + first page data) without blocking LCP.
  useEffect(() => {
    if (import.meta.env.DEV) return;

    const conn = (navigator as any).connection as undefined | { saveData?: boolean; effectiveType?: string };
    if (conn?.saveData) return;
    if (conn?.effectiveType && ['slow-2g', '2g'].includes(conn.effectiveType)) return;

    const warm = () => {
      // Chunk prefetch (improves navigation responsiveness, especially on mobile where there's no hover).
      void prefetchToolsPage();
      void prefetchToolDetailPage();

      // Data prefetch: primes SW cache + browser cache so the first click into /tools is instant.
      fetch('/api/tools-cache?limit=12&offset=0&includeCount=true').catch(() => {});
      fetch('/api/categories-cache').catch(() => {});
    };

    if ('requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(warm, { timeout: 2500 });
      return () => (window as any).cancelIdleCallback(id);
    }

    const t = window.setTimeout(warm, 1200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <HomeDataProvider>
      <div>
        <Hero />
        <QuickFilters />
        <CategoryBrowser />
        <FeaturedTools />
      </div>
    </HomeDataProvider>
  );
});

HomePage.displayName = 'HomePage';

export default HomePage;
