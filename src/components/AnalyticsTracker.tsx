import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../lib/analytics';

export default function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    // Track SPA page views on route changes (pathname only).
    // Querystring changes (filters, pagination) are treated as in-page interactions.
    trackPageView(location.pathname);
  }, [location.pathname]);

  return null;
}
