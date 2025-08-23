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
  Microscope
} from 'lucide-react';
import { getCategories } from '../lib/supabase';
import { apiRequestWithRetry } from '../lib/api';

// 图标映射
const iconMap: Record<string, React.ComponentType<any>> = {
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

const CategoryBrowser = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCategories() {
      try {
        setLoading(true);
        console.log('🔄 开始获取分类数据...');
        
        // 直接调用getCategories，它现在包含fallback
        const data = await getCategories();
        console.log('📊 获取到分类数据:', data);
        
        // 只显示前6个分类
        setCategories(data.slice(0, 6));
        setError(null);
      } catch (err) {
        console.error('❌ 获取分类失败:', err);
        
        // 如果所有方法都失败，使用硬编码的分类
        const hardcodedCategories = [
          {
            id: 1,
            name: 'AI结构设计',
            description: '基于AI的结构设计与分析工具',
            icon: 'Brain',
            color: '#3B82F6'
          },
          {
            id: 2,
            name: 'BIM软件',
            description: '建筑信息模型设计与管理',
            icon: 'Layers',
            color: '#10B981'
          },
          {
            id: 3,
            name: '效率工具',
            description: '提升工作效率的专业工具',
            icon: 'Zap',
            color: '#F59E0B'
          },
          {
            id: 4,
            name: '岩土工程',
            description: '岩土工程分析与设计',
            icon: 'Mountain',
            color: '#8B5CF6'
          },
          {
            id: 5,
            name: '项目管理',
            description: '项目协作与管理工具',
            icon: 'Users',
            color: '#EF4444'
          },
          {
            id: 6,
            name: '智能施工管理',
            description: '施工过程管理与优化',
            icon: 'HardHat',
            color: '#06B6D4'
          }
        ];
        
        console.log('🔄 使用硬编码分类数据');
        setCategories(hardcodedCategories);
        setError(null);
      } finally {
        setLoading(false);
      }
    }

    fetchCategories();
  }, []);

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              我的工具
            </h2>
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center">
              编辑
            </button>
          </div>
        </div>

        {/* 快捷工具栏 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {/* 直接跳转到工具官网的快捷入口 */}
            <a
              href="https://chat.openai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div className="bg-green-500 p-3 rounded-lg mb-2 group-hover:scale-110 transition-transform">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 text-center">ChatGPT</span>
            </a>
            
            <a
              href="https://www.autodesk.com/products/autocad"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div className="bg-red-500 p-3 rounded-lg mb-2 group-hover:scale-110 transition-transform">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 text-center">AutoCAD</span>
            </a>
            
            <a
              href="https://www.csiamerica.com/products/etabs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div className="bg-blue-500 p-3 rounded-lg mb-2 group-hover:scale-110 transition-transform">
                <Wrench className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 text-center">ETABS</span>
            </a>
            
            <a
              href="https://www.csiamerica.com/products/sap2000"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div className="bg-purple-500 p-3 rounded-lg mb-2 group-hover:scale-110 transition-transform">
                <Mountain className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 text-center">SAP2000</span>
            </a>
            
            <a
              href="https://www.bentley.com/software/staad/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div className="bg-orange-500 p-3 rounded-lg mb-2 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 text-center">STAAD</span>
            </a>
            
            <a
              href="https://www.autodesk.com/products/revit"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div className="bg-indigo-500 p-3 rounded-lg mb-2 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 text-center">Revit</span>
            </a>
            
            <a
              href="https://www.tekla.com/products/tekla-structures"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div className="bg-teal-500 p-3 rounded-lg mb-2 group-hover:scale-110 transition-transform">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 text-center">Tekla</span>
            </a>
            
            <a
              href="https://www.bentley.com/software/microstation/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div className="bg-yellow-500 p-3 rounded-lg mb-2 group-hover:scale-110 transition-transform">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 text-center">MicroStation</span>
            </a>
          </div>
        </div>

        {/* 分类网格 */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">加载分类中...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((category) => {
              const IconComponent = iconMap[category.icon] || Brain;
              const gradientClass = getGradientClass(category.color);
              return (
                <Link
                  key={category.id}
                  to={`/tools?category=${category.id}`}
                  className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all duration-300 p-6 group"
                >
                  <div className={`bg-gradient-to-br ${gradientClass} rounded-lg p-4 mb-4`}>
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {category.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">
                    {category.description || '专业工具分类'}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">查看工具</span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* 查看更多按钮 */}
        <div className="text-center mt-12">
          <Link
            to="/tools"
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center mx-auto"
          >
            所有免费AI工具
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CategoryBrowser;