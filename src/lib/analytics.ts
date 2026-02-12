declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = 'G-6JQ44XXF2K';

function isAdminPath(pathname: string): boolean {
  if (!pathname) return false;
  return pathname === '/admin-login' || /^\/admin(?:\/|$)/.test(pathname);
}

export function trackPageView(pathnameWithSearch: string): void {
  if (typeof window === 'undefined') return;
  if (isAdminPath(window.location.pathname || '')) return;
  if (typeof window.gtag !== 'function') return;

  window.gtag('event', 'page_view', {
    send_to: GA_MEASUREMENT_ID,
    page_location: window.location.href,
    page_path: pathnameWithSearch,
    page_title: document.title
  });
}

