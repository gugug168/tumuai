/**
 * ScreenshotGallery 组件 - 截图画廊
 *
 * 从 ToolDetailPage 提取的截图相关逻辑
 * 功能：
 * - 截图区域解析和分组显示
 * - 缩略图网格
 * - 响应式图片加载
 */

import React, { useMemo } from 'react';
import { Check, Maximize2 } from 'lucide-react';
import OptimizedImage from './OptimizedImage';
import {
  type ScreenshotRegion,
  type GalleryImage,
  REGION_LABELS,
  REGION_ICONS,
  parseScreenshotRegion,
  getScreenshotLabel,
  getScreenshotIcon,
  groupScreenshotsByRegion
} from './screenshot-utils';

interface ScreenshotGalleryProps {
  images: GalleryImage[];
  selectedImage: number;
  onImageSelect: (index: number) => void;
  onOpenFullscreen: () => void;
  toolName: string;
  fallbackLogoUrl?: string;
}

/**
 * 缩略图组件
 */
interface ThumbnailProps {
  image: GalleryImage;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  fallbackLogoUrl?: string;
}

const Thumbnail: React.FC<ThumbnailProps> = ({ image, index, isSelected, onSelect, fallbackLogoUrl }) => {
  const regionLabel = getScreenshotLabel(image.src);
  const regionIcon = getScreenshotIcon(image.src);

  return (
    <button
      onClick={onSelect}
      className={`group relative aspect-[4/3] overflow-hidden rounded-lg border-2 transition-all duration-200 ${
        isSelected
          ? 'border-blue-500 shadow-md ring-2 ring-blue-200 scale-105'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm hover:scale-102'
      }`}
    >
      <OptimizedImage
        src={image.src}
        alt={`缩略图 ${index + 1}`}
        className="w-full h-full"
        objectFit="cover"
        objectPosition="50% 50%"
        background
        srcsetWidths={[120, 240]}
        sizes="(max-width: 640px) 20vw, 120px"
        fallback={
          fallbackLogoUrl ? (
            <img
              src={fallbackLogoUrl}
              alt="缩略图"
              className="w-full h-full object-contain p-2"
            />
          ) : undefined
        }
      />

      {/* 区域标签覆盖层 */}
      {regionLabel && (
        <div
          className={`absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-[10px] font-medium text-center leading-tight ${
            isSelected
              ? 'bg-blue-600 text-white'
              : 'bg-gray-900/70 text-white group-hover:bg-gray-900/80'
          }`}
        >
          <span className="mr-0.5">{regionIcon}</span>
          {regionLabel}
        </div>
      )}

      {/* 选中指示器 */}
      {isSelected && (
        <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-white" />
        </div>
      )}

      {/* 悬停边框高亮 */}
      <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-300/30 rounded-lg pointer-events-none transition-colors" />
    </button>
  );
};

/**
 * 主图片组件
 */
interface MainImageProps {
  image: GalleryImage;
  toolName: string;
  index: number;
  fallbackLogoUrl?: string;
  onClick: () => void;
}

const MainImage: React.FC<MainImageProps> = ({ image, toolName, index, fallbackLogoUrl, onClick }) => {
  return (
    <div
      className="relative bg-gray-100 rounded-lg overflow-hidden cursor-pointer group"
      style={{ height: '400px' }}
      onClick={onClick}
      title="点击全屏查看"
    >
      {/* 背景骨架屏动画 */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent animate-pulse" />
        </div>
      </div>

      {/* 实际图片 */}
      <div className="absolute inset-0">
        <OptimizedImage
          key={index}
          src={image.src}
          alt={`${toolName} 截图 ${index + 1}`}
          className="w-full h-full"
          objectFit={image.objectFit || 'contain'}
          objectPosition={image.objectPosition || '50% 50%'}
          srcsetWidths={[800, 1200, 1600]}
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 70vw, 60vw"
          priority={index === 0}
          lazyLoad={index !== 0}
          fallback={
            fallbackLogoUrl ? (
              <img src={fallbackLogoUrl} alt={toolName} className="w-full h-full object-contain p-6" />
            ) : undefined
          }
        />
      </div>

      {/* 图片加载指示器 */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
        <span className="px-2 py-1 bg-black/50 text-white text-xs rounded backdrop-blur-sm">
          {image.region ? `${REGION_ICONS[image.region]} ${REGION_LABELS[image.region]}` : `截图 ${index + 1}`}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-all hover:scale-105"
          title="全屏查看 (F)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* 悬停时的全屏提示 */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white px-4 py-2 rounded-lg backdrop-blur-sm flex items-center space-x-2">
          <Maximize2 className="w-4 h-4" />
          <span className="text-sm">点击全屏查看</span>
        </div>
      </div>
    </div>
  );
};

/**
 * 截图画廊组件
 */
const ScreenshotGallery: React.FC<ScreenshotGalleryProps> = ({
  images,
  selectedImage,
  onImageSelect,
  onOpenFullscreen,
  toolName,
  fallbackLogoUrl
}) => {
  const currentImage = images[selectedImage];

  // 检查是否有分组的截图
  const hasGroupedScreenshots = useMemo(() => {
    return images.some(img => img.region);
  }, [images]);

  // 按区域分组的截图
  const groupedImages = useMemo(() => {
    return groupScreenshotsByRegion(images);
  }, [images]);

  return (
    <div className="space-y-4">
      {/* 主图片容器 */}
      {currentImage && (
        <MainImage
          image={currentImage}
          toolName={toolName}
          index={selectedImage}
          fallbackLogoUrl={fallbackLogoUrl}
          onClick={onOpenFullscreen}
        />
      )}

      {/* 缩略图区域 */}
      <div className="space-y-4">
        {hasGroupedScreenshots ? (
          // 有区域信息时，按区域分组显示
          Array.from(groupedImages.entries())
            .filter(([, imgs]) => imgs.length > 0)
            .map(([region, imgs]) => (
              <div key={region} className="space-y-2">
                {/* 区域标题 */}
                <div className="flex items-center text-sm font-medium text-gray-600">
                  <span className="mr-1.5">{region !== 'other' ? REGION_ICONS[region] : '📷'}</span>
                  <span>{region !== 'other' ? REGION_LABELS[region] : '其他截图'}</span>
                  <span className="ml-2 text-xs text-gray-400">({imgs.length})</span>
                </div>

                {/* 缩略图网格 */}
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {imgs.map((image) => {
                    const globalIndex = images.indexOf(image);
                    return (
                      <Thumbnail
                        key={globalIndex}
                        image={image}
                        index={globalIndex}
                        isSelected={selectedImage === globalIndex}
                        onSelect={() => onImageSelect(globalIndex)}
                        fallbackLogoUrl={fallbackLogoUrl}
                      />
                    );
                  })}
                </div>
              </div>
            ))
        ) : (
          // 无区域信息时，显示为网格布局
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {images.map((image, index) => (
              <Thumbnail
                key={index}
                image={image}
                index={index}
                isSelected={selectedImage === index}
                onSelect={() => onImageSelect(index)}
                fallbackLogoUrl={fallbackLogoUrl}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreenshotGallery;
