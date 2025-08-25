import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';

// 首页和工具页面 - 保持直接导入以确保快速加载
import HomePage from './pages/HomePage';
import ToolsPage from './pages/ToolsPage';
import SubmitToolPage from './pages/SubmitToolPage'; // 改为直接导入以避免动态加载问题

// 其他页面使用懒加载 - 显著减少初始bundle大小
const ToolDetailPage = React.lazy(() => import('./pages/ToolDetailPage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const FavoritesPage = React.lazy(() => import('./pages/FavoritesPage'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const DiagnosticPage = React.lazy(() => import('./pages/DiagnosticPage'));
const AdminLoginPage = React.lazy(() => import('./pages/AdminLoginPage'));

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-white flex flex-col">
            <Header />
            <main className="flex-1">
              <ErrorBoundary>
                <Suspense fallback={<LoadingSpinner size="lg" message="页面加载中..." />}>
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
              </ErrorBoundary>
            </main>
            <Footer />
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;