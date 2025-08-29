import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Brain, 
  Wrench, 
  Layers, 
  Zap, 
  Mountain, 
  Users,
  ArrowRight,
  Building2,
  Calculator,
  FileText,
  BarChart3,
  Ruler,
  HardHat,
  Box,
  Construction,
  PenTool,
  MapPin,
  DollarSign,
  Microscope,
  ExternalLink,
  LoaderIcon
} from 'lucide-react';
import { getCategories } from '../lib/supabase';
import { apiRequestWithRetry } from '../lib/api';

// 图标映射
const iconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  'Brain': Brain,
  'Wrench': Wrench,
  'Layers': Layers,
  'Zap': Zap,
  'Mountain': Mountain,
  'Users': Users,
  'Building2': Building2,
  'Calculator': Calculator,
  'FileText': FileText,
  'BarChart3': BarChart3,
  'Ruler': Ruler,
  'HardHat': HardHat,
  'Box': Box,
  'Construction': Construction,
  'pen-tool': PenTool,
  'map-pin': MapPin,
  'dollar-sign': DollarSign,
  'microscope': Microscope,
  'file-text': FileText
};

// 颜色映射
const getGradientClass = (hexColor: string) => {
  const gradientMap: Record<string, string> = {
    '#EF4444': 'from-red-500 to-red-600',
    '#3B82F6': 'from-blue-500 to-blue-600',
    '#10B981': 'from-green-500 to-green-600',
    '#8B5CF6': 'from-purple-500 to-purple-600',
    '#F59E0B': 'from-amber-500 to-amber-600',
    '#06B6D4': 'from-cyan-500 to-cyan-600',
    '#84CC16': 'from-lime-500 to-lime-600',
    '#64748B': 'from-gray-500 to-gray-600',
    '#F97316': 'from-orange-500 to-orange-600',
    '#EC4899': 'from-pink-500 to-pink-600',
    '#6366F1': 'from-indigo-500 to-indigo-600',
    '#14B8A6': 'from-teal-500 to-teal-600'
  };
  return gradientMap[hexColor] || 'from-gray-500 to-gray-600';
};

// 获取简单的颜色类
const getSimpleColorClass = (hexColor: string) => {
  const colorMap: Record<string, string> = {
    '#EF4444': 'bg-red-500',
    '#3B82F6': 'bg-blue-500',
    '#10B981': 'bg-green-500',
    '#8B5CF6': 'bg-purple-500',
    '#F59E0B': 'bg-amber-500',
    '#06B6D4': 'bg-cyan-500',
    '#84CC16': 'bg-lime-500',
    '#64748B': 'bg-gray-500',
    '#F97316': 'bg-orange-500',
    '#EC4899': 'bg-pink-500',
    '#6366F1': 'bg-indigo-500',
    '#14B8A6': 'bg-teal-500'
  };
  return colorMap[hexColor] || 'bg-gray-500';
};

const CategoryBrowser = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        console.log('🔍 CategoryBrowser: 开始获取分类数据...');
        
        // 获取分类数据
        const categoriesData = await apiRequestWithRetry(() => getCategories(), 2, 1000);
        
        setCategories(categoriesData);
        
        console.log('✅ CategoryBrowser: 获取分类数据成功');
        console.log(`   分类: ${categoriesData.length}个`);
        
      } catch (err) {
        console.error('❌ CategoryBrowser: 获取数据失败:', err);
        setError('获取数据失败，请刷新页面重试');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <LoaderIcon className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">加载中...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              重新加载
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            专业工具分类
          </h2>
          <p className="text-gray-600">按专业领域精准分类，快速找到最适合的工具</p>
        </div>

        {/* 分类展示 - 显示真实的分类数据 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => {
            const IconComponent = iconMap[category.icon] || FileText;
            const gradientClass = getGradientClass(category.color);
            
            return (
              <Link
                key={category.id}
                to={`/tools?category=${encodeURIComponent(category.name)}`}
                className="group"
              >
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-200 overflow-hidden">
                  <div className={`bg-gradient-to-r ${gradientClass} p-6`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="bg-white bg-opacity-20 p-3 rounded-lg">
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                        <div className="ml-4">
                          <h3 className="text-lg font-semibold text-white">
                            {category.name}
                          </h3>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-white opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <p className="text-gray-600 text-sm leading-relaxed mb-4">
                      {category.description || '专业工具分类'}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        查看工具
                      </span>
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* 如果分类数据为空的提示 */}
        {categories.length === 0 && !loading && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">暂无分类数据</p>
            <button 
              onClick={() => window.location.reload()}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              重新加载
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default CategoryBrowser;