import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, ExternalLink, Heart, Eye, Clock } from 'lucide-react';
import { getLatestTools } from '../lib/supabase';
import type { Tool } from '../types';

const LatestTools = () => {
  const [latestTools, setLatestTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLatestTools = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getLatestTools();
      setLatestTools(Array.isArray(data) ? data : []);
    } catch (err) {
      const error = err as Error;
      setError(error?.message || '获取工具失败');
      console.error('获取最新工具失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestTools();
  }, []);
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            最新收录
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            最新加入网站的优质工具，第一时间发现行业前沿技术
          </p>
        </div>

        {/* 错误状态 */}
        {error && (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-red-600 mb-4">加载失败: {error}</p>
              <button 
                onClick={fetchLatestTools}
                className="btn-primary px-6 py-2"
              >
                重新加载
              </button>
            </div>
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
                <div className="w-full h-40 bg-gray-200"></div>
                <div className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 工具列表 */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {latestTools.map((tool) => (
            <div
              key={tool.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 overflow-hidden group"
            >
              {/* Tool Image */}
              <div className="relative overflow-hidden">
                <img
                  src={tool.logo_url || 'https://images.pexels.com/photos/3862132/pexels-photo-3862132.jpeg?auto=compress&cs=tinysrgb&w=300'}
                  alt={tool.name}
                  className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-3 left-3">
                  <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    新收录
                  </span>
                </div>
                <div className="absolute top-3 right-3">
                  <button className="bg-white/90 p-1.5 rounded-full hover:bg-white transition-colors">
                    <Heart className="w-3 h-3 text-gray-600 hover:text-red-500" />
                  </button>
                </div>
              </div>

              {/* Tool Content */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-primary-800 group-hover:text-accent-600 transition-colors line-clamp-1">
                    {tool.name}
                  </h3>
                  <div className="flex items-center space-x-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span className="text-xs font-medium text-gray-700">{tool.rating}</span>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-3 leading-relaxed line-clamp-2">
                  {tool.tagline}
                </p>

                <div className="mb-3">
                  <span className="tag-primary px-2 py-1 rounded-md text-xs font-medium">
                    {tool.categories?.[0] || '未分类'}
                  </span>
                </div>

                {/* Features as Tags */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {tool.features?.slice(0, 3).map((feature, index) => (
                    <span
                      key={index}
                      className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {/* Stats and Pricing */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Eye className="w-3 h-3" />
                      <span>{tool.views || 0}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3" />
                      <span>{tool.review_count || 0}</span>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-accent-600">
                    {tool.pricing || '免费'}
                  </span>
                </div>

                {/* Action Button */}
                <Link
                  to={`/tools/${tool.id}`}
                  className="w-full btn-primary py-2 px-3 text-sm flex items-center justify-center"
                >
                  查看详情
                  <ExternalLink className="ml-1 w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
          </div>
        )}

        {/* 查看更多按钮 */}
        {!loading && !error && latestTools.length > 0 && (
          <div className="text-center mt-12">
            <button className="btn-secondary px-8 py-3">
              查看更多最新工具
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default LatestTools;