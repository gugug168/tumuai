import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Hammer, User, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (user) {
        try {
          // Lazy-load admin helpers so the admin bundle isn't part of the initial load.
          const { checkAdminStatus } = await import('../lib/admin');
          const admin = await checkAdminStatus();
          if (!cancelled) setIsAdmin(!!admin);
        } catch {
          if (!cancelled) setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    { path: '/', label: '首页' },
    { path: '/tools', label: '工具中心' },
    { path: '/submit', label: '提交工具' },
    { path: '/about', label: '关于我们' },
  ];

  const handleAuthClick = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // 显式跳转，确保用户感知
      // 使用硬刷新，清理任何残留状态
      window.location.assign('/');
    } catch (error) {
      console.error('登出失败:', error);
    }
  };


  return (
    <>
      <header className="bg-white shadow-soft border-b border-secondary-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="bg-accent-500 p-2 rounded-xl">
              <Hammer className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary-800">TumuAI.net</h1>
              <p className="text-xs text-gray-500">专业土木AI工具平台</p>
            </div>
          </Link>


          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              (!item.requireAuth || user) && (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`font-medium relative transition-colors group ${
                    isActive(item.path)
                      ? 'text-accent-600'
                      : 'text-gray-700 hover:text-accent-600'
                  }`}
                >
                  {item.label}
                  <span className={`absolute -bottom-1 left-0 h-0.5 bg-accent-600 transition-all duration-300 ${
                    isActive(item.path) ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}></span>
                </Link>
              )
            ))}
            
            {/* 提交工具按钮 */}
            <Link
              to="/submit"
              className="bg-accent-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-accent-600 transition-colors inline-flex items-center"
            >
              提交你的工具
            </Link>
            
            {user ? (
              <div className="flex items-center space-x-4">
                <Link
                  to="/profile"
                  className={`flex items-center space-x-2 font-medium transition-colors ${
                    isActive('/profile')
                      ? 'text-accent-600'
                      : 'text-gray-700 hover:text-accent-600'
                  }`}
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.username || '用户'}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  <span>{profile?.username || profile?.full_name || '用户中心'}</span>
                </Link>
                {/* 管理员入口 - 仅对管理员显示 */}
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="text-red-600 hover:text-red-700 font-medium transition-colors"
                  >
                    管理后台
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-1 text-gray-700 hover:text-accent-600 font-medium transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>登出</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleAuthClick('login')}
                  className="text-gray-700 hover:text-accent-600 font-medium transition-colors"
                >
                  登录
                </button>
                <button
                  onClick={() => handleAuthClick('register')}
                  className="bg-accent-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-accent-600 transition-colors"
                >
                  注册
                </button>
              </div>
            )}
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>


        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 animate-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col space-y-3">
              {navItems.map((item) => (
                (!item.requireAuth || user) && (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`font-medium py-2 transition-colors ${
                      isActive(item.path)
                        ? 'text-accent-600'
                        : 'text-gray-700 hover:text-accent-600'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                )
              ))}
              
              {user ? (
                <>
                  <Link
                    to="/profile"
                    className={`flex items-center space-x-2 font-medium py-2 transition-colors ${
                      isActive('/profile')
                        ? 'text-accent-600'
                        : 'text-gray-700 hover:text-accent-600'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.username || '用户'}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                    <span>{profile?.username || profile?.full_name || '用户中心'}</span>
                  </Link>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center space-x-1 text-gray-700 hover:text-accent-600 font-medium py-2 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>登出</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      handleAuthClick('login');
                      setIsMenuOpen(false);
                    }}
                    className="text-gray-700 hover:text-accent-600 font-medium py-2 transition-colors"
                  >
                    登录
                  </button>
                  <button
                    onClick={() => {
                      handleAuthClick('register');
                      setIsMenuOpen(false);
                    }}
                    className="bg-accent-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-accent-600 transition-colors"
                  >
                    注册
                  </button>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
      </header>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </>
  );
};

export default Header;
