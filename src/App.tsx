import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AppProviders } from './contexts/AppProviders';
import Header from './components/Header';
import Footer from './components/Footer';
import PageLoader from './components/PageLoader';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';

// 首页保持直接导入以确保快速首屏
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';

// 其他页面使用懒加载 - 显著减少初始 bundle 大小
const ToolsPage = React.lazy(() => import('./pages/ToolsPage'));
const SubmitToolPage = React.lazy(() => import('./pages/SubmitToolPage'));
const ToolDetailPage = React.lazy(() => import('./pages/ToolDetailPage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const DiagnosticPage = React.lazy(() => import('./pages/DiagnosticPage'));
const AdminLoginPage = React.lazy(() => import('./pages/AdminLoginPage'));

/**
 * 数据预加载组件
 * 在用户访问首页时，使用 requestIdleCallback 在空闲时预加载关键路由 chunk（提升导航体验）。
 *
 * 注意：不再在这里预拉取 tools 列表数据，否则会增加首页网络请求数，导致“加载更慢”的体感。
 */
function DataPreloader() {
  const location = useLocation();

  useEffect(() => {
    // 只在首页预加载，避免在 /tools 这类页面重复触发请求造成“更慢”的体感。
    const shouldPreload = location.pathname === '/';

    if (shouldPreload) {
      const preloadData = () => {
        console.log('🔄 DataPreloader: 开始预加载数据...', `当前路径: ${location.pathname}`);

        // 仅预加载关键页面 chunk，避免点击后才开始下载导致“慢”的体感
        Promise.allSettled([
          import('./pages/ToolsPage').catch(() => undefined),
          import('./pages/SubmitToolPage').catch(() => undefined)
        ]).then(() => {
          console.log('🎉 DataPreloader: 预加载完成');
        });
      };

      // 使用 requestIdleCallback 在浏览器空闲时预加载
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(preloadData, { timeout: 2000 });
      } else {
        // 回退方案：使用 setTimeout 延迟执行
        setTimeout(preloadData, 500);
      }
    }
  }, [location.pathname]);

  return null; // 不渲染任何内容
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider position="top-right" maxToasts={3}>
        <AppProviders>
          <Router>
          <div className="min-h-screen bg-white flex flex-col">
            <Header />
            <main className="flex-1">
              <ErrorBoundary>
                <Suspense fallback={<PageLoader message="页面加载中..." />}>
                  <DataPreloader />
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/tools" element={<ToolsPage />} />
                    <Route path="/tools/:toolId" element={<ToolDetailPage />} />
                    <Route path="/submit" element={<SubmitToolPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/admin/*" element={<AdminDashboard />} />
                    <Route path="/admin-login" element={<AdminLoginPage />} />
                    <Route path="/diagnostic" element={<DiagnosticPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </main>
            <Footer />
          </div>
          </Router>
        </AppProviders>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
