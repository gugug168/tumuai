import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { checkVersionAndRefresh, shouldCleanupCache, cleanupOldCache } from './lib/cache-cleanup';

// 应用启动前的缓存清理和版本检查
try {
  // 检查版本并处理升级
  const needsRefresh = checkVersionAndRefresh();
  
  // 如果不需要刷新，检查是否需要清理缓存
  if (!needsRefresh && shouldCleanupCache()) {
    cleanupOldCache();
  }
} catch (error) {
  console.warn('缓存清理过程出现问题:', error);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
