import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  ExternalLink,
  Heart,
  Star,
  ArrowLeft,
  Eye,
  Calendar,
  Tag,
  Home,
  ChevronRight,
  Check
} from 'lucide-react';
import { addToFavorites, removeFromFavorites, isFavorited, addToolReview, getToolReviews } from '../lib/community';
import { getToolById, incrementToolViews, getRelatedTools } from '../lib/supabase';
import { generateInitialLogo, isValidHighQualityLogoUrl } from '../lib/logoUtils';
import OptimizedImage from '../components/OptimizedImage';
import { useToast, createToastHelpers } from '../components/Toast';
import ScreenshotGallery, { type GalleryImage } from '../components/ScreenshotGallery';
import ScreenshotViewer from '../components/ScreenshotViewer';
import { parseScreenshotRegion, getRegionOrder } from '../components/screenshot-utils';
import type { Tool } from '../types/index';

interface Review {
  id: number;
  user: string;
  avatar?: string;
  rating: number;
  date: string;
  comment: string;
}

const ToolDetailPage = () => {
  const { toolId } = useParams();
  const location = useLocation();
  const toolIdAsString = toolId || '';
  const { showToast } = useToast();
  const toast = createToastHelpers(showToast);
  const [selectedImage, setSelectedImage] = useState(0);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [isFavoritedTool, setIsFavoritedTool] = useState(false);
  const [loadingFavorite, setLoadingFavorite] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // 截图查看器状态
  const [isFullscreenViewer, setIsFullscreenViewer] = useState(false);
  const [tool, setTool] = useState<Tool | null>(() => {
    const state = location.state as null | { tool?: Partial<Tool> };
    const preloaded = state?.tool;
    return preloaded && preloaded.id === toolIdAsString ? (preloaded as Tool) : null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // If we navigated here from a list, we can reuse the already-fetched tool object
  // to avoid a blank full-screen loader while the detail query runs.
  useEffect(() => {
    const state = location.state as null | { tool?: Partial<Tool> };
    const preloaded = state?.tool;

    if (preloaded && preloaded.id === toolIdAsString) {
      setTool(preloaded as Tool);
      setError(null);
      return;
    }

    // No preloaded data for this toolId; clear stale tool to avoid showing the previous tool briefly.
    setTool(null);
  }, [location.state, toolIdAsString]);

  // 相关工具推荐数据（动态从API获取）
  interface RelatedTool {
    id: string;
    name: string;
    category: string;
    description: string;
    logo: string;
    rating: number;
  }
  const [relatedTools, setRelatedTools] = useState<RelatedTool[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(true);

  // 使用useMemo缓存相关工具的请求，防止重复调用
  const loadRelatedTools = useCallback(async (currentCategory: string, currentToolId: string) => {
    try {
      setLoadingRelated(true);
      // 使用专门的相关工具API，只获取3个工具，而不是全部100个
      const relatedToolsData = await getRelatedTools(currentCategory, currentToolId, 3);

      // 映射为组件需要的格式
      const formattedTools = relatedToolsData.map(tool => ({
        id: tool.id,
        name: tool.name,
        category: tool.categories[0] || currentCategory,
        description: tool.tagline,
        logo: tool.logo_url || generateInitialLogo(tool.name, tool.categories || []),
        rating: tool.rating || 0
      }));

      setRelatedTools(formattedTools);
    } catch (error) {
      console.error('获取相关工具失败:', error);
      setRelatedTools([]);
    } finally {
      setLoadingRelated(false);
    }
  }, []);
  
  // 定义所有callback函数在useEffect之前
  const loadToolData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔍 获取工具详情:', toolIdAsString);
      
      const toolData = await getToolById(toolIdAsString);
      
      if (toolData) {
        setTool(toolData);
        console.log('✅ 工具详情获取成功:', toolData.name);
      } else {
        setError('工具未找到');
        console.log('❌ 工具未找到:', toolIdAsString);
      }
    } catch (err) {
      console.error('❌ 获取工具详情失败:', err);
      setError('获取工具详情失败');
    } finally {
      setLoading(false);
    }
  }, [toolIdAsString]);

  const checkFavoriteStatus = useCallback(async () => {
    try {
      const favorited = await isFavorited(toolIdAsString);
      setIsFavoritedTool(favorited);
    } catch (error) {
      console.error('检查收藏状态失败:', error);
    }
  }, [toolIdAsString]);

  const loadReviews = useCallback(async () => {
    try {
      setLoadingReviews(true);
      const reviewsData = await getToolReviews(toolIdAsString);
      setReviews(reviewsData || []);
    } catch (error) {
      console.error('加载评论失败:', error);
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  }, [toolIdAsString]);

  // Reset gallery state when navigating between tools within SPA.
  useEffect(() => {
    setSelectedImage(0);
  }, [toolIdAsString]);

  const fallbackLogoDataUrl = useMemo(() => {
    if (!tool) return '';
    return generateInitialLogo(tool.name, tool.categories || []);
  }, [tool]);

  const safePrimaryLogoUrl = useMemo(() => {
    if (!tool?.logo_url) return '';
    // 使用共享工具函数过滤低质量 logo URL
    return isValidHighQualityLogoUrl(tool.logo_url) ? tool.logo_url : '';
  }, [tool]);

  // 推断的存储截图 URL（用于没有截图数据时的后备）
  const inferredStorageScreenshotUrl = useMemo(() => {
    if (!tool?.id) return '';
    const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
    if (!base) return '';
    return `${base}/storage/v1/object/public/tool-screenshots/tools/${tool.id}/fullpage.webp`;
  }, [tool?.id]);

  const storedScreenshotUrls = useMemo(() => {
    const raw = tool?.screenshots as string[] | undefined;
    let list = Array.isArray(raw)
      ? raw.filter((u: unknown): u is string => typeof u === 'string' && u.trim().length > 0)
      : [];

    // 如果数据库没有截图数据，使用推断的 URL 作为后备
    if (list.length === 0 && inferredStorageScreenshotUrl) {
      list = [inferredStorageScreenshotUrl];
    }

    return Array.from(new Set(list)).slice(0, 8);
  }, [tool, inferredStorageScreenshotUrl]);

  const websiteScreenshotUrl = useMemo(() => {
    const website = tool?.website_url || '';
    if (!website) return '';

    try {
      const parsed = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
      // Avoid query/hash interfering with thum.io path parsing, but keep pathname for tools
      // whose canonical landing page isn't at `/`.
      const pathname = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
      const target = `${parsed.origin}${pathname}`;
      return `https://image.thum.io/get/fullpage/noanimate/width/1200/${target}`;
    } catch {
      return '';
    }
  }, [tool]);

  const galleryImages = useMemo<GalleryImage[]>(() => {
    // Prefer stored screenshots (Supabase Storage) to avoid slow third-party render on every view.
    if (storedScreenshotUrls.length >= 2) {
      const images = storedScreenshotUrls.map((src) => {
        const region = parseScreenshotRegion(src);
        return {
          src,
          objectFit: 'cover',
          objectPosition: '50% 50%',
          region: region || undefined
        };
      });

      // 按区域排序
      return images.sort((a, b) => {
        const orderA = getRegionOrder(a.region || null);
        const orderB = getRegionOrder(b.region || null);
        return orderA - orderB;
      });
    }

    const baseScreenshotUrl = storedScreenshotUrls[0] || websiteScreenshotUrl;
    if (baseScreenshotUrl) {
      // Use the same full-page screenshot and show different "slices" via object-position.
      // This works even when the website is very long.
      const positions = ['50% 0%', '50% 33%', '50% 66%', '50% 100%'];
      return positions.map((pos) => ({
        src: baseScreenshotUrl,
        objectFit: 'cover',
        objectPosition: pos
      }));
    }

    const fallback = safePrimaryLogoUrl || fallbackLogoDataUrl;
    return fallback ? [{ src: fallback, objectFit: 'contain', objectPosition: '50% 50%' }] : [];
  }, [storedScreenshotUrls, websiteScreenshotUrl, safePrimaryLogoUrl, fallbackLogoDataUrl]);

  // 将数据库工具数据适配为组件需要的格式
  const adaptedTool = useMemo(() => tool ? {
    id: tool.id,
    name: tool.name,
    logo: safePrimaryLogoUrl || fallbackLogoDataUrl,
    category: tool.categories?.[0] || '工具',
    website: tool.website_url || '',
    shortDescription: tool.tagline,
    detailedDescription: tool.description || tool.tagline,
    images: galleryImages,
    videoUrl: '',
    features: tool.features || [],
    pricing: [
      {
        plan: tool.pricing === 'Free' ? '免费版' : tool.pricing === 'Freemium' ? '免费版' : '基础版',
        price: tool.pricing === 'Free' ? '¥0' : '联系我们',
        period: tool.pricing === 'Free' ? '永久' : '月',
        features: ['基础功能', '标准支持']
      }
    ],
    rating: tool.rating || 0,
    reviews: tool.review_count || 0,
    views: tool.views || 0,
    tags: tool.categories || [],
    addedDate: tool.date_added ? tool.date_added.split('T')[0] : '',
    lastUpdated: tool.updated_at ? tool.updated_at.split('T')[0] : ''
  } : null, [tool, safePrimaryLogoUrl, fallbackLogoDataUrl, galleryImages]);

  const pricingLabel = useMemo(() => {
    const pricing = tool?.pricing;
    if (pricing === 'Free') return '免费';
    if (pricing === 'Freemium') return '免费增值';
    if (pricing === 'Trial') return '可试用';
    if (pricing === 'Paid') return '付费';
    return '';
  }, [tool?.pricing]);

  const normalizedWebsiteUrl = useMemo(() => {
    const raw = adaptedTool?.website?.trim();
    if (!raw) return '';
    try {
      return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).toString();
    } catch {
      return '';
    }
  }, [adaptedTool?.website]);

  const hasDetailFields = useMemo(() => {
    if (!tool || tool.id !== toolIdAsString) return false;
    // When navigating from a list, the tool object can be partial; only skip the detail query
    // if we already have the key fields the page needs.
    return 'website_url' in tool && 'description' in tool && 'updated_at' in tool;
  }, [tool, toolIdAsString]);
  
  useEffect(() => {
    if (!toolIdAsString) return;

    if (hasDetailFields) {
      // Ensure we don't keep showing a loading indicator when we already have enough data.
      setLoading(false);
      setError(null);
      return;
    }

    loadToolData();
  }, [toolIdAsString, hasDetailFields, loadToolData]);

  useEffect(() => {
    if (tool) {
      checkFavoriteStatus();
      loadReviews();
      // 增加浏览量
      incrementToolViews(toolIdAsString);
    }
  }, [tool, toolIdAsString, checkFavoriteStatus, loadReviews]);

  useEffect(() => {
    if (adaptedTool) {
      loadRelatedTools(adaptedTool.category, adaptedTool.id);
    }
  }, [adaptedTool, loadRelatedTools]);

  // 键盘导航 - 普通模式下方向键切换截图，F 键进入全屏
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 全屏模式下由 ScreenshotViewer 组件处理
      if (isFullscreenViewer) return;

      // 普通模式下的快捷键
      if (e.key === 'ArrowLeft') {
        setSelectedImage(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setSelectedImage(prev => Math.min(adaptedTool?.images.length ? adaptedTool.images.length - 1 : 0, prev + 1));
      } else if (e.key === 'f' || e.key === 'F') {
        // F 键进入全屏查看
        if (adaptedTool?.images.length) {
          setIsFullscreenViewer(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenViewer, adaptedTool]);

  if (loading && !tool) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载工具详情中...</p>
        </div>
      </div>
    );
  }

  if (error || !tool || !adaptedTool) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">工具未找到</h2>
          <p className="text-gray-600 mb-4">
            {error || '抱歉，您访问的工具不存在或已被删除。'}
          </p>
          <Link to="/tools" className="text-blue-600 hover:text-blue-700">
            返回工具中心
          </Link>
        </div>
      </div>
    );
  }

  const handleToggleFavorite = async () => {
    try {
      setLoadingFavorite(true);
      if (isFavoritedTool) {
        await removeFromFavorites(toolIdAsString);
        setIsFavoritedTool(false);
      } else {
        await addToFavorites(toolIdAsString);
        setIsFavoritedTool(true);
      }
    } catch (error) {
      console.error('收藏操作失败:', error);
      toast.error('操作失败', '请稍后重试');
    } finally {
      setLoadingFavorite(false);
    }
  };

  const handleCopyWebsiteUrl = async () => {
    if (!normalizedWebsiteUrl) {
      toast.error('复制失败', '未找到可复制的官网链接');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(normalizedWebsiteUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = normalizedWebsiteUrl;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast.success('已复制链接', '可粘贴到浏览器或分享给他人');
    } catch (error) {
      console.error('复制官网链接失败:', error);
      toast.error('复制失败', '请稍后重试');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addToolReview(toolIdAsString, {
        rating: newReview.rating,
        content: newReview.comment
      });
      setNewReview({ rating: 5, comment: '' });
      await loadReviews();
      toast.success('提交成功', '评论已发布');
    } catch (error) {
      console.error('评论提交失败:', error);
      toast.error('提交失败', '评论提交失败，请稍后重试');
    }
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
            <span className="text-gray-900 font-medium">{adaptedTool.name}</span>
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
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0">
              <OptimizedImage
                src={adaptedTool.logo}
                alt={adaptedTool.name}
                className="w-full h-full"
                priority
                lazyLoad={false}
                objectFit="contain"
                background
                fallback={
                  fallbackLogoDataUrl
                    ? (
                        <img
                          src={fallbackLogoDataUrl}
                          alt={adaptedTool.name}
                          className="w-full h-full object-contain p-2"
                        />
                      )
                    : undefined
                }
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{adaptedTool.name}</h1>
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                  {adaptedTool.category}
                </span>
              </div>
              <p className="text-lg text-gray-600 mb-4">{adaptedTool.shortDescription}</p>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.round(adaptedTool.rating)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="ml-1">{adaptedTool.rating} ({adaptedTool.reviews} 评价)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Eye className="w-4 h-4" />
                  <span>{adaptedTool.views.toLocaleString()} 次浏览</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>更新于 {adaptedTool.lastUpdated}</span>
                </div>
              </div>
            </div>
            {/* Mobile/Tablet CTA */}
            <div className="flex flex-col space-y-3 lg:hidden">
              {normalizedWebsiteUrl ? (
                <a
                  href={normalizedWebsiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center"
                >
                  访问官网
                  <ExternalLink className="ml-2 w-4 h-4" />
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="bg-gray-200 text-gray-600 px-6 py-3 rounded-lg font-semibold flex items-center justify-center cursor-not-allowed"
                >
                  官网加载中...
                </button>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCopyWebsiteUrl}
                  disabled={!normalizedWebsiteUrl}
                  className={`px-4 py-3 rounded-lg font-semibold flex items-center justify-center transition-colors ${
                    normalizedWebsiteUrl ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  复制链接
                </button>
                <button
                  onClick={handleToggleFavorite}
                  disabled={loadingFavorite}
                  className={`px-4 py-3 rounded-lg font-semibold flex items-center justify-center transition-colors ${
                    isFavoritedTool
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } ${loadingFavorite ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Heart
                    className={`mr-2 w-4 h-4 ${isFavoritedTool ? 'fill-current text-red-500' : ''}`}
                  />
                  {loadingFavorite ? '处理中...' : isFavoritedTool ? '已收藏' : '收藏'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧主要内容 */}
          <div className="lg:col-span-2 space-y-8">
            {/* 图片/视频画廊 */}
            <div id="screenshots" className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 scroll-mt-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">产品截图</h2>
              </div>
              <ScreenshotGallery
                images={adaptedTool.images}
                selectedImage={selectedImage}
                onImageSelect={setSelectedImage}
                onOpenFullscreen={() => setIsFullscreenViewer(true)}
                toolName={adaptedTool.name}
                fallbackLogoUrl={fallbackLogoDataUrl}
              />
            </div>

            {/* 详细介绍 */}
            <div id="about" className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 scroll-mt-24">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">详细介绍</h2>
              <div className="prose prose-lg max-w-none text-gray-800 leading-relaxed">
                {adaptedTool.detailedDescription.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="mb-4 text-gray-800">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            {/* 用户评论区 */}
            <div id="reviews" className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 scroll-mt-24">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">用户评价</h2>
              
              {/* 评论统计 */}
              <div className="flex items-center space-x-6 mb-8 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{adaptedTool.rating}</div>
                  <div className="flex items-center justify-center space-x-1 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.floor(adaptedTool.rating)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-sm text-gray-500">{adaptedTool.reviews} 条评价</div>
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
                    name="comment"
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
              {loadingReviews ? (
                <div className="text-center py-8 text-gray-500">加载评论中...</div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-8 text-gray-500">暂无评论，快来发表第一条评论吧！</div>
              ) : (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                      <div className="flex items-start space-x-4">
                        <OptimizedImage
                          src={review.user_profiles?.avatar_url || 'https://images.pexels.com/photos/3785079/pexels-photo-3785079.jpeg?auto=compress&cs=tinysrgb&w=50'}
                          alt={review.user_profiles?.full_name || '用户'}
                          className="w-10 h-10 rounded-full"
                          objectFit="cover"
                          background
                          fallback={
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                              {(review.user_profiles?.full_name || review.user_profiles?.username || '用户').slice(0, 1)}
                            </div>
                          }
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-semibold text-gray-900">{review.user_profiles?.full_name || '匿名用户'}</h4>
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
                            <span className="text-sm text-gray-500">{new Date(review.created_at).toLocaleDateString('zh-CN')}</span>
                          </div>
                          <p className="text-gray-700 leading-relaxed">{review.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右侧边栏 */}
          <div className="space-y-8">
            {/* Desktop sticky CTA + quick nav */}
            <div className="hidden lg:block sticky top-24 space-y-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">开始使用</h3>
                  {pricingLabel && (
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-medium">
                      {pricingLabel}
                    </span>
                  )}
                </div>

                {normalizedWebsiteUrl ? (
                  <a
                    href={normalizedWebsiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center"
                  >
                    访问官网
                    <ExternalLink className="ml-2 w-4 h-4" />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="bg-gray-200 text-gray-600 px-4 py-3 rounded-lg font-semibold flex items-center justify-center cursor-not-allowed w-full"
                  >
                    暂无官网链接
                  </button>
                )}

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <button
                    type="button"
                    onClick={handleCopyWebsiteUrl}
                    disabled={!normalizedWebsiteUrl}
                    className={`px-4 py-3 rounded-lg font-semibold flex items-center justify-center transition-colors ${
                      normalizedWebsiteUrl
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    复制链接
                  </button>
                  <button
                    onClick={handleToggleFavorite}
                    disabled={loadingFavorite}
                    className={`px-4 py-3 rounded-lg font-semibold flex items-center justify-center transition-colors ${
                      isFavoritedTool ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${loadingFavorite ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Heart className={`mr-2 w-4 h-4 ${isFavoritedTool ? 'fill-current text-red-500' : ''}`} />
                    {loadingFavorite ? '处理中...' : isFavoritedTool ? '已收藏' : '收藏'}
                  </button>
                </div>

                {normalizedWebsiteUrl && (
                  <p className="mt-3 text-xs text-gray-500 break-all">{normalizedWebsiteUrl}</p>
                )}
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">页面导航</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { href: '#screenshots', label: '截图' },
                    { href: '#tags', label: '功能' },
                    { href: '#about', label: '介绍' },
                    { href: '#pricing', label: '定价' },
                    { href: '#reviews', label: '评价' }
                  ].map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* 定价信息 */}
            <div id="pricing" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 scroll-mt-24">
              <h3 className="text-xl font-bold text-gray-900 mb-6">定价方案</h3>
              <div className="space-y-4">
                {adaptedTool.pricing.map((plan, index) => (
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
            <div id="tags" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 scroll-mt-24">
              <h3 className="text-xl font-bold text-gray-900 mb-4">工具标签</h3>
              <div className="flex flex-wrap gap-2">
                {/* 优先显示分类标签 */}
                {tool.categories.map((category, index) => (
                  <span
                    key={`category-${index}`}
                    className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium flex items-center"
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    {category}
                  </span>
                ))}
                {/* 其他功能标签 */}
                {tool.features.map((feature, index) => (
                  <span
                    key={`feature-${index}`}
                    className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm flex items-center"
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            {/* 工具信息 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">工具信息</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">主分类</span>
                  <span className="font-medium text-gray-900">{tool.categories[0] || '未分类'}</span>
                </div>
                {tool.categories.length > 1 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">其他分类</span>
                    <span className="font-medium text-gray-900">{tool.categories.slice(1).join(', ')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">收录时间</span>
                  <span className="font-medium text-gray-900">{adaptedTool.addedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">最后更新</span>
                  <span className="font-medium text-gray-900">{adaptedTool.lastUpdated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">浏览量</span>
                  <span className="font-medium text-gray-900">{adaptedTool.views.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 相关工具推荐 */}
        <div className="mt-12">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">相关工具推荐</h2>
            <p className="text-gray-600 mb-6">与当前工具同属"{adaptedTool.category}"分类的其他优质工具</p>
            
            {loadingRelated ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-2 text-gray-600">加载相关工具中...</span>
              </div>
            ) : relatedTools.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                暂时没有找到相关工具
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedTools.map((relatedTool) => (
                  <Link
                    key={relatedTool.id}
                    to={`/tools/${relatedTool.id}`}
                    className="group bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow relative border border-gray-200"
                  >
                    {/* 收藏按钮 */}
                    <button className="absolute top-3 right-3 bg-white/90 p-1.5 rounded-full hover:bg-white transition-colors">
                      <Heart className="w-3 h-3 text-gray-600 hover:text-red-500" />
                    </button>
                    
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0">
                        <OptimizedImage
                          src={relatedTool.logo}
                          alt={relatedTool.name}
                          className="w-full h-full"
                          objectFit="contain"
                          background
                          fallback={
                            <img
                              src={generateInitialLogo(relatedTool.name, [relatedTool.category])}
                              alt={relatedTool.name}
                              className="w-full h-full object-contain p-2"
                            />
                          }
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {relatedTool.name}
                        </h3>
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
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
            )}
          </div>
        </div>
      </div>

      {/* 全屏截图查看器 */}
      <ScreenshotViewer
        isOpen={isFullscreenViewer}
        images={adaptedTool.images}
        selectedImage={selectedImage}
        toolName={adaptedTool.name}
        fallbackLogoUrl={fallbackLogoDataUrl}
        onClose={() => setIsFullscreenViewer(false)}
        onSelectImage={setSelectedImage}
      />
    </div>
  );
};

export default ToolDetailPage;
