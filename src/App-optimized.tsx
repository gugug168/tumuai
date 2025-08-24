import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';

// 懒加载组件 - 核心性能优化
const HomePage = React.lazy(() => import('./pages/HomePage'));
const ToolsPage = React.lazy(() => import('./pages/ToolsPage'));
const ToolDetailPage = React.lazy(() => import('./pages/ToolDetailPage'));
const SubmitToolPage = React.lazy(() => import('./pages/SubmitToolPage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const FavoritesPage = React.lazy(() => import('./pages/FavoritesPage'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const DiagnosticPage = React.lazy(() => import('./pages/DiagnosticPage'));
const AdminLoginPage = React.lazy(() => import('./pages/AdminLoginPage'));

// 加载中组件 - 优化用户体验
const PageLoader = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-600">页面加载中...</p>
    </div>
  </div>
);

// 路由预加载配置
const routePreloadConfig = {
  '/': () => import('./pages/HomePage'),
  '/tools': () => import('./pages/ToolsPage'),
  '/tools/:toolId': () => import('./pages/ToolDetailPage')
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-white flex flex-col">
            <Header />
            <main className="flex-1">
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/tools" element={<ToolsPage />} />
                  <Route path="/tools/:toolId" element={<ToolDetailPage />} />
                  <Route path="/submit" element={<SubmitToolPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/favorites" element={<FavoritesPage />} />
                  <Route path="/admin/*" element={<AdminDashboard />} />
                  <Route path="/admin-login" element={<AdminLoginPage />} />
                  <Route path="/diagnostic" element={<DiagnosticPage />} />
                </Routes>
              </Suspense>
            </main>
            <Footer />
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;