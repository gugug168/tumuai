import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProviders } from './contexts/AppProviders';
import Header from './components/Header';
import Footer from './components/Footer';
import PageLoader from './components/PageLoader';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';

// 首页和工具页面 - 保持直接导入以确保快速加载
import HomePage from './pages/HomePage';
import ToolsPage from './pages/ToolsPage';
import SubmitToolPage from './pages/SubmitToolPage'; // 改为直接导入以避免动态加载问题

// 其他页面使用懒加载 - 显著减少初始bundle大小
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
            <Header />
            <main className="flex-1">
              <ErrorBoundary>
                <Suspense fallback={<PageLoader message="页面加载中..." />}>
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