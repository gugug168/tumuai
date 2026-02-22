// Lightweight route-level chunk prefetch helpers.
//
// Goal: improve navigation responsiveness without doing eager "idle preloads" that can
// compete with initial page load on slower connections.

import i18n from 'i18next';

let toolsPagePromise: Promise<unknown> | null = null;
let submitPagePromise: Promise<unknown> | null = null;
let toolDetailPagePromise: Promise<unknown> | null = null;
const toolsDataPromises: Record<string, Promise<void> | undefined> = {};

export function prefetchToolsPage(): Promise<unknown> {
  if (!toolsPagePromise) {
    toolsPagePromise = import('../pages/ToolsPage');
  }
  return toolsPagePromise;
}

export function prefetchSubmitToolPage(): Promise<unknown> {
  if (!submitPagePromise) {
    submitPagePromise = import('../pages/SubmitToolPage');
  }
  return submitPagePromise;
}

export function prefetchToolDetailPage(): Promise<unknown> {
  if (!toolDetailPagePromise) {
    toolDetailPagePromise = import('../pages/ToolDetailPage');
  }
  return toolDetailPagePromise;
}

function getToolsWarmupUrl(): string {
  const base = '/api/public-api?action=tools&limit=12&offset=0&includeCount=true';
  return i18n.language === 'en' ? `${base}&lang=en` : base;
}

// Prefetch the initial data needed by /tools so the first navigation is instant.
// This is a best-effort warmup; failures are ignored.
export function prefetchToolsData(): Promise<void> {
  const key = i18n.language === 'en' ? 'en' : 'zh';
  if (!toolsDataPromises[key]) {
    toolsDataPromises[key] = Promise.allSettled([
      fetch(getToolsWarmupUrl()),
      fetch('/api/public-api?action=categories')
    ]).then(() => undefined);
  }
  return toolsDataPromises[key]!;
}
