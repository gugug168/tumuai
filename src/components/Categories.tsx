import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Calculator, 
  Wrench, 
  FileText, 
  BarChart3, 
  Layers,
  Ruler,
  HardHat,
  Mountain,
  Road,
  Zap,
  Box,
  Construction,
  PenTool,
  MapPin,
  DollarSign,
  Microscope
} from 'lucide-react';
import { getCategories } from '../lib/supabase';
import { apiRequestWithRetry } from '../lib/api';

// 图标映射
const iconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  'Building2': Building2,
  'Calculator': Calculator,
  'Wrench': Wrench,
  'FileText': FileText,
  'BarChart3': BarChart3,
  'Layers': Layers,
  'Ruler': Ruler,
  'HardHat': HardHat,
  'Mountain': Mountain,
  'Road': Road,
  'Zap': Zap,
  'Box': Box,
  'Construction': Construction,
  'pen-tool': PenTool,
  'map-pin': MapPin,
  'dollar-sign': DollarSign,
  'microscope': Microscope,
  'file-text': FileText
};

// 颜色类映射（将hex颜色转换为Tailwind类）
const getColorClass = (hexColor: string) => {
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

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCategories() {
      try {
        setLoading(true);
        const data = await apiRequestWithRetry(() => getCategories(), 2, 1500);
        setCategories(data);
        setError(null);
      } catch (err) {
        console.error('获取分类失败:', err);
        setError('获取分类失败');
      } finally {
        setLoading(false);
      }
    }

    fetchCategories();
  }, []);

  if (loading) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">加载分类中...</p>
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
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            按专业领域浏览工具
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            我们将工具按照土木工程的不同专业领域进行分类，帮助您快速找到所需的专业工具
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((category) => {
            const IconComponent = iconMap[category.icon] || FileText;
            const colorClass = getColorClass(category.color);
            return (
              <div
                key={category.id}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="flex items-center mb-4">
                  <div className={`${colorClass} p-3 rounded-lg group-hover:scale-110 transition-transform`}>
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {category.name}
                    </h3>
                    <span className="text-sm text-gray-500">查看工具</span>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {category.description || '专业工具分类'}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Categories;