import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Hammer, Github, BookOpen, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../contexts/LocaleContext';

const Footer = () => {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const { t } = useTranslation();
  const { locale } = useLocale();

  const localizePath = (path: string) => {
    if (locale !== 'en') return path;
    if (path === '/') return '/en';
    return `/en${path}`;
  };

  // 回到顶部
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 监听滚动显示回到顶部按钮
  React.useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <footer className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-1 md:col-span-2">
              <Link to="/" className="inline-flex items-center space-x-3 mb-4 group">
                <div className="bg-blue-600 p-2 rounded-lg group-hover:bg-blue-500 transition-colors duration-300">
                  <Hammer className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold group-hover:text-blue-400 transition-colors">TumuAI.net</h3>
                  <p className="text-sm text-gray-400">{t('app.tagline')}</p>
                </div>
              </Link>
              <p className="text-gray-400 mb-6 max-w-md leading-relaxed">
                {t('footer.description')}
              </p>
              {/* 联系方式 */}
              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-2">{t('footer.wechat')}：</p>
                <div className="flex items-center text-gray-400">
                  <span className="text-blue-400 mr-2">{t('footer.wechat')}:</span>
                  <span>{t('footer.wechatId')}</span>
                </div>
              </div>
              {/* 知识库链接 */}
              <a
                href="https://fv2fbshiww0.feishu.cn/wiki/QFcFwHXxLiyVT7kRMAWcRtmXn0I?from=from_copylink"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-400 hover:text-blue-300 transition-all duration-300 group"
              >
                <BookOpen className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                <span>{t('footer.knowledgeBase')}</span>
                <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
              </a>
              <a
                href="https://claudecode.tumuai.net/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center text-blue-400 hover:text-blue-300 transition-all duration-300 group"
              >
                <BookOpen className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                <span>{t('footer.claudeCodeTutorial')}</span>
                <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
              </a>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-lg font-semibold mb-4">{t('footer.quickLinks')}</h4>
              <ul className="space-y-2">
                <li>
                  <Link to={localizePath('/tools')} className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">{t('footer.toolsCategories')}</span>
                  </Link>
                </li>
                <li>
                  <Link to={localizePath('/tools')} className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">{t('footer.latestTools')}</span>
                  </Link>
                </li>
                <li>
                  <Link to={`${localizePath('/tools')}?sortBy=upvotes`} className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">{t('footer.hotRecommendations')}</span>
                  </Link>
                </li>
                <li>
                  <Link to={localizePath('/submit')} className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">{t('nav.submit')}</span>
                  </Link>
                </li>
                <li>
                  <Link to={localizePath('/about')} className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">{t('footer.userGuide')}</span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-lg font-semibold mb-4">{t('footer.help')}</h4>
              <ul className="space-y-2">
                <li>
                  <div className="text-gray-400 inline-flex items-center">
                    <span>→</span>
                    <span className="ml-2">{t('footer.wechat')}：{t('footer.wechatId')}</span>
                  </div>
                </li>
                <li>
                  <Link to={`${localizePath('/about')}#privacy`} className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">{t('footer.privacy')}</span>
                  </Link>
                </li>
                <li>
                  <Link to={`${localizePath('/about')}#terms`} className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">{t('footer.terms')}</span>
                  </Link>
                </li>
                <li>
                  <Link to={`${localizePath('/about')}#faq`} className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">{t('footer.faq')}</span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              {t('footer.copyright')}
            </p>
            <div className="flex items-center space-x-4 mt-2 md:mt-0">
              <a
                href="https://github.com/gugug168/tumuai"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="text-gray-400 hover:text-white transition-colors hover:scale-110 transform"
              >
                <Github className="w-5 h-5" />
              </a>
              <p className="text-gray-400 text-sm">
                {t('footer.motto')}
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* 回到顶部按钮 */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 hover:scale-110 z-50 group"
          aria-label={t('common.backToTop')}
        >
          <ChevronUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      )}
    </>
  );
};

export default Footer;
