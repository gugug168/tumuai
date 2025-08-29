import React from 'react';
import Hero from '../components/Hero';
import FeaturedTools from '../components/FeaturedTools';
import CategoryBrowser from '../components/CategoryBrowser';
import QuickFilters from '../components/QuickFilters';

const HomePage = React.memo(() => {
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