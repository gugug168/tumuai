import React from 'react';
import { Link } from 'react-router-dom';
import { Hammer, Mail, Github, BookOpen } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Hammer className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold">TumuAI.net</h3>
                <p className="text-sm text-gray-400">专业土木AI工具平台</p>
              </div>
            </div>
            <p className="text-gray-400 mb-6 max-w-md">
              专为土木人打造的AI工具导航平台，汇集最新最实用的专业工具，助力工土木人提升工作效率。
            </p>
            {/* 联系方式 */}
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">联系我们：</p>
              <div className="space-y-2">
                <a href="mailto:contact@tumuai.net" className="flex items-center text-gray-400 hover:text-blue-400 transition-colors">
                  <Mail className="w-4 h-4 mr-2" />
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
              className="inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              <span>访问知识库 →</span>
            </a>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">快速导航</h4>
            <ul className="space-y-2">
              <li><Link to="/tools" className="text-gray-400 hover:text-white transition-colors">工具分类</Link></li>
              <li><Link to="/tools" className="text-gray-400 hover:text-white transition-colors">最新工具</Link></li>
              <li><Link to="/tools?sort=upvotes" className="text-gray-400 hover:text-white transition-colors">热门推荐</Link></li>
              <li><Link to="/submit" className="text-gray-400 hover:text-white transition-colors">提交工具</Link></li>
              <li><Link to="/about" className="text-gray-400 hover:text-white transition-colors">使用指南</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-lg font-semibold mb-4">支持与帮助</h4>
            <ul className="space-y-2">
              <li><a href="mailto:contact@tumuai.net" className="text-gray-400 hover:text-white transition-colors">联系我们</a></li>
              <li><a href="mailto:contact@tumuai.net?subject=意见反馈" className="text-gray-400 hover:text-white transition-colors">意见反馈</a></li>
              <li><Link to="/about" className="text-gray-400 hover:text-white transition-colors">隐私政策</Link></li>
              <li><Link to="/about" className="text-gray-400 hover:text-white transition-colors">服务条款</Link></li>
              <li><Link to="/about" className="text-gray-400 hover:text-white transition-colors">常见问题</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">
            © 2026 TumuAI.net. 专业土木AI工具平台 保留所有权利。
          </p>
          <p className="text-gray-400 text-sm mt-2 md:mt-0">
            献给每一位土木人 · 一起拥抱AI时代
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
