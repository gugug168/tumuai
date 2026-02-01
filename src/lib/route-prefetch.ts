// Lightweight route-level chunk prefetch helpers.
//
// Goal: improve navigation responsiveness without doing eager "idle preloads" that can
// compete with initial page load on slower connections.

let toolsPagePromise: Promise<unknown> | null = null;
let submitPagePromise: Promise<unknown> | null = null;
let toolDetailPagePromise: Promise<unknown> | null = null;
let toolsDataPromise: Promise<void> | null = null;

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

// Prefetch the initial data needed by /tools so the first navigation is instant.
// This is a best-effort warmup; failures are ignored.
export function prefetchToolsData(): Promise<void> {
  if (!toolsDataPromise) {
    toolsDataPromise = Promise.allSettled([
      fetch('/api/tools-cache?limit=12&offset=0&includeCount=true'),
      fetch('/api/categories-cache')
    ]).then(() => undefined);
  }
  return toolsDataPromise;
}
