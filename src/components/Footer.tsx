import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Hammer, Mail, Github, BookOpen, ChevronUp } from 'lucide-react';

const Footer = () => {
  const [showBackToTop, setShowBackToTop] = useState(false);

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
                  <p className="text-sm text-gray-400">专业土木AI工具平台</p>
                </div>
              </Link>
              <p className="text-gray-400 mb-6 max-w-md leading-relaxed">
                专为土木人打造的AI工具导航平台，汇集最新最实用的专业工具，助力土木工程师提升工作效率。
              </p>
              {/* 联系方式 */}
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">联系我们：</p>
                <div className="space-y-2">
                  <a href="mailto:contact@tumuai.net" className="flex items-center text-gray-400 hover:text-blue-400 transition-colors group">
                    <Mail className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                    <span>contact@tumuai.net</span>
                  </a>
                  <div className="flex items-center text-gray-400">
                    <span className="text-blue-400 mr-2">微信:</span>
                    <span>fuyesq168</span>
                  </div>
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
                <span>访问知识库</span>
                <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
              </a>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-lg font-semibold mb-4">快速导航</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/tools" className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">工具分类</span>
                  </Link>
                </li>
                <li>
                  <Link to="/tools" className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">最新工具</span>
                  </Link>
                </li>
                <li>
                  <Link to="/tools?sortBy=upvotes" className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">热门推荐</span>
                  </Link>
                </li>
                <li>
                  <Link to="/submit" className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">提交工具</span>
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">使用指南</span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-lg font-semibold mb-4">支持与帮助</h4>
              <ul className="space-y-2">
                <li>
                  <a href="mailto:contact@tumuai.net" className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">联系我们</span>
                  </a>
                </li>
                <li>
                  <a href="mailto:contact@tumuai.net?subject=意见反馈" className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">意见反馈</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://claudecode.tumuai.net/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors inline-flex items-center group"
                  >
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">Claude Code 教程</span>
                  </a>
                </li>
                <li>
                  <Link to="/about#privacy" className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">隐私政策</span>
                  </Link>
                </li>
                <li>
                  <Link to="/about#terms" className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">服务条款</span>
                  </Link>
                </li>
                <li>
                  <Link to="/about#faq" className="text-gray-400 hover:text-white transition-colors inline-flex items-center group">
                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                    <span className="ml-2">常见问题</span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2026 TumuAI.net. 专业土木AI工具平台 保留所有权利。
            </p>
            <div className="flex items-center space-x-4 mt-2 md:mt-0">
              <a
                href="https://github.com/gugug168/tumuai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors hover:scale-110 transform"
              >
                <Github className="w-5 h-5" />
              </a>
              <p className="text-gray-400 text-sm">
                献给每一位土木人 · 一起拥抱AI时代
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
          aria-label="回到顶部"
        >
          <ChevronUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      )}
    </>
  );
};

export default Footer;
