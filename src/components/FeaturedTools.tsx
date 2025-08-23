import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Heart } from 'lucide-react';

const featuredTools = [
  {
    id: 1,
    name: 'StructuralGPT',
    description: '基于AI的结构设计助手，能够快速生成结构方案并进行初步计算验证',
    category: 'AI结构设计',
    rating: 4.8,
    reviews: 156,
    views: 2340,
    image: 'https://images.pexels.com/photos/3862132/pexels-photo-3862132.jpeg?auto=compress&cs=tinysrgb&w=400',
    tags: ['AI助手', '结构计算', '方案生成'],
    pricing: '免费试用',
    featured: true
  },
  {
    id: 2,
    name: 'BIM智能建模',
    description: '利用AI技术自动生成BIM模型，支持多种建筑类型的快速建模',
    category: 'BIM软件',
    rating: 4.6,
    reviews: 89,
    views: 1890,
    image: 'https://images.pexels.com/photos/3862379/pexels-photo-3862379.jpeg?auto=compress&cs=tinysrgb&w=400',
    tags: ['BIM', '自动建模', '三维设计'],
    pricing: '¥299/月',
    featured: true
  },
  {
    id: 3,
    name: '智能造价估算',
    description: '基于历史数据和AI算法的工程造价快速估算工具，准确率达95%以上',
    category: '效率工具',
    rating: 4.7,
    reviews: 203,
    views: 3120,
    image: 'https://images.pexels.com/photos/3862365/pexels-photo-3862365.jpeg?auto=compress&cs=tinysrgb&w=400',
    tags: ['造价分析', 'AI预测', '成本控制'],
    pricing: '¥199/月',
    featured: true
  },
  {
    id: 4,
    name: '施工进度AI',
    description: '智能项目管理工具，通过AI分析优化施工进度安排和资源配置',
    category: '智能施工管理',
    rating: 4.5,
    reviews: 127,
    views: 1650,
    image: 'https://images.pexels.com/photos/3862130/pexels-photo-3862130.jpeg?auto=compress&cs=tinysrgb&w=400',
    tags: ['项目管理', '进度控制', '资源优化'],
    pricing: '¥399/月',
    featured: true
  },
  {
    id: 5,
    name: 'CAD智能绘图',
    description: '基于自然语言的CAD绘图工具，通过描述即可生成专业工程图纸',
    category: '效率工具',
    rating: 4.4,
    reviews: 94,
    views: 1420,
    image: 'https://images.pexels.com/photos/3862385/pexels-photo-3862385.jpeg?auto=compress&cs=tinysrgb&w=400',
    tags: ['CAD绘图', '自然语言', '自动生成'],
    pricing: '¥159/月',
    featured: true
  },
  {
    id: 6,
    name: '材料检测AI',
    description: '利用计算机视觉技术进行材料质量检测和缺陷识别的智能工具',
    category: '岩土工程',
    rating: 4.6,
    reviews: 78,
    views: 1180,
    image: 'https://images.pexels.com/photos/3862388/pexels-photo-3862388.jpeg?auto=compress&cs=tinysrgb&w=400',
    tags: ['质量检测', '计算机视觉', '缺陷识别'],
    pricing: '¥259/月',
    featured: true
  },
  {
    id: 7,
    name: '地质勘探AI',
    description: '基于机器学习的地质数据分析工具，提供精准的地质勘探报告',
    category: '岩土工程',
    rating: 4.3,
    reviews: 65,
    views: 980,
    image: 'https://images.pexels.com/photos/3862390/pexels-photo-3862390.jpeg?auto=compress&cs=tinysrgb&w=400',
    tags: ['地质分析', '机器学习', '勘探报告'],
    pricing: '¥399/月',
    featured: true
  },
  {
    id: 8,
    name: '项目协作平台',
    description: '专为土木工程项目设计的智能协作平台，支持多方实时协作',
    category: '项目管理',
    rating: 4.5,
    reviews: 112,
    views: 1560,
    image: 'https://images.pexels.com/photos/3862392/pexels-photo-3862392.jpeg?auto=compress&cs=tinysrgb&w=400',
    tags: ['团队协作', '项目管理', '实时同步'],
    pricing: '¥199/月',
    featured: true
  }
];

const FeaturedTools = () => {

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              精选工具
            </h2>
          </div>
        </div>

        {/* 精选工具列表 */}
        <div className="space-y-4">
          {featuredTools.map((tool) => (
            <div
              key={tool.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow group flex items-center space-x-4"
            >
              {/* Tool Logo */}
              <div className="flex-shrink-0">
                <img
                  src={tool.image}
                  alt={tool.name}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              </div>

              {/* Tool Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                    {tool.name}
                  </h3>
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                    {tool.category}
                  </span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">
                  {tool.description}
                </p>
              </div>

              {/* Tool Actions */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="flex items-center space-x-1 mb-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm font-medium text-gray-700">{tool.rating}</span>
                  </div>
                  <span className="text-xs text-gray-500">{tool.pricing}</span>
                </div>
                <button className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                  <Heart className="w-5 h-5" />
                </button>
                <Link
                  to={`/tools/${tool.id}`}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors inline-block"
                >
                  查看
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedTools;