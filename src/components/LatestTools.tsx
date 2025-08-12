import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ExternalLink, Heart, Eye, Clock } from 'lucide-react';

const latestTools = [
  {
    id: 1,
    name: '智能钢筋配筋',
    description: '基于AI的钢筋配筋优化工具，自动计算最优配筋方案',
    category: 'AI结构设计',
    rating: 4.5,
    reviews: 23,
    views: 456,
    image: 'https://images.pexels.com/photos/3862132/pexels-photo-3862132.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['钢筋配筋', 'AI优化'],
    pricing: '¥199/月',
    addedDate: '2024-01-20'
  },
  {
    id: 2,
    name: '混凝土强度预测',
    description: '利用机器学习预测混凝土强度发展趋势',
    category: '岩土工程',
    rating: 4.3,
    reviews: 18,
    views: 342,
    image: 'https://images.pexels.com/photos/3862379/pexels-photo-3862379.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['强度预测', '机器学习'],
    pricing: '免费',
    addedDate: '2024-01-19'
  },
  {
    id: 3,
    name: '施工安全监控',
    description: '基于计算机视觉的施工现场安全监控系统',
    category: '智能施工管理',
    rating: 4.7,
    reviews: 34,
    views: 678,
    image: 'https://images.pexels.com/photos/3862365/pexels-photo-3862365.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['安全监控', '计算机视觉'],
    pricing: '¥599/月',
    addedDate: '2024-01-18'
  },
  {
    id: 4,
    name: 'BIM碰撞检测',
    description: '智能BIM模型碰撞检测和冲突解决方案',
    category: 'BIM软件',
    rating: 4.6,
    reviews: 41,
    views: 523,
    image: 'https://images.pexels.com/photos/3862130/pexels-photo-3862130.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['碰撞检测', 'BIM'],
    pricing: '¥299/月',
    addedDate: '2024-01-17'
  },
  {
    id: 5,
    name: '工程量智能计算',
    description: '基于图纸识别的工程量自动计算工具',
    category: '效率工具',
    rating: 4.4,
    reviews: 29,
    views: 445,
    image: 'https://images.pexels.com/photos/3862385/pexels-photo-3862385.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['工程量', '图纸识别'],
    pricing: '¥159/月',
    addedDate: '2024-01-16'
  },
  {
    id: 6,
    name: '地基承载力分析',
    description: '智能地基承载力分析和基础设计优化',
    category: '岩土工程',
    rating: 4.5,
    reviews: 26,
    views: 389,
    image: 'https://images.pexels.com/photos/3862388/pexels-photo-3862388.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['地基分析', '基础设计'],
    pricing: '¥249/月',
    addedDate: '2024-01-15'
  },
  {
    id: 7,
    name: '项目进度预测',
    description: 'AI驱动的项目进度预测和风险评估工具',
    category: '项目管理',
    rating: 4.2,
    reviews: 19,
    views: 312,
    image: 'https://images.pexels.com/photos/3862390/pexels-photo-3862390.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['进度预测', '风险评估'],
    pricing: '¥399/月',
    addedDate: '2024-01-14'
  },
  {
    id: 8,
    name: '结构健康监测',
    description: '基于传感器数据的结构健康状态监测系统',
    category: 'AI结构设计',
    rating: 4.6,
    reviews: 37,
    views: 567,
    image: 'https://images.pexels.com/photos/3862392/pexels-photo-3862392.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['健康监测', '传感器'],
    pricing: '¥799/月',
    addedDate: '2024-01-13'
  },
  {
    id: 9,
    name: '智能排水设计',
    description: '基于AI的城市排水系统智能设计工具',
    category: '效率工具',
    rating: 4.3,
    reviews: 22,
    views: 398,
    image: 'https://images.pexels.com/photos/3862394/pexels-photo-3862394.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['排水设计', '城市规划'],
    pricing: '¥299/月',
    addedDate: '2024-01-12'
  },
  {
    id: 10,
    name: '材料成本优化',
    description: '智能材料选择和成本优化分析工具',
    category: '效率工具',
    rating: 4.4,
    reviews: 31,
    views: 476,
    image: 'https://images.pexels.com/photos/3862396/pexels-photo-3862396.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['成本优化', '材料选择'],
    pricing: '¥199/月',
    addedDate: '2024-01-11'
  },
  {
    id: 11,
    name: '桥梁设计助手',
    description: 'AI辅助的桥梁结构设计和优化工具',
    category: 'AI结构设计',
    rating: 4.7,
    reviews: 45,
    views: 623,
    image: 'https://images.pexels.com/photos/3862398/pexels-photo-3862398.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['桥梁设计', 'AI辅助'],
    pricing: '¥499/月',
    addedDate: '2024-01-10'
  },
  {
    id: 12,
    name: '施工质量检测',
    description: '基于图像识别的施工质量自动检测系统',
    category: '智能施工管理',
    rating: 4.5,
    reviews: 28,
    views: 412,
    image: 'https://images.pexels.com/photos/3862400/pexels-photo-3862400.jpeg?auto=compress&cs=tinysrgb&w=300',
    tags: ['质量检测', '图像识别'],
    pricing: '¥399/月',
    addedDate: '2024-01-09'
  }
];

const LatestTools = () => {
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {latestTools.map((tool) => (
            <div
              key={tool.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 overflow-hidden group"
            >
              {/* Tool Image */}
              <div className="relative overflow-hidden">
                <img
                  src={tool.image}
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
                  {tool.description}
                </p>

                <div className="mb-3">
                  <span className="tag-primary px-2 py-1 rounded-md text-xs font-medium">
                    {tool.category}
                  </span>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {tool.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Stats and Pricing */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Eye className="w-3 h-3" />
                      <span>{tool.views}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3" />
                      <span>{tool.reviews}</span>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-accent-600">
                    {tool.pricing}
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

        <div className="text-center mt-12">
          <button className="btn-secondary px-8 py-3">
            查看更多最新工具
          </button>
        </div>
      </div>
    </section>
  );
};

export default LatestTools;