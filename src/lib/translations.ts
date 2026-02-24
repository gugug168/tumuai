/**
 * 分类和特性翻译映射
 * 用于将数据库中的中文值翻译为英文
 */

// 分类翻译映射
export const CATEGORY_TRANSLATIONS: Record<string, string> = {
  // 主要分类
  '前期规划': 'Planning',
  '勘察测量': 'Survey',
  '方案设计': 'Design',
  '结构分析': 'Structural Analysis',
  '施工图深化': 'Detailing',
  '施工管理': 'Construction',
  '运维监测': 'O&M',

  // 技术领域分类
  '计算机视觉': 'Computer Vision',
  '自然语言处理': 'NLP',
  '生成式人工智能': 'Generative AI',
  '文档智能': 'Document AI',
  '目标检测': 'Object Detection',
  '边缘智能': 'Edge AI',
  '工业自动化': 'Industrial Automation',
  '效率工具': 'Productivity',
  '工程领域人工智能': 'Engineering AI',
  '人工智能结构设计': 'AI Structural Design',
  '智能施工管理': 'Smart Construction',
  '施工领域人工智能': 'Construction AI',
};

// 特性翻译映射（常见特性关键词）
export const FEATURE_TRANSLATIONS: Record<string, string> = {
  // 通用 AI 功能
  'AI智能审图': 'AI Drawing Review',
  'AI渲染': 'AI Rendering',
  'AI灵感激发': 'AI Inspiration',
  'AI建模': 'AI Modeling',
  'AI助手': 'AI Copilot',
  'AI图像生成': 'AI Image Gen',
  '生成式设计': 'Generative Design',
  '生成式AI设计': 'Generative AI Design',

  // 设计相关
  '智能识图': 'Smart Recognition',
  '智能算量': 'Smart Quantity',
  '自动计价': 'Auto Pricing',
  '智能优化': 'Smart Optimization',
  '自动化布局': 'Auto Layout',
  '自动标注': 'Auto Annotation',
  '自动化绘图': 'Auto Drawing',
  '一键绘图': 'One-click Drawing',
  '快速出图': 'Fast Output',
  '多软件支持': 'Multi-software',
  '多软件兼容': 'Multi-software',
  '多风格生成': 'Multi-style',
  '实时渲染': 'Real-time Render',
  '高品质效果': 'High Quality',

  // BIM 相关
  'BIM集成': 'BIM Integration',
  'BIM驱动': 'BIM-driven',
  'BIM融合': 'BIM Integration',
  'BIM对比': 'BIM Comparison',
  'BIM设计': 'BIM Design',
  'BIM咨询': 'BIM Consulting',
  'Revit插件': 'Revit Plugin',
  'Rhino插件': 'Rhino Plugin',
  'CAD集成': 'CAD Integration',
  '自动生成RVT/DWG': 'RVT/DWG Export',

  // 审查相关
  '规范校验': 'Code Check',
  '规范强条检查': 'Code Compliance',
  '规范自动检查': 'Auto Code Check',
  '自动审查规范': 'Auto Review',
  '错误检测': 'Error Detection',
  '碰撞检查': 'Clash Detection',

  // 施工管理
  '进度管理': 'Schedule Mgmt',
  '进度跟踪': 'Progress Tracking',
  '进度排程优化': 'Schedule Optimization',
  '进度自动跟踪': 'Auto Progress',
  '成本控制': 'Cost Control',
  '质量管理': 'Quality Mgmt',
  '安全管理': 'Safety Mgmt',
  '安全监测': 'Safety Monitoring',
  '资源均衡': 'Resource Balance',
  '风险管理': 'Risk Mgmt',
  '风险预测': 'Risk Prediction',
  '延误风险识别': 'Delay Risk ID',
  '多方协同': 'Collaboration',
  '项目管理': 'Project Mgmt',
  '智能调度': 'Smart Scheduling',
  '云端管理': 'Cloud Mgmt',

  // 造价相关
  '造价分析': 'Cost Analysis',
  '土建钢筋算量': 'Rebar Quantity',
  '安装算量': 'MEP Quantity',
  '材料价格查询': 'Material Price',

  // 监测相关
  'IoT数据采集': 'IoT Data Collection',
  '智能决策': 'Smart Decisions',
  '可视化报告': 'Visual Reports',

  // 其他常见功能
  '实时协作': 'Real-time Collab',
  '三维建模': '3D Modeling',
  '快速建模': 'Fast Modeling',
  '参数化设计': 'Parametric Design',
  '全景图生成': 'Panorama',
  '视频制作': 'Video Creation',
  '动画制作': 'Animation',
  'VR漫游': 'VR Tour',
  '环境特效': 'Environment FX',
  '材质库': 'Material Library',
  'LiveSync同步': 'LiveSync',

  // 专业领域
  '剪力墙设计': 'Shear Wall',
  '构件截面设计': 'Section Design',
  '荷载布置': 'Load Layout',
  '结构计算': 'Structural Calc',
  '楼梯参数化设计': 'Stair Design',
  '场地分析': 'Site Analysis',
  '场地布局优化': 'Site Layout',
  '土方平衡': 'Earthwork',

  // 输出相关
  '工程出图': 'Engineering Output',
  '族库兼容': 'Family Library',
  '数据兼容': 'Data Compatible',
  'SDK开发': 'SDK Support',
  '国产化支持': 'Local Support',
  '云计算架构': 'Cloud Architecture',

  // 渲染相关
  '线稿转效果图': 'Line to Render',
  '草图渲染': 'Sketch Render',
  '线稿生成': 'Line Art Gen',
  '文生图': 'Text to Image',
  '草图转效果图': 'Sketch to Render',
  '图像编辑': 'Image Edit',
  '风格迁移': 'Style Transfer',
  '一键上色': 'Auto Color',
  '室内外设计': 'Interior/Exterior',
  '建筑渲染': 'Arch Rendering',
  '室内设计渲染': 'Interior Render',
  '东方美学': 'Oriental Style',
  '概念意向生成': 'Concept Gen',
  '效果图渲染': 'Render Output',

  // 文档相关
  '自动施工文档生成': 'Auto Doc Gen',
  '智能图纸识别': 'Smart Drawing ID',
  'BIM模型转换': 'BIM Convert',
  '技术方案编写': 'Tech Proposal',
  '施工方案审核': 'Method Review',
  '规范标准查询': 'Code Query',
  '专业知识问答': 'Expert Q&A',
  '自动化数据处理': 'Auto Data',
  '快速信息检索': 'Quick Search',
  '决策支持': 'Decision Support',
  '知识共享': 'Knowledge Share',
  '文档分析': 'Doc Analysis',
  '自动摘要': 'Auto Summary',
  '多语言对话': 'Multi-language',
  '流程图创作': 'Flowchart',
  '思维导图': 'Mind Map',

  // 施工机器人
  '喷涂机器人': 'Spray Robot',
  '铺贴机器人': 'Tile Robot',
  '机器人布局': 'Robot Layout',
  '自动化施工': 'Auto Construction',
  '精确定位': 'Precision Position',
  '减少返工': 'Reduce Rework',
  '现场打印': 'On-site Print',

  // 其他
  '目标检测': 'Object Detection',
  '图像分割': 'Image Seg',
  '实时处理': 'Real-time',
  '全专业审查': 'Full Review',
  '高准确率审查（超过95%）': '95%+ Accuracy',
  '智能识别CAD图纸': 'CAD Recognition',
  '智能识别CAD施工图含义': 'CAD Understanding',
  '自动审查规范强条': 'Auto Code Check',
  '支持定制开发': 'Custom Dev',
  'Transformer大模型': 'LLM',
  '逻辑推演': 'Logic Reasoning',
  '修改建议': 'Suggestions',
  '自动化审核': 'Auto Review',
  '物联网集成': 'IoT Integration',
  '图模对比': 'Drawing vs Model',
  '模型检查': 'Model Check',
  '配色检查': 'Color Check',
  '审查报告生成': 'Review Report',
  '算量规则检查': 'Quantity Rules',
  'Revit平台集成': 'Revit Platform',
  '多模态处理': 'Multimodal',
  '智能方案比选': 'Scheme Compare',
  '平面图生成': 'Plan Gen',
  '性能反馈': 'Performance FB',
  '设计优化': 'Design Opt',
  '空间规划': 'Space Planning',
  '模块化算法': 'Module Algo',
  '自动生成': 'Auto Gen',
  '平面图自动生成': 'Auto Plan Gen',
  '多种布局方案': 'Multi Layout',
  '4D-BIM联动': '4D-BIM',
  'AI生成式调度': 'AI Scheduling',
  '工程图纸自动识别': 'Drawing ID',
  '智能审查与错误检测': 'Smart Review',
  '三维模型重建': '3D Reconstruction',
  '场地可行性分析': 'Site Feasibility',
  '设计生成': 'Design Gen',
  '风险分析': 'Risk Analysis',
  'eCheck电子许可': 'eCheck',
  '智慧生产管理': 'Smart Production',
  '项目管理工具': 'Project Tools',
  '数字工厂集成': 'Digital Factory',
  '智慧工地监控': 'Site Monitoring',
  '计费管理': 'Billing Mgmt',
  '发票管理': 'Invoice Mgmt',
  '预算预测': 'Budget Forecast',
  '项目时间表': 'Project Schedule',
  '全链路设计': 'Full-chain Design',
  '监理': 'Supervision',
  '施工': 'Construction',
};

// 翻译分类
export function translateCategory(category: string, lang: string): string {
  if (lang !== 'en') return category;
  return CATEGORY_TRANSLATIONS[category] || category;
}

// 翻译特性
export function translateFeature(feature: string, lang: string): string {
  if (lang !== 'en') return feature;
  return FEATURE_TRANSLATIONS[feature] || feature;
}

// 批量翻译分类数组
export function translateCategories(categories: string[], lang: string): string[] {
  if (lang !== 'en') return categories;
  return categories.map(cat => CATEGORY_TRANSLATIONS[cat] || cat);
}

// 批量翻译特性数组
export function translateFeatures(features: string[], lang: string): string[] {
  if (lang !== 'en') return features;
  return features.map(feat => FEATURE_TRANSLATIONS[feat] || feat);
}

// Pricing 翻译
export const PRICING_TRANSLATIONS: Record<string, string> = {
  '免费': 'Free',
  'Freemium': 'Freemium',
  'Paid': 'Paid',
  '付费': 'Paid',
  'Trial': 'Trial',
};

export function translatePricing(pricing: string | undefined, lang: string): string {
  if (lang !== 'en' || !pricing) return pricing || '';
  return PRICING_TRANSLATIONS[pricing] || pricing;
}

// Categories UI 翻译
export const CATEGORIES_UI_TRANSLATIONS: Record<string, { zh: string; en: string }> = {
  title: { zh: '专业工具分类', en: 'Tool Categories' },
  subtitle: { zh: '按专业领域精准分类，快速找到最适合的工具', en: 'Browse by professional field to find the right tools quickly' },
  browseByField: { zh: '按专业领域浏览工具', en: 'Browse Tools by Field' },
  browseByFieldDesc: { zh: '我们将工具按照土木工程的不同专业领域进行分类，帮助您快速找到所需的专业工具', en: 'Tools organized by civil engineering disciplines to help you find what you need' },
  viewTools: { zh: '查看工具', en: 'View tools' },
  loading: { zh: '加载分类中...', en: 'Loading categories...' },
  reload: { zh: '重新加载', en: 'Reload' },
  noData: { zh: '暂无分类数据', en: 'No category data available' },
  defaultDescription: { zh: '专业工具分类', en: 'Professional tool category' },
};

// 分类描述翻译
export const CATEGORY_DESCRIPTION_TRANSLATIONS: Record<string, { zh: string; en: string }> = {
  '前期规划': {
    zh: '用地选址、交通预测、经济可行性等早期决策类 AI 工具。',
    en: 'Project planning and feasibility analysis tools'
  },
  '勘察测量': {
    zh: '无人机测绘、地质雷达、点云处理、地层生成等获取现场数据的 AI 工具。',
    en: 'Survey, mapping and geological analysis tools'
  },
  '方案设计': {
    zh: '建筑/桥梁/道路概念方案、草图生成与多目标比选的 AI 工具。',
    en: 'Architectural concept and scheme design tools'
  },
  '结构分析': {
    zh: '荷载计算、抗震性能评估、有限元快速建模与优化的 AI 工具。',
    en: 'Structural calculation and analysis software'
  },
  '施工图深化': {
    zh: 'BIM 自动出图、钢筋布置、节点详图与碰撞检查的 AI 工具。',
    en: 'Construction drawing and detailing tools'
  },
  '施工管理': {
    zh: '进度预测、安全监控、质量验收与资源调度的 AI 工具。',
    en: 'Construction site management and collaboration tools'
  },
  '运维监测': {
    zh: '结构健康监测、寿命预测、灾害预警与养护决策的 AI 工具。',
    en: 'Building operation and structural monitoring systems'
  },
};

// 获取 Categories UI 翻译
export function getCategoriesUIText(key: keyof typeof CATEGORIES_UI_TRANSLATIONS, lang: string): string {
  const item = CATEGORIES_UI_TRANSLATIONS[key];
  if (!item) return '';
  return lang === 'en' ? item.en : item.zh;
}

// 获取分类描述翻译
export function getCategoryDescription(categoryName: string, lang: string): string {
  const item = CATEGORY_DESCRIPTION_TRANSLATIONS[categoryName];
  if (!item) return '';
  return lang === 'en' ? item.en : item.zh;
}
