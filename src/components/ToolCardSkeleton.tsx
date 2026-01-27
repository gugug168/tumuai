import React from 'react';

interface ToolCardSkeletonProps {
  viewMode?: 'grid' | 'list';
}

/**
 * 工具卡片骨架屏组件
 * 用于在工具加载时显示占位符，提升用户体验
 */
const ToolCardSkeleton = React.memo(({ viewMode = 'grid' }: ToolCardSkeletonProps) => {
  if (viewMode === 'list') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center space-x-4">
        {/* Logo骨架 */}
        <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse"></div>

        {/* 内容骨架 */}
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 rounded w-1/3 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse"></div>
        </div>

        {/* 操作区骨架 */}
        <div className="flex items-center space-x-3">
          <div className="w-16 h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
          <div className="w-16 h-8 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  // Grid view skeleton
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* 图片骨架 */}
      <div className="w-full h-40 bg-gray-200 animate-pulse"></div>

      {/* 内容骨架 */}
      <div className="p-4 space-y-3">
        {/* 标题骨架 */}
        <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse"></div>

        {/* 描述骨架 */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
        </div>

        {/* 标签骨架 */}
        <div className="flex flex-wrap gap-2">
          <div className="h-6 bg-gray-200 rounded w-16 animate-pulse"></div>
          <div className="h-6 bg-gray-200 rounded w-20 animate-pulse"></div>
          <div className="h-6 bg-gray-200 rounded w-14 animate-pulse"></div>
        </div>

        {/* 统计骨架 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
          </div>
          <div className="h-4 bg-gray-200 rounded w-10 animate-pulse"></div>
        </div>

        {/* 按钮骨架 */}
        <div className="h-10 bg-gray-200 rounded-lg animate-pulse"></div>
      </div>
    </div>
  );
});

ToolCardSkeleton.displayName = 'ToolCardSkeleton';

export default ToolCardSkeleton;
