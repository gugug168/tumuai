import React, { useState } from 'react';
import { Mail, Send, CheckCircle } from 'lucide-react';

const Newsletter = () => {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    
    // 模拟API调用
    setTimeout(() => {
      setIsSubscribed(true);
      setIsLoading(false);
      setEmail('');
    }, 1000);
  };

  if (isSubscribed) {
    return (
      <section className="py-16 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              订阅成功！
            </h3>
            <p className="text-gray-600">
              感谢您的订阅！我们会每周为您推送最新的土木工程AI工具和行业资讯。
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-100 p-4 rounded-full">
              <Mail className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            获取每周精选工具推荐
          </h3>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            订阅我们的周刊，第一时间了解最新的土木工程AI工具、行业趋势和实用技巧。
            每周精选5-10个优质工具，助力您的专业发展。
          </p>

          <form onSubmit={handleSubmit} className="max-w-md mx-auto">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入您的邮箱地址"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-gray-900 placeholder-gray-500"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    订阅
                    <Send className="ml-2 w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="text-xs text-gray-500 mt-4">
            我们承诺不会向第三方分享您的邮箱地址，您可以随时取消订阅。
          </p>

          {/* 订阅统计 */}
          <div className="flex items-center justify-center space-x-8 mt-8 pt-6 border-t border-gray-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">5,000+</div>
              <div className="text-sm text-gray-500">订阅用户</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">98%</div>
              <div className="text-sm text-gray-500">满意度</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">每周</div>
              <div className="text-sm text-gray-500">更新频率</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Newsletter;