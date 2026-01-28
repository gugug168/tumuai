import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star, ExternalLink, Trash2, CheckSquare, Square } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getUserFavorites, removeFromFavorites } from '../lib/community';
import { generateInitialLogo } from '../lib/logoUtils';
import AuthModal from '../components/AuthModal';
import { useToast, createToastHelpers } from '../components/Toast';

const FavoritesPage = () => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { showToast } = useToast();
  const toast = createToastHelpers(showToast);

  // 批量选择状态
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);

  useEffect(() => {
    if (user) {
      loadFavorites();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadFavorites = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const data = await getUserFavorites();
      setFavorites(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('加载收藏失败:', error);
      setLoadError(err?.message || '加载收藏失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (toolId: string) => {
    try {
      await removeFromFavorites(toolId);
      setFavorites(prev => prev.filter(fav => fav.tool_id !== toolId));
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(toolId);
        return newSet;
      });
    } catch (error) {
      console.error('取消收藏失败:', error);
      toast.error('取消失败', '取消收藏失败，请重试');
    }
  };

  const toggleSelectItem = (toolId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolId)) {
        newSet.delete(toolId);
      } else {
        newSet.add(toolId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === favorites.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(favorites.map(fav => fav.tool_id as string)));
    }
  };

  const handleBatchRemove = async () => {
    if (selectedItems.size === 0) return;

    if (!confirm(`确定要取消选中的 ${selectedItems.size} 个工具的收藏吗？`)) {
      return;
    }

    try {
      await Promise.all(
        Array.from(selectedItems).map(toolId => removeFromFavorites(toolId))
      );

      setFavorites(prev => prev.filter(fav => !selectedItems.has(fav.tool_id as string)));
      setSelectedItems(new Set());

      toast.success('取消成功', `已取消 ${selectedItems.size} 个工具的收藏`);
    } catch (error) {
      console.error('批量取消收藏失败:', error);
      toast.error('取消失败', '批量取消收藏失败，请重试');
    }
  };

  const exitBatchMode = () => {
    setIsBatchMode(false);
    setSelectedItems(new Set());
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">请先登录</h2>
          <p className="text-gray-600 mb-6">登录后即可查看您收藏的工具</p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            立即登录
          </button>
        </div>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialMode="login"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
          {loadError && (
            <p className="text-red-500 mt-2">{loadError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Heart className="w-8 h-8 mr-3 text-red-500" />
              我的收藏
            </h1>
            {favorites.length > 0 && (
              <button
                onClick={() => isBatchMode ? exitBatchMode() : setIsBatchMode(true)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors border ${
                  isBatchMode
                    ? 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                    : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                }`}
              >
                {isBatchMode ? '取消批量操作' : '批量管理'}
              </button>
            )}
          </div>
          <p className="text-lg text-gray-600">
            您收藏的所有工具，共 {favorites.length} 个
          </p>
        </div>

        {/* 批量操作栏 */}
        {isBatchMode && favorites.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleSelectAll}
                className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-blue-700 transition-colors"
              >
                {selectedItems.size === favorites.length ? (
                  <CheckSquare className="w-5 h-5 text-blue-600" />
                ) : (
                  <Square className="w-5 h-5 text-gray-400" />
                )}
                <span>{selectedItems.size === favorites.length ? '取消全选' : '全选'}</span>
              </button>
              <span className="text-sm text-gray-600">
                已选择 <span className="font-semibold text-blue-600">{selectedItems.size}</span> 项
              </span>
            </div>
            <button
              onClick={handleBatchRemove}
              disabled={selectedItems.size === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>批量取消收藏</span>
            </button>
          </div>
        )}

        {favorites.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="relative inline-block mb-6">
              <Heart className="w-20 h-20 text-gray-200 mx-auto" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Heart className="w-10 h-10 text-gray-400" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">还没有收藏任何工具</h3>
            <p className="text-gray-600 mb-6">
              去工具中心发现更多优质工具，收藏您喜欢的工具吧！
            </p>
            <Link
              to="/tools"
              className="inline-flex items-center px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 hover:shadow-lg bg-blue-600 text-white"
            >
              <Heart className="w-4 h-4 mr-2" />
              浏览工具中心
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((favorite) => {
              const tool = favorite.tools;
              const isSelected = selectedItems.has(favorite.tool_id as string);
              return (
                <div
                  key={favorite.id}
                  className={`bg-white rounded-xl shadow-sm border overflow-hidden group relative transition-all duration-200 ${
                    isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`}
                >
                  {isBatchMode && (
                    <button
                      onClick={() => toggleSelectItem(favorite.tool_id as string)}
                      className="absolute top-4 left-4 z-20 p-2 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => handleRemoveFavorite(favorite.tool_id)}
                    className={`absolute top-4 right-4 z-10 text-white p-2 rounded-full transition-all shadow-sm ${
                      isBatchMode ? 'right-16 bg-red-500 hover:bg-red-600' : 'bg-red-500 hover:bg-red-600'
                    }`}
                    title="取消收藏"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="p-6">
                    <div className="flex items-start space-x-3 mb-4">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                        <img
                          src={tool.logo_url || generateInitialLogo(tool.name, tool.categories || [])}
                          alt={tool.name}
                          className="w-full h-full object-contain p-2"
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {tool.name}
                        </h3>
                        <div className="flex items-center space-x-1 mt-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <span className="text-sm text-gray-600">{tool.rating}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                      {tool.tagline}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {tool.categories?.slice(0, 2).map((category: string, index: number) => (
                        <span key={index} className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs">
                          {category}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-blue-600">
                        {tool.pricing === 'Free' ? '完全免费' :
                         tool.pricing === 'Freemium' ? '提供免费版' :
                         tool.pricing === 'Paid' ? '付费' : '免费试用'}
                      </span>
                      <span className="text-xs text-gray-500">
                        收藏于 {new Date(favorite.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex space-x-2">
                      <Link
                        to={`/tools/${tool.id}`}
                        className="flex-1 bg-blue-600 text-white py-2 px-3 text-sm flex items-center justify-center hover:bg-blue-700 transition-colors"
                      >
                        查看详情
                        <ExternalLink className="ml-1 w-3 h-3" />
                      </Link>
                      <a
                        href={tool.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-gray-100 text-gray-700 py-2 px-3 text-sm hover:bg-gray-200 transition-colors"
                      >
                        访问官网
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode="login"
      />
    </div>
  );
};

export default FavoritesPage;
