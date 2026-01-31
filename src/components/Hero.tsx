import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, Building2, Calculator, PenTool } from 'lucide-react';
import CountUpAnimation from './CountUpAnimation';
import { getCategories, getToolsCount } from '../lib/supabase';
import { useHomeData } from '../contexts/HomeDataContext';

interface SiteStats {
  toolsCount: number;
  categoriesCount: number;
}

const Hero = () => {
  const navigate = useNavigate();
  const homeData = useHomeData();
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<SiteStats>({ toolsCount: 0, categoriesCount: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // 获取真实的统计数据
  useEffect(() => {
    // If wrapped by HomeDataProvider, reuse the shared request and avoid duplicate fetches.
    if (homeData) return;

    const fetchStats = async () => {
      try {
        // 获取工具总数 - 生产环境优先使用 Vercel API（可命中 CDN 缓存）
        let toolsCount = 0;

        // 检测是否在开发环境
        const isDev = import.meta.env.DEV;

        if (isDev) {
          // 开发环境：直接使用 Supabase
          toolsCount = await getToolsCount();
        } else {
          // 生产环境：使用 Vercel API（不要加时间戳，否则每次都会绕过 CDN 缓存，反而更慢）
          const toolsResponse = await fetch('/api/tools-cache?limit=1&includeCount=true');
          if (toolsResponse.ok) {
            const toolsData = await toolsResponse.json();
            toolsCount = toolsData.count || 0;
          } else {
            // API 失败，回退到 Supabase
            toolsCount = await getToolsCount();
          }
        }

        // 获取分类数量 - 同样使用 Vercel API（CDN 缓存 + 同源请求更快）
        let categoriesCount = 0;
        if (isDev) {
          const categories = await getCategories();
          categoriesCount = categories.length || 0;
        } else {
          const categoriesResponse = await fetch('/api/categories-cache');
          if (categoriesResponse.ok) {
            const categoriesData = await categoriesResponse.json();
            categoriesCount = categoriesData?.categories?.length || 0;
          } else {
            const categories = await getCategories();
            categoriesCount = categories.length || 0;
          }
        }

        setStats({ toolsCount, categoriesCount });
      } catch (error) {
        console.error('获取统计数据失败:', error);
        // 失败时显示 0，而不是错误的数据
        setStats({ toolsCount: 0, categoriesCount: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [homeData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/tools?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <section className="relative min-h-[60vh] flex items-center overflow-hidden">
      {/* 主背景渐变 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"></div>
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 via-purple-600/20 to-transparent"></div>
      
      {/* 动态背景装饰 */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-purple-400/20 rounded-full mix-blend-multiply filter blur-3xl animate-ping"></div>
        <div className="absolute -bottom-8 left-1/3 w-80 h-80 bg-pink-400/20 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
      </div>
      
      {/* 网格背景 */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>
      
      {/* 浮动装饰元素 */}
      <div className="absolute inset-0">
        <div className="absolute top-10 left-10 opacity-20 animate-bounce">
          <Building2 className="w-8 h-8 text-blue-300" />
        </div>
        <div className="absolute top-32 right-16 opacity-20 animate-pulse">
          <Calculator className="w-6 h-6 text-purple-300" />
        </div>
        <div className="absolute bottom-32 left-16 opacity-20 animate-bounce">
          <PenTool className="w-7 h-7 text-pink-300" />
        </div>
        <div className="absolute top-1/2 right-10 opacity-20 animate-pulse">
          <Sparkles className="w-5 h-5 text-blue-300" />
        </div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          {/* 主标题 */}
          <div className="mb-8">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-4 leading-tight">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                TumuAI.net
              </span>
            </h1>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-gray-200 mb-6">
              专业土木AI工具平台
            </h2>
          </div>
          
          {/* 描述文本 */}
          <p className="text-lg md:text-xl mb-4 max-w-4xl mx-auto leading-relaxed text-gray-300">
            汇聚
            <span className="text-blue-400 font-semibold px-2 py-1 bg-blue-400/10 rounded-lg mx-1">结构设计</span>、
            <span className="text-purple-400 font-semibold px-2 py-1 bg-purple-400/10 rounded-lg mx-1">BIM建模</span>、
            <span className="text-pink-400 font-semibold px-2 py-1 bg-pink-400/10 rounded-lg mx-1">工程计算</span>
            等专业工具
            <br />助力土木人提升设计效率，拥抱AI时代
          </p>
          
          <div className="flex items-center justify-center space-x-6 mb-8 text-sm text-gray-400">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
              精选专业工具
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
              智能推荐
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-purple-400 rounded-full mr-2 animate-pulse"></div>
              持续更新
            </div>
          </div>
          
          {/* 美化搜索框 */}
          <div className="max-w-2xl mx-auto mb-8">
            <form onSubmit={handleSearch} className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                <input
                  type="text"
                  id="hero-search"
                  name="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索结构设计、BIM建模、工程计算等专业工具..."
                  className="w-full pl-12 pr-32 py-4 text-lg border-0 rounded-xl focus:ring-2 focus:ring-purple-500 shadow-xl bg-white/95 backdrop-blur-sm text-gray-900 placeholder-gray-500 transition-all duration-300 hover:bg-white focus:bg-white"
                  aria-label="搜索AI工具"
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                >
                  搜索
                </button>
              </div>
            </form>
          </div>
          
          {/* 底部统计 */}
          <div className="flex items-center justify-center space-x-6 md:space-x-8 text-gray-300">
            <div className="text-center group cursor-default">
              <div className="text-2xl md:text-3xl font-bold text-blue-400 group-hover:text-blue-300 transition-colors">
                {(homeData ? homeData.toolsCountLoading : isLoading) ? (
                  <span className="inline-block animate-pulse">...</span>
                ) : (
                  <CountUpAnimation end={homeData ? homeData.toolsCount : stats.toolsCount} suffix="+" duration={1500} className="inline-block" />
                )}
              </div>
              <div className="text-xs mt-1">专业工具</div>
            </div>
            <div className="w-px h-8 bg-gray-600"></div>
            <div className="text-center group cursor-default">
              <div className="text-2xl md:text-3xl font-bold text-purple-400 group-hover:text-purple-300 transition-colors">
                {(homeData ? homeData.categoriesLoading : isLoading) ? (
                  <span className="inline-block animate-pulse">...</span>
                ) : (
                  <CountUpAnimation end={homeData ? homeData.categories.length : stats.categoriesCount} suffix="+" duration={1500} delay={200} className="inline-block" />
                )}
              </div>
              <div className="text-xs mt-1">工具分类</div>
            </div>
            <div className="w-px h-8 bg-gray-600"></div>
            <div className="text-center group cursor-default">
              <div className="text-2xl md:text-3xl font-bold text-pink-400 group-hover:text-pink-300 transition-colors">
                <span className="inline-block animate-pulse">∞</span>
              </div>
              <div className="text-xs mt-1">持续更新</div>
            </div>
          </div>
        </div>
      </div>
      
    </section>
  );
};

export default Hero;
