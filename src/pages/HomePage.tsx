import React from 'react';
import Hero from '../components/Hero';
import FeaturedTools from '../components/FeaturedTools';
import CategoryBrowser from '../components/CategoryBrowser';
import QuickFilters from '../components/QuickFilters';
import { HomeDataProvider } from '../contexts/HomeDataContext';

const HomePage = React.memo(() => {
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
