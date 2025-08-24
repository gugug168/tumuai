import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

const Hero = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = React.useState('');
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // 使用React Router跳转到工具中心页面并传递搜索参数
      navigate(`/tools?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <section className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 py-16 min-h-[70vh] flex items-center relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-100/30 via-blue-100/20 to-transparent"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-200/20 to-transparent rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-purple-200/20 to-transparent rounded-full blur-3xl"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            发现最好的
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">土木工程AI工具</span>
          </h1>
          <p className="text-lg md:text-xl mb-4 max-w-4xl mx-auto leading-relaxed text-gray-700">
            <span className="text-blue-600 font-semibold">500+</span> 个土木工具和 
            <span className="text-purple-600 font-semibold">8</span> 个分类，已收录于最大的土木工具导航站。
          </p>
          <p className="text-sm text-gray-500 mb-12">
            土木工具列表和GPTs列表通过ChatGPT每天自动更新。
          </p>
          
          {/* 热门工具标签 */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {['StructuralGPT', 'BIM智能建模', 'AutoCAD', 'ETABS', 'SAP2000'].map((tool) => (
              <button
                key={tool}
                className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:bg-white hover:shadow-md transition-all duration-200"
              >
                {tool}
              </button>
            ))}
          </div>
          
          {/* 搜索框 */}
          <div className="max-w-2xl mx-auto mb-12">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="询问任何问题"
                className="w-full pl-12 pr-20 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-lg bg-white text-gray-900 placeholder-gray-500"
              />
              <button 
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* 赞助信息 */}
          <p className="text-sm text-gray-500">
            Sponsored by <span className="text-blue-600">Civil Engineering Community</span>.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Hero;