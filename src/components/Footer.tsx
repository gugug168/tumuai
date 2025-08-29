import React from 'react';
import { Hammer, Mail, Github, Twitter, Linkedin } from 'lucide-react';

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
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Mail className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">快速导航</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">工具分类</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">最新工具</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">热门推荐</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">提交工具</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">使用指南</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-lg font-semibold mb-4">支持与帮助</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">联系我们</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">意见反馈</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">隐私政策</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">服务条款</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">常见问题</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">
            © 2025 TumuAI.net. 专业土木AI工具平台 保留所有权利。
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