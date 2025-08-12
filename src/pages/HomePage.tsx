import React from 'react';
import Hero from '../components/Hero';
import FeaturedTools from '../components/FeaturedTools';
import LatestTools from '../components/LatestTools';
import CategoryBrowser from '../components/CategoryBrowser';
import QuickFilters from '../components/QuickFilters';
import Newsletter from '../components/Newsletter';

const HomePage = () => {
  return (
    <div>
      <Hero />
      <QuickFilters />
      <CategoryBrowser />
      <FeaturedTools />
      <Newsletter />
    </div>
  );
};

export default HomePage;