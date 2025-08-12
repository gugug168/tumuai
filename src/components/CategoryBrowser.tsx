import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Brain, 
  Wrench, 
  Layers, 
  Zap, 
  Mountain, 
  Users,
  ArrowRight
} from 'lucide-react';

const categories = [
  {
    id: 'ai-structural',
    name: 'AI结构设计',
    description: '智能结构分析与设计工具',
    icon: Brain,
    color: 'bg-blue-500',
    count: 85,
    gradient: 'from-blue-500 to-blue-600'
  },
  {
    id: 'smart-construction',
    name: '智能施工管理',
    description: 'AI驱动的施工管理解决方案',
    icon: Wrench,
    color: 'bg-orange-500',
    count: 72,
    gradient: 'from-orange-500 to-orange-600'
  },
  {
    id: 'bim-software',
    name: 'BIM软件',
    description: '建筑信息模型相关工具',
    icon: Layers,
    color: 'bg-green-500',
    count: 64,
    gradient: 'from-green-500 to-green-600'
  },
  {
    id: 'efficiency-tools',
    name: '效率工具',
    description: '提升工作效率的实用工具',
    icon: Zap,
    color: 'bg-purple-500',
    count: 58,
    gradient: 'from-purple-500 to-purple-600'
  },
  {
    id: 'geotechnical',
    name: '岩土工程',
    description: '地质勘探与岩土分析工具',
    icon: Mountain,
    color: 'bg-yellow-500',
    count: 45,
    gradient: 'from-yellow-500 to-yellow-600'
  },
  {
    id: 'project-management',
    name: '项目管理',
    description: '工程项目管理与协作平台',
    icon: Users,
    color: 'bg-indigo-500',
    count: 39,
    gradient: 'from-indigo-500 to-indigo-600'
  }
];

const CategoryBrowser = () => {
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((category) => {
            const IconComponent = category.icon;
            return (
              <Link
                key={category.id}
                to={`/tools?category=${category.id}`}
                className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all duration-300 p-6 group"
              >
                <div className="text-center">
                  <div className="mb-4">
                    <IconComponent className="w-12 h-12 text-gray-400 mx-auto" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {category.name}
                  </h3>
                  <p className="text-sm text-gray-500">{category.count}个工具</p>
                </div>
              </Link>
            );
          })}
        </div>

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