import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProviders } from './contexts/AppProviders';
import Header from './components/Header';
import Footer from './components/Footer';
import PageLoader from './components/PageLoader';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import PageTransition from './components/PageTransition';

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

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider position="top-right" maxToasts={3}>
        <AppProviders>
          <Router>
          <div className="min-h-screen bg-white flex flex-col">
            {/* Phase 2优化: 添加 Skip to Content 无障碍链接 */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg"
            >
              跳转到主要内容
            </a>
            <Header />
            <main id="main-content" className="flex-1">
              <ErrorBoundary>
                <Suspense fallback={<PageLoader message="页面加载中..." />}>
                  <Routes>
                    {/* Phase 3优化: 启用 PageTransition 组件，为各页面添加淡入动画 */}
                    <Route path="/" element={
                      <PageTransition type="fade" duration={200}>
                        <HomePage />
                      </PageTransition>
                    } />
                    <Route path="/tools" element={
                      <PageTransition type="fade" duration={200}>
                        <ToolsPage />
                      </PageTransition>
                    } />
                    <Route path="/tools/:toolId" element={
                      <PageTransition type="fade" duration={200}>
                        <ToolDetailPage />
                      </PageTransition>
                    } />
                    <Route path="/submit" element={
                      <PageTransition type="fade" duration={200}>
                        <SubmitToolPage />
                      </PageTransition>
                    } />
                    <Route path="/about" element={
                      <PageTransition type="fade" duration={200}>
                        <AboutPage />
                      </PageTransition>
                    } />
                    <Route path="/profile" element={
                      <PageTransition type="fade" duration={200}>
                        <ProfilePage />
                      </PageTransition>
                    } />
                    <Route path="/admin/*" element={
                      <PageTransition type="fade" duration={200}>
                        <AdminDashboard />
                      </PageTransition>
                    } />
                    <Route path="/admin-login" element={
                      <PageTransition type="fade" duration={200}>
                        <AdminLoginPage />
                      </PageTransition>
                    } />
                    <Route path="/diagnostic" element={
                      <PageTransition type="fade" duration={200}>
                        <DiagnosticPage />
                      </PageTransition>
                    } />
                    <Route path="*" element={
                      <PageTransition type="fade" duration={200}>
                        <NotFoundPage />
                      </PageTransition>
                    } />
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
