import React from 'react';
import { useServiceWorker } from '../hooks/useServiceWorker';

/**
 * Service Worker 更新提示组件
 *
 * 当检测到新版本可用时显示更新提示
 */
export function ServiceWorkerUpdatePrompt() {
  const { updateAvailable, activateUpdate } = useServiceWorker();

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm animate-slide-in-right">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">新版本可用</p>
          <p className="text-xs text-gray-500 mt-1">点击刷新以获取最新版本</p>
        </div>
        <div className="flex-shrink-0 flex space-x-2">
          <button
            onClick={activateUpdate}
            className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            刷新
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

ServiceWorkerUpdatePrompt.displayName = 'ServiceWorkerUpdatePrompt';

export default ServiceWorkerUpdatePrompt;
