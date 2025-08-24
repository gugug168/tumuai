import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// 已选择：App-optimized.tsx - 提供更好的错误处理和用户体验
import App from './App-optimized.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
