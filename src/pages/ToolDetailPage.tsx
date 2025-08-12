import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ExternalLink, 
  Heart, 
  Star, 
  Play, 
  Check, 
  ArrowLeft,
  Eye,
  Calendar,
  Tag,
  Users,
  MessageCircle,
  Home,
  ChevronRight
} from 'lucide-react';

// 模拟工具数据
const toolsData = {
  1: {
    id: 1,
    name: 'StructuralGPT',
    logo: 'https://images.pexels.com/photos/3862132/pexels-photo-3862132.jpeg?auto=compress&cs=tinysrgb&w=200',
    category: 'AI结构设计',
    website: 'https://structuralgpt.com',
    shortDescription: '基于AI的结构设计助手，快速生成结构方案',
    detailedDescription: `StructuralGPT 是一款革命性的AI驱动结构设计工具，专为土木工程师打造。它利用先进的机器学习算法和大量的工程数据，能够在几分钟内生成优化的结构设计方案。

该工具不仅能够处理常规的建筑结构设计，还能应对复杂的工程挑战，如高层建筑、大跨度结构和特殊形状建筑的结构设计。通过智能分析荷载分布、材料特性和安全系数，StructuralGPT 为工程师提供了一个强大的设计助手。

对于土木工程师而言，这款工具的价值在于：显著减少设计时间、提高设计质量、降低人为错误、优化材料使用，最终提升整个项目的效率和安全性。`,
    images: [
      'https://images.pexels.com/photos/3862132/pexels-photo-3862132.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/3862379/pexels-photo-3862379.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/3862365/pexels-photo-3862365.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    videoUrl: 'https://example.com/demo-video',
    features: [
      '智能结构方案生成',
      '多种结构类型支持（框架、剪力墙、钢结构等）',
      '实时荷载分析和优化',
      '符合国家建筑规范标准',
      '3D可视化设计预览',
      '材料用量自动计算',
      '结构安全性评估',
      '导出标准设计图纸',
      '与主流CAD软件集成',
      '云端协作和版本管理'
    ],
    pricing: [
      {
        plan: '免费版',
        price: '¥0',
        period: '永久',
        features: ['基础结构设计', '最多3个项目', '标准模板库', '社区支持']
      },
      {
        plan: '专业版',
        price: '¥299',
        period: '月',
        features: ['无限项目数量', '高级AI算法', '自定义规范', '优先技术支持', '团队协作功能']
      },
      {
        plan: '企业版',
        price: '¥999',
        period: '月',
        features: ['专业版所有功能', '私有部署', '定制开发', '专属客户经理', 'API接口']
      }
    ],
    rating: 4.8,
    reviews: 156,
    views: 2340,
    tags: ['AI助手', '结构计算', '方案生成', '规范检查'],
    addedDate: '2024-01-15',
    lastUpdated: '2024-01-20'
  },
  2: {
    id: 2,
    name: 'BIM智能建模',
    logo: 'https://images.pexels.com/photos/3862379/pexels-photo-3862379.jpeg?auto=compress&cs=tinysrgb&w=200',
    category: 'BIM软件',
    website: 'https://bim-ai.com',
    shortDescription: '利用AI技术自动生成BIM模型',
    detailedDescription: `BIM智能建模是一款革命性的建筑信息模型生成工具，专为建筑师和工程师设计。它利用先进的人工智能算法，能够根据设计图纸和参数自动生成详细的BIM模型。

该工具支持多种建筑类型，从住宅建筑到复杂的商业建筑，都能快速生成高质量的三维模型。通过智能识别建筑元素和结构关系，大大减少了手工建模的时间和错误。

对于设计团队而言，这款工具能够显著提升建模效率，改善协作流程，确保设计的一致性和准确性。`,
    images: [
      'https://images.pexels.com/photos/3862379/pexels-photo-3862379.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/3862132/pexels-photo-3862132.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    videoUrl: 'https://example.com/bim-demo',
    features: [
      '自动BIM模型生成',
      '多格式导入导出',
      '智能构件识别',
      '参数化建模',
      '碰撞检测',
      '材料清单自动生成',
      '团队协作功能',
      '云端同步'
    ],
    pricing: [
      {
        plan: '基础版',
        price: '¥199',
        period: '月',
        features: ['基础建模功能', '5个项目', '标准导出格式']
      },
      {
        plan: '专业版',
        price: '¥399',
        period: '月',
        features: ['高级AI算法', '无限项目', '全格式支持', '团队协作']
      }
    ],
    rating: 4.6,
    reviews: 89,
    views: 1890,
    tags: ['BIM', '自动建模', '三维设计'],
    addedDate: '2024-01-10',
    lastUpdated: '2024-01-18'
  },
  3: {
    id: 3,
    name: '智能造价估算',
    logo: 'https://images.pexels.com/photos/3862365/pexels-photo-3862365.jpeg?auto=compress&cs=tinysrgb&w=200',
    category: '效率工具',
    website: 'https://cost-ai.com',
    shortDescription: '基于历史数据的工程造价快速估算',
    detailedDescription: `智能造价估算是一款基于大数据和人工智能的工程造价预测工具。它通过分析海量的历史工程数据，能够为各类土木工程项目提供精准的造价估算。

该工具支持多种工程类型，包括住宅建筑、商业建筑、基础设施等。通过输入项目的基本参数，如建筑面积、结构类型、地理位置等，系统能够快速生成详细的造价分析报告。

对于工程师和项目经理而言，这款工具能够显著提升造价估算的准确性和效率，帮助项目在预算控制方面做出更明智的决策。`,
    images: [
      'https://images.pexels.com/photos/3862365/pexels-photo-3862365.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/3862132/pexels-photo-3862132.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    videoUrl: 'https://example.com/cost-demo',
    features: [
      '智能造价预测',
      '多项目类型支持',
      '历史数据分析',
      '成本优化建议',
      '详细报告生成',
      '市场价格更新'
    ],
    pricing: [
      {
        plan: '基础版',
        price: '¥99',
        period: '月',
        features: ['基础估算功能', '5个项目', '标准报告']
      },
      {
        plan: '专业版',
        price: '¥199',
        period: '月',
        features: ['高级算法', '无限项目', '详细分析', '优化建议']
      }
    ],
    rating: 4.7,
    reviews: 203,
    views: 3120,
    tags: ['造价分析', 'AI预测', '成本控制'],
    addedDate: '2024-01-12',
    lastUpdated: '2024-01-19'
  },
  4: {
    id: 4,
    name: '施工进度AI',
    logo: 'https://images.pexels.com/photos/3862130/pexels-photo-3862130.jpeg?auto=compress&cs=tinysrgb&w=200',
    category: '智能施工管理',
    website: 'https://construction-ai.com',
    shortDescription: '智能项目管理工具，优化施工进度安排',
    detailedDescription: `施工进度AI是一款专为建筑施工项目设计的智能管理工具。它利用先进的人工智能算法，能够优化施工进度安排，提高项目执行效率。

该工具通过分析项目的各个环节，包括人员配置、材料供应、设备使用等因素，自动生成最优的施工计划。同时，它还能实时监控项目进展，及时发现潜在问题并提供解决方案。

对于项目经理和施工团队而言，这款工具能够显著提升项目管理效率，减少延期风险，确保项目按时完成。`,
    images: [
      'https://images.pexels.com/photos/3862130/pexels-photo-3862130.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/3862379/pexels-photo-3862379.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    videoUrl: 'https://example.com/construction-demo',
    features: [
      '智能进度规划',
      '资源优化配置',
      '实时进度监控',
      '风险预警系统',
      '团队协作管理',
      '报告自动生成'
    ],
    pricing: [
      {
        plan: '标准版',
        price: '¥299',
        period: '月',
        features: ['基础管理功能', '10个项目', '标准报告']
      },
      {
        plan: '企业版',
        price: '¥599',
        period: '月',
        features: ['高级功能', '无限项目', '定制报告', '专属支持']
      }
    ],
    rating: 4.5,
    reviews: 127,
    views: 1650,
    tags: ['项目管理', '进度控制', '资源优化'],
    addedDate: '2024-01-08',
    lastUpdated: '2024-01-16'
  },
  5: {
    id: 5,
    name: 'CAD智能绘图',
    logo: 'https://images.pexels.com/photos/3862385/pexels-photo-3862385.jpeg?auto=compress&cs=tinysrgb&w=200',
    category: '效率工具',
    website: 'https://cad-ai.com',
    shortDescription: '基于自然语言的CAD绘图工具',
    detailedDescription: `CAD智能绘图是一款革命性的计算机辅助设计工具，它允许用户通过自然语言描述来生成专业的工程图纸。这款工具结合了先进的自然语言处理技术和CAD绘图算法。

用户只需要用简单的中文描述他们想要绘制的图形，比如"绘制一个长10米、宽8米的矩形建筑平面图"，系统就能自动生成相应的CAD图纸。这大大降低了CAD软件的使用门槛。

对于工程师而言，这款工具能够显著提升绘图效率，特别适合快速概念设计和初步方案制作。`,
    images: [
      'https://images.pexels.com/photos/3862385/pexels-photo-3862385.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/3862365/pexels-photo-3862365.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    videoUrl: 'https://example.com/cad-demo',
    features: [
      '自然语言输入',
      '自动图纸生成',
      '多种图纸格式',
      '智能标注功能',
      '图层管理',
      '导出多种格式'
    ],
    pricing: [
      {
        plan: '个人版',
        price: '¥0',
        period: '永久',
        features: ['基础绘图功能', '个人使用', '标准导出']
      },
      {
        plan: '专业版',
        price: '¥159',
        period: '月',
        features: ['高级功能', '商业使用', '全格式支持', '优先支持']
      }
    ],
    rating: 4.4,
    reviews: 94,
    views: 1420,
    tags: ['CAD绘图', '自然语言', '自动生成'],
    addedDate: '2024-01-05',
    lastUpdated: '2024-01-15'
  },
  10: {
    id: 10,
    name: '钢筋配筋优化',
    logo: 'https://images.pexels.com/photos/3862396/pexels-photo-3862396.jpeg?auto=compress&cs=tinysrgb&w=200',
    category: 'AI结构设计',
    website: 'https://rebar-optimizer.com',
    shortDescription: '智能钢筋配筋计算和优化工具',
    detailedDescription: `钢筋配筋优化是一款专门针对混凝土结构钢筋配筋设计的智能化工具。它基于先进的优化算法和丰富的工程经验，能够为各种混凝土构件提供最优的钢筋配筋方案。

该工具支持梁、板、柱、墙等各类构件的配筋计算，不仅满足结构安全要求，还能在保证安全的前提下最大程度地节约钢筋用量，降低工程成本。

通过智能分析构件的受力特点、几何尺寸和边界条件，系统能够自动选择最合适的钢筋直径、间距和布置方式，大大提高了配筋设计的效率和质量。`,
    images: [
      'https://images.pexels.com/photos/3862396/pexels-photo-3862396.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/3862132/pexels-photo-3862132.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    videoUrl: 'https://example.com/rebar-demo',
    features: [
      '智能配筋方案生成',
      '多种构件类型支持',
      '成本优化算法',
      '规范自动检查',
      '3D配筋可视化',
      '材料清单自动生成',
      '施工图纸导出',
      '批量计算功能'
    ],
    pricing: [
      {
        plan: '试用版',
        price: '¥0',
        period: '30天',
        features: ['基础配筋功能', '最多5个构件', '标准规范']
      },
      {
        plan: '专业版',
        price: '¥199',
        period: '月',
        features: ['无限构件数量', '高级优化算法', '多规范支持', '技术支持']
      }
    ],
    rating: 4.6,
    reviews: 87,
    views: 1234,
    tags: ['钢筋配筋', 'AI优化', '成本控制', '结构设计'],
    addedDate: '2024-01-08',
    lastUpdated: '2024-01-18'
  },
  11: {
    id: 11,
    name: '混凝土强度预测',
    logo: 'https://images.pexels.com/photos/3862398/pexels-photo-3862398.jpeg?auto=compress&cs=tinysrgb&w=200',
    category: '岩土工程',
    website: 'https://concrete-strength.com',
    shortDescription: '利用机器学习预测混凝土强度发展',
    detailedDescription: `混凝土强度预测是一款基于机器学习技术的混凝土性能预测工具。它能够根据混凝土的配合比、养护条件、环境因素等参数，准确预测混凝土在不同龄期的强度发展趋势。

该工具采用了大量的实验数据和现场检测数据进行训练，能够为不同类型的混凝土（普通混凝土、高性能混凝土、特种混凝土等）提供可靠的强度预测。

对于工程师而言，这款工具能够帮助优化混凝土配合比设计，合理安排施工进度，确保工程质量，同时降低材料成本。`,
    images: [
      'https://images.pexels.com/photos/3862398/pexels-photo-3862398.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/3862379/pexels-photo-3862379.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    videoUrl: 'https://example.com/concrete-demo',
    features: [
      '强度发展预测',
      '配合比优化',
      '多种混凝土类型支持',
      '环境因素考虑',
      '历史数据分析',
      '预测报告生成',
      '质量控制建议',
      '成本效益分析'
    ],
    pricing: [
      {
        plan: '免费版',
        price: '¥0',
        period: '永久',
        features: ['基础预测功能', '标准混凝土类型', '简单报告']
      },
      {
        plan: '专业版',
        price: '¥149',
        period: '月',
        features: ['高级预测算法', '全混凝土类型', '详细分析报告', '技术支持']
      }
    ],
    rating: 4.4,
    reviews: 56,
    views: 892,
    tags: ['强度预测', '机器学习', '配合比优化', '质量控制'],
    addedDate: '2024-01-05',
    lastUpdated: '2024-01-15'
  },
  12: {
    id: 12,
    name: '施工安全监控',
    logo: 'https://images.pexels.com/photos/3862400/pexels-photo-3862400.jpeg?auto=compress&cs=tinysrgb&w=200',
    category: '智能施工管理',
    website: 'https://safety-monitor.com',
    shortDescription: '基于计算机视觉的施工现场安全监控',
    detailedDescription: `施工安全监控是一款基于计算机视觉和人工智能技术的施工现场安全管理系统。它能够实时监控施工现场的安全状况，自动识别各种安全隐患和违规行为。

该系统通过部署在施工现场的摄像头，实时分析现场画面，能够识别工人是否佩戴安全帽、安全带，是否存在危险作业行为，以及现场是否有安全隐患等。

一旦发现安全问题，系统会立即发出警报，并将相关信息推送给安全管理人员，帮助及时处理安全隐患，有效预防安全事故的发生。`,
    images: [
      'https://images.pexels.com/photos/3862400/pexels-photo-3862400.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/3862365/pexels-photo-3862365.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    videoUrl: 'https://example.com/safety-demo',
    features: [
      '实时安全监控',
      '智能违规识别',
      '安全装备检测',
      '危险区域监控',
      '自动报警系统',
      '安全统计分析',
      '移动端推送',
      '历史记录查询'
    ],
    pricing: [
      {
        plan: '基础版',
        price: '¥399',
        period: '月',
        features: ['基础监控功能', '最多10个摄像头', '标准报警']
      },
      {
        plan: '企业版',
        price: '¥799',
        period: '月',
        features: ['高级AI算法', '无限摄像头', '定制报警规则', '专属支持']
      }
    ],
    rating: 4.7,
    reviews: 134,
    views: 1876,
    tags: ['安全监控', '计算机视觉', 'AI识别', '施工管理'],
    addedDate: '2024-01-03',
    lastUpdated: '2024-01-12'
  }
};

const relatedTools = [
  {
    id: 2,
    name: 'BIM智能建模',
    description: '利用AI技术自动生成BIM模型',
    category: 'BIM软件',
    rating: 4.6,
    logo: 'https://images.pexels.com/photos/3862379/pexels-photo-3862379.jpeg?auto=compress&cs=tinysrgb&w=100'
  },
  {
    id: 3,
    name: '智能造价估算',
    description: '基于历史数据的工程造价快速估算',
    category: '效率工具',
    rating: 4.7,
    logo: 'https://images.pexels.com/photos/3862365/pexels-photo-3862365.jpeg?auto=compress&cs=tinysrgb&w=100'
  },
  {
    id: 4,
    name: '钢筋配筋优化',
    description: '智能钢筋配筋计算和优化工具',
    category: 'AI结构设计',
    rating: 4.5,
    logo: 'https://images.pexels.com/photos/3862130/pexels-photo-3862130.jpeg?auto=compress&cs=tinysrgb&w=100'
  }
];

const reviews = [
  {
    id: 1,
    user: '张工程师',
    avatar: 'https://images.pexels.com/photos/3785079/pexels-photo-3785079.jpeg?auto=compress&cs=tinysrgb&w=50',
    rating: 5,
    date: '2024-01-18',
    comment: '非常棒的工具！大大提高了我的设计效率，AI生成的方案质量很高，为我节省了大量时间。'
  },
  {
    id: 2,
    user: '李设计师',
    avatar: 'https://images.pexels.com/photos/3777943/pexels-photo-3777943.jpeg?auto=compress&cs=tinysrgb&w=50',
    rating: 4,
    date: '2024-01-16',
    comment: '功能很强大，特别是规范检查功能很实用。希望能增加更多的结构类型支持。'
  },
  {
    id: 3,
    user: '王项目经理',
    avatar: 'https://images.pexels.com/photos/3785077/pexels-photo-3785077.jpeg?auto=compress&cs=tinysrgb&w=50',
    rating: 5,
    date: '2024-01-14',
    comment: '团队协作功能很好用，整个项目组都在使用，大大提升了我们的工作效率。'
  }
];

const ToolDetailPage = () => {
  const { toolId } = useParams();
  const [selectedImage, setSelectedImage] = useState(0);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [showVideoModal, setShowVideoModal] = useState(false);
  
  // 模拟获取工具数据
  const tool = toolsData[parseInt(toolId || '1') as keyof typeof toolsData];
  
  if (!tool) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">工具未找到</h2>
          <p className="text-gray-600 mb-4">抱歉，您访问的工具不存在或已被删除。</p>
          <Link to="/tools" className="text-blue-600 hover:text-blue-700">
            返回工具中心
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    // 这里处理评论提交逻辑
    console.log('提交评论:', newReview);
    setNewReview({ rating: 5, comment: '' });
    alert('评论提交成功！');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 面包屑导航 */}
        <div className="mb-6">
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
            <Link to="/" className="hover:text-gray-700 transition-colors flex items-center">
              <Home className="w-4 h-4 mr-1" />
              首页
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link to="/tools" className="hover:text-gray-700 transition-colors">
              工具中心
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 font-medium">{tool.name}</span>
          </nav>
          
          <div className="flex items-center justify-between">
            <Link
              to="/tools"
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回工具中心
            </Link>
          </div>
        </div>

        {/* 页面顶部 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
            <img
              src={tool.logo}
              alt={tool.name}
              className="w-20 h-20 rounded-xl object-cover"
            />
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{tool.name}</h1>
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                  {tool.category}
                </span>
              </div>
              <p className="text-lg text-gray-600 mb-4">{tool.shortDescription}</p>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span>{tool.rating} ({tool.reviews} 评价)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Eye className="w-4 h-4" />
                  <span>{tool.views.toLocaleString()} 次浏览</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>更新于 {tool.lastUpdated}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col space-y-3">
              <a
                href={tool.website}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                访问官网
                <ExternalLink className="ml-2 w-4 h-4" />
              </a>
              <button className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center">
                <Heart className="mr-2 w-4 h-4" />
                收藏工具
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧主要内容 */}
          <div className="lg:col-span-2 space-y-8">
            {/* 详细介绍 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">详细介绍</h2>
              <div className="prose prose-lg max-w-none text-gray-800 leading-relaxed">
                {tool.detailedDescription.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="mb-4 text-gray-800">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            {/* 图片/视频画廊 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">产品截图</h2>
              <div className="space-y-4">
                {/* 主图片 */}
                <div className="relative">
                  <img
                    src={tool.images[selectedImage]}
                    alt={`${tool.name} 截图 ${selectedImage + 1}`}
                    className="w-full h-96 object-cover rounded-lg"
                  />
                  {tool.videoUrl && selectedImage === 0 && (
                    <button
                      onClick={() => setShowVideoModal(true)}
                      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg hover:bg-opacity-40 transition-colors"
                    >
                      <div className="bg-white rounded-full p-4">
                        <Play className="w-8 h-8 text-blue-600" />
                      </div>
                    </button>
                  )}
                </div>
                
                {/* 缩略图 */}
                <div className="flex space-x-4">
                  {tool.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                        selectedImage === index ? 'border-blue-500' : 'border-gray-200'
                      }`}
                    >
                      <img
                        src={image}
                        alt={`缩略图 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 核心功能列表 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">核心功能</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tool.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 用户评论区 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">用户评价</h2>
              
              {/* 评论统计 */}
              <div className="flex items-center space-x-6 mb-8 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{tool.rating}</div>
                  <div className="flex items-center justify-center space-x-1 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.floor(tool.rating)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-sm text-gray-500">{tool.reviews} 条评价</div>
                </div>
                <div className="flex-1">
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <div key={rating} className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600 w-8">{rating}星</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-yellow-400 h-2 rounded-full"
                            style={{ width: `${rating === 5 ? 70 : rating === 4 ? 20 : 5}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-500 w-8">
                          {rating === 5 ? '70%' : rating === 4 ? '20%' : '5%'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 发表评论 */}
              <form onSubmit={handleSubmitReview} className="mb-8 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">发表评价</h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">评分</label>
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewReview({ ...newReview, rating: star })}
                        className="p-1"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= newReview.rating
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">评论内容</label>
                  <textarea
                    name="detailedDescription"
                    value={newReview.comment}
                    onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                    placeholder="分享您使用这个工具的体验..."
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  提交评价
                </button>
              </form>

              {/* 评论列表 */}
              <div className="space-y-6">
                {reviews.map((review) => (
                  <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                    <div className="flex items-start space-x-4">
                      <img
                        src={review.avatar}
                        alt={review.user}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-semibold text-gray-900">{review.user}</h4>
                          <div className="flex items-center space-x-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= review.rating
                                    ? 'text-yellow-400 fill-current'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-gray-500">{review.date}</span>
                        </div>
                        <p className="text-gray-700 leading-relaxed">{review.comment}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧边栏 */}
          <div className="space-y-8">
            {/* 定价信息 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">定价方案</h3>
              <div className="space-y-4">
                {tool.pricing.map((plan, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${
                      index === 1 ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900">{plan.plan}</h4>
                      {index === 1 && (
                        <span className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs">
                          推荐
                        </span>
                      )}
                    </div>
                    <div className="mb-3">
                      <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                      <span className="text-gray-500">/{plan.period}</span>
                    </div>
                    <ul className="space-y-2 text-sm text-gray-600">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center space-x-2">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* 工具标签 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">工具标签</h3>
              <div className="flex flex-wrap gap-2">
                {tool.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm flex items-center"
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* 工具信息 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">工具信息</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">分类</span>
                  <span className="font-medium text-gray-900">{tool.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">收录时间</span>
                  <span className="font-medium text-gray-900">{tool.addedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">最后更新</span>
                  <span className="font-medium text-gray-900">{tool.lastUpdated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">浏览量</span>
                  <span className="font-medium text-gray-900">{tool.views.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 相关工具推荐 */}
        <div className="mt-12">
          <div className="card p-8">
            <h2 className="text-2xl font-bold text-primary-800 mb-6">相关工具推荐</h2>
            <p className="text-gray-600 mb-6">与当前工具同属"{tool.category}"分类的其他优质工具</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedTools.map((relatedTool) => (
                <Link
                  key={relatedTool.id}
                  to={`/tools/${relatedTool.id}`}
                  className="group card p-4 hover:shadow-md transition-shadow relative"
                >
                  {/* 收藏按钮 */}
                  <button className="absolute top-3 right-3 bg-white/90 p-1.5 rounded-full hover:bg-white transition-colors">
                    <Heart className="w-3 h-3 text-gray-600 hover:text-red-500" />
                  </button>
                  
                  <div className="flex items-center space-x-3 mb-3">
                    <img
                      src={relatedTool.logo}
                      alt={relatedTool.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div>
                      <h3 className="font-semibold text-primary-800 group-hover:text-accent-600 transition-colors">
                        {relatedTool.name}
                      </h3>
                      <span className="tag-primary text-xs">
                        {relatedTool.category}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{relatedTool.description}</p>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm text-gray-600">{relatedTool.rating}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolDetailPage;