/**
 * ScreenshotViewer 组件 - 全屏截图查看器
 *
 * 从 ToolDetailPage 提取的全屏查看器逻辑
 * 功能：
 * - 全屏图片查看
 * - 键盘导航（方向键、ESC、+/-、0）
 * - 缩放控制
 * - 底部缩略图栏
 */

import React, { useCallback, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import OptimizedImage from './OptimizedImage';
import type { GalleryImage } from './ScreenshotGallery';
import { REGION_LABELS, REGION_ICONS } from './screenshot-utils';
import type { ScreenshotRegion } from './screenshot-utils';

interface ScreenshotViewerProps {
  isOpen: boolean;
  images: GalleryImage[];
  selectedImage: number;
  toolName: string;
  fallbackLogoUrl?: string;
  onClose: () => void;
  onSelectImage: (index: number) => void;
}

/**
 * 全屏截图查看器组件
 */
const ScreenshotViewer: React.FC<ScreenshotViewerProps> = ({
  isOpen,
  images,
  selectedImage,
  toolName,
  fallbackLogoUrl,
  onClose,
  onSelectImage
}) => {
  const [imageScale, setImageScale] = React.useState(1);

  // 重置缩放状态
  const resetImageState = useCallback(() => {
    setImageScale(1);
  }, []);

  // 当打开查看器时重置状态
  useEffect(() => {
    if (isOpen) {
      resetImageState();
    }
  }, [isOpen, resetImageState]);

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          setImageScale(1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onSelectImage(Math.max(0, selectedImage - 1));
          setImageScale(1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          onSelectImage(Math.min(images.length - 1, selectedImage + 1));
          setImageScale(1);
          break;
        case '+':
        case '=':
          e.preventDefault();
          setImageScale(prev => Math.min(3, prev + 0.25));
          break;
        case '-':
          e.preventDefault();
          setImageScale(prev => Math.max(0.5, prev - 0.25));
          break;
        case '0':
          e.preventDefault();
          setImageScale(1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedImage, images.length, onSelectImage, onClose]);

  // 缩放控制
  const zoomIn = useCallback(() => {
    setImageScale(prev => Math.min(3, prev + 0.25));
  }, []);

  const zoomOut = useCallback(() => {
    setImageScale(prev => Math.max(0.5, prev - 0.25));
  }, []);

  const resetZoom = useCallback(() => {
    setImageScale(1);
  }, []);

  // 导航控制
  const goToPrevious = useCallback(() => {
    onSelectImage(Math.max(0, selectedImage - 1));
    setImageScale(1);
  }, [selectedImage, onSelectImage]);

  const goToNext = useCallback(() => {
    onSelectImage(Math.min(images.length - 1, selectedImage + 1));
    setImageScale(1);
  }, [selectedImage, images.length, onSelectImage]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[selectedImage];

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm border-b border-white/10">
        {/* 区域信息 */}
        <div className="flex items-center text-white">
          <span className="text-lg font-medium">{toolName}</span>
          <span className="mx-3 text-white/30">|</span>
          <div className="flex items-center text-sm">
            <span className="mr-1.5">
              {currentImage?.region
                ? REGION_ICONS[currentImage.region as ScreenshotRegion]
                : '📷'}
            </span>
            <span>
              {currentImage?.region
                ? REGION_LABELS[currentImage.region as ScreenshotRegion]
                : `截图 ${selectedImage + 1}`}
            </span>
          </div>
          <span className="ml-3 text-sm text-white/50">
            {selectedImage + 1} / {images.length}
          </span>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center space-x-2">
          {/* 缩放控制 */}
          <button
            onClick={zoomOut}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="缩小 (-)"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-white/70 text-sm min-w-[50px] text-center">
            {Math.round(imageScale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="放大 (+)"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={resetZoom}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="重置 (0)"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-white/20 mx-2" />

          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="关闭 (ESC)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* 主图片区域 */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {/* 上一张按钮 */}
        <button
          onClick={goToPrevious}
          disabled={selectedImage === 0}
          className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full transition-all ${
            selectedImage === 0
              ? 'bg-white/5 text-white/20 cursor-not-allowed'
              : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
          }`}
          title="上一张 (←)"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* 图片容器 */}
        <div
          className="relative flex items-center justify-center"
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        >
          <OptimizedImage
            key={selectedImage}
            src={currentImage?.src || ''}
            alt={`${toolName} 截图 ${selectedImage + 1}`}
            className="max-w-full max-h-full transition-transform duration-200"
            objectFit="contain"
            style={{
              transform: `scale(${imageScale})`,
              transformOrigin: 'center center'
            }}
            srcsetWidths={[1200, 1600, 2400]}
            sizes="100vw"
            priority
            lazyLoad={false}
            fallback={
              fallbackLogoUrl ? (
                <img
                  src={fallbackLogoUrl}
                  alt={toolName}
                  className="max-w-full max-h-full object-contain"
                />
              ) : undefined
            }
          />
        </div>

        {/* 下一张按钮 */}
        <button
          onClick={goToNext}
          disabled={selectedImage === images.length - 1}
          className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full transition-all ${
            selectedImage === images.length - 1
              ? 'bg-white/5 text-white/20 cursor-not-allowed'
              : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
          }`}
          title="下一张 (→)"
        >
          <ChevronRightIcon className="w-6 h-6" />
        </button>
      </div>

      {/* 底部缩略图栏 */}
      <div className="px-4 py-3 bg-black/50 backdrop-blur-sm border-t border-white/10">
        <div className="flex justify-center space-x-2 overflow-x-auto pb-2 scrollbar-hide">
          {images.map((image, index) => {
            const isSelected = selectedImage === index;
            return (
              <button
                key={index}
                onClick={() => {
                  onSelectImage(index);
                  setImageScale(1);
                }}
                className={`flex-shrink-0 w-20 h-14 rounded overflow-hidden border-2 transition-all ${
                  isSelected
                    ? 'border-blue-500 shadow-lg shadow-blue-500/30'
                    : 'border-white/20 hover:border-white/40'
                }`}
              >
                <OptimizedImage
                  src={image.src}
                  alt={`缩略图 ${index + 1}`}
                  className="w-full h-full"
                  objectFit="cover"
                  background
                  fallback={
                    fallbackLogoUrl ? (
                      <img
                        src={fallbackLogoUrl}
                        alt={toolName}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : undefined
                  }
                />
              </button>
            );
          })}
        </div>

        {/* 快捷键提示 */}
        <div className="text-center text-xs text-white/40 mt-2">
          快捷键: ← → 切换图片 | + - 缩放 | 0 重置 | ESC 退出
        </div>
      </div>
    </div>
  );
};

export default ScreenshotViewer;
