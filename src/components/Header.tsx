import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Hammer, User, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { prefetchSubmitToolPage, prefetchToolsData, prefetchToolsPage } from '../lib/route-prefetch';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../contexts/LocaleContext';
import { stripEnPrefix } from '../i18n';

const Header = React.memo(() => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const location = useLocation();
  const { t } = useTranslation();
  const { locale, toggleLocale } = useLocale();
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
    return stripEnPrefix(location.pathname) === path;
  };

  const localizePath = useCallback((path: string) => {
    if (locale !== 'en') return path;
    if (path === '/') return '/en';
    return `/en${path}`;
  }, [locale]);

  const navItems = [
    { path: '/', label: t('nav.home') },
    { path: '/tools', label: t('nav.tools') },
    { path: '/about', label: t('nav.about') },
  ];

  const handleAuthClick = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  // Phase 3优化: 提取预加载处理函数，桌面和移动导航共享
  const getPrefetchHandlers = useCallback((path: string) => ({
    onMouseEnter: () => {
      const base = stripEnPrefix(path);
      if (base === '/tools') void prefetchToolsPage();
      if (base === '/tools') void prefetchToolsData();
      if (base === '/submit') void prefetchSubmitToolPage();
    },
    onFocus: () => {
      const base = stripEnPrefix(path);
      if (base === '/tools') void prefetchToolsPage();
      if (base === '/tools') void prefetchToolsData();
      if (base === '/submit') void prefetchSubmitToolPage();
    },
    onPointerDown: () => {
      const base = stripEnPrefix(path);
      if (base === '/tools') void prefetchToolsPage();
      if (base === '/tools') void prefetchToolsData();
      if (base === '/submit') void prefetchSubmitToolPage();
    },
    onTouchStart: () => {
      const base = stripEnPrefix(path);
      if (base === '/tools') void prefetchToolsPage();
      if (base === '/tools') void prefetchToolsData();
      if (base === '/submit') void prefetchSubmitToolPage();
    }
  }), []);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      // 显式跳转，确保用户感知
      // 使用硬刷新，清理任何残留状态
      window.location.assign('/');
    } catch (error) {
      console.error('登出失败:', error);
      setIsSigningOut(false);
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
              <p className="text-xs text-gray-500">{t('app.tagline')}</p>
            </div>
          </Link>


          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              (!item.requireAuth || user) && (
                item.external ? (
                  <a
                    key={item.path}
                    href={item.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium relative transition-colors group text-gray-700 hover:text-accent-600"
                  >
                    {item.label}
                    <span className="absolute -bottom-1 left-0 h-0.5 bg-accent-600 transition-all duration-300 w-0 group-hover:w-full"></span>
                  </a>
                ) : (
                  <Link
                    key={item.path}
                    to={localizePath(item.path)}
                    {...getPrefetchHandlers(item.path)}
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
              )
            ))}
            
            {/* Language Switcher - v2 */}
            <button
              type="button"
              onClick={toggleLocale}
              className="text-gray-700 hover:text-accent-600 font-medium transition-colors"
              aria-label={t('nav.language')}
              data-testid="lang-toggle"
            >
              {locale === 'en' ? '中文' : 'EN'}
            </button>

            {/* 提交工具按钮 */}
            <Link
              to={localizePath('/submit')}
              {...getPrefetchHandlers(localizePath('/submit'))}
              className="bg-accent-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-accent-600 transition-colors inline-flex items-center"
            >
              {t('nav.submit')}
            </Link>
            
            {user ? (
              <div className="flex items-center space-x-4">
                <Link
                  to={localizePath('/profile')}
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
                  <span>{profile?.username || profile?.full_name || t('nav.profile')}</span>
                </Link>
                {/* 管理员入口 - 仅对管理员显示 */}
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="text-red-600 hover:text-red-700 font-medium transition-colors"
                  >
                    {t('nav.admin')}
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="flex items-center space-x-1 text-gray-700 hover:text-accent-600 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LogOut className={`w-4 h-4 ${isSigningOut ? 'animate-spin' : ''}`} />
                  <span>{isSigningOut ? t('nav.signingOut') : t('nav.logout')}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleAuthClick('login')}
                  className="text-gray-700 hover:text-accent-600 font-medium transition-colors"
                >
                  {t('nav.login')}
                </button>
                <button
                  onClick={() => handleAuthClick('register')}
                  className="bg-accent-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-accent-600 transition-colors"
                >
                  {t('nav.register')}
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
                  item.external ? (
                    <a
                      key={item.path}
                      href={item.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium py-2 transition-colors text-gray-700 hover:text-accent-600"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      key={item.path}
                      to={localizePath(item.path)}
                      {...getPrefetchHandlers(item.path)}
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
                )
              ))}

              {/* 提交工具（移动端 CTA） */}
              <Link
                to={localizePath('/submit')}
                onClick={() => setIsMenuOpen(false)}
                className="bg-accent-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-accent-600 transition-colors inline-flex items-center justify-center"
              >
                {t('nav.submit')}
              </Link>

              <button
                type="button"
                onClick={() => {
                  toggleLocale();
                  setIsMenuOpen(false);
                }}
                className="text-gray-700 hover:text-accent-600 font-medium py-2 transition-colors text-left"
                aria-label={t('nav.language')}
                data-testid="lang-toggle"
              >
                {locale === 'en' ? '中文' : 'EN'}
              </button>
              
              {user ? (
                <>
                  <Link
                    to={localizePath('/profile')}
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
                    <span>{profile?.username || profile?.full_name || t('nav.profile')}</span>
                  </Link>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setIsMenuOpen(false);
                    }}
                    disabled={isSigningOut}
                    className="flex items-center space-x-1 text-gray-700 hover:text-accent-600 font-medium py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <LogOut className={`w-4 h-4 ${isSigningOut ? 'animate-spin' : ''}`} />
                    <span>{isSigningOut ? t('nav.signingOut') : t('nav.logout')}</span>
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
                    {t('nav.login')}
                  </button>
                  <button
                    onClick={() => {
                      handleAuthClick('register');
                      setIsMenuOpen(false);
                    }}
                    className="bg-accent-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-accent-600 transition-colors"
                  >
                    {t('nav.register')}
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
});

Header.displayName = 'Header';

export default Header;
