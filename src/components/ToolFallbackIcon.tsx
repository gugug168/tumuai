import React from 'react';

// Phase 5优化: 从 ToolCard 提取的分类颜色映射（常量，所有实例共享）
export const CATEGORY_COLORS: Record<string, string> = {
  'AI工具': '#6366f1',
  '结构设计': '#059669',
  'BIM建模': '#0891b2',
  '工程计算': '#dc2626',
  '项目管理': '#9333ea',
  '数据分析': '#ea580c',
  '建筑设计': '#16a34a',
  '施工管理': '#0f172a',
  '计算机视觉': '#0891b2',
  '目标检测': '#0891b2',
  '自然语言处理': '#6366f1',
  '文档智能': '#6366f1',
  '边缘智能': '#0891b2',
  '生成式人工智能': '#6366f1',
  '工业自动化': '#0f172a',
  '工程领域人工智能': '#6366f1',
  '施工领域人工智能': '#0f172a',
  '人工智能结构设计': '#6366f1',
  'Computer Vision': '#0891b2',
  'Object Detection': '#0891b2',
  'Natural Language Processing': '#6366f1',
  'Document AI': '#6366f1',
  'Edge AI': '#0891b2',
  'Generative AI': '#6366f1',
  'Industrial Automation': '#0f172a',
  'AI for Engineering': '#6366f1',
  'AI in Construction': '#0f172a',
  'AI结构设计': '#6366f1',
};

const DEFAULT_COLOR = '#6b7280';

export function getCategoryColor(categories?: string[]): string {
  const primaryCategory = categories?.[0] || '';
  if (CATEGORY_COLORS[primaryCategory]) {
    return CATEGORY_COLORS[primaryCategory];
  }
  for (const [key, c] of Object.entries(CATEGORY_COLORS)) {
    if (primaryCategory.includes(key) || key.includes(primaryCategory)) {
      return c;
    }
  }
  return DEFAULT_COLOR;
}

export function getInitials(name: string): string {
  if (!name) return 'T';
  const cleanName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, ' ');
  const words = cleanName.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words.slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase();
}

interface ToolFallbackIconProps {
  name: string;
  categories?: string[];
}

const ToolFallbackIcon: React.FC<ToolFallbackIconProps> = React.memo(({ name, categories }) => {
  const color = React.useMemo(() => getCategoryColor(categories), [categories]);
  const initials = React.useMemo(() => getInitials(name), [name]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 80 80"
      className="w-full h-full"
      style={{ maxWidth: '80px', maxHeight: '80px' }}
    >
      <rect width="80" height="80" fill={color} rx="12"/>
      <text
        x="40"
        y="40"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
        fontSize="28"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
      >
        {initials}
      </text>
    </svg>
  );
});

ToolFallbackIcon.displayName = 'ToolFallbackIcon';

export default ToolFallbackIcon;
