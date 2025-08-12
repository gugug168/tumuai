import React from 'react';
import { 
  Building2, 
  Calculator, 
  Wrench, 
  FileText, 
  BarChart3, 
  Layers,
  Ruler,
  HardHat
} from 'lucide-react';

const categories = [
  {
    id: 1,
    name: '结构设计',
    description: '结构计算、分析、设计工具',
    icon: Building2,
    color: 'bg-blue-500',
    count: 85
  },
  {
    id: 2,
    name: 'BIM建模',
    description: '建筑信息模型相关工具',
    icon: Layers,
    color: 'bg-green-500',
    count: 72
  },
  {
    id: 3,
    name: '施工管理',
    description: '项目管理、进度控制工具',
    icon: HardHat,
    color: 'bg-orange-500',
    count: 64
  },
  {
    id: 4,
    name: '造价估算',
    description: '工程造价、成本控制工具',
    icon: Calculator,
    color: 'bg-purple-500',
    count: 58
  },
  {
    id: 5,
    name: '工程制图',
    description: 'CAD、制图、绘图工具',
    icon: Ruler,
    color: 'bg-red-500',
    count: 45
  },
  {
    id: 6,
    name: '数据分析',
    description: '工程数据分析、可视化工具',
    icon: BarChart3,
    color: 'bg-indigo-500',
    count: 39
  },
  {
    id: 7,
    name: '质量检测',
    description: '材料检测、质量控制工具',
    icon: Wrench,
    color: 'bg-teal-500',
    count: 32
  },
  {
    id: 8,
    name: '文档管理',
    description: '技术文档、报告生成工具',
    icon: FileText,
    color: 'bg-yellow-500',
    count: 28
  }
];

const Categories = () => {
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
            const IconComponent = category.icon;
            return (
              <div
                key={category.id}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="flex items-center mb-4">
                  <div className={`${category.color} p-3 rounded-lg group-hover:scale-110 transition-transform`}>
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {category.name}
                    </h3>
                    <span className="text-sm text-gray-500">{category.count} 个工具</span>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {category.description}
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