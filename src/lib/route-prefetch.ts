// Lightweight route-level chunk prefetch helpers.
//
// Goal: improve navigation responsiveness without doing eager "idle preloads" that can
// compete with initial page load on slower connections.

let toolsPagePromise: Promise<unknown> | null = null;
let submitPagePromise: Promise<unknown> | null = null;
let toolDetailPagePromise: Promise<unknown> | null = null;

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

