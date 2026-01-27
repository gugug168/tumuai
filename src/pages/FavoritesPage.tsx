import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star, ExternalLink, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getUserFavorites, removeFromFavorites } from '../lib/community';
import { generateInitialLogo } from '../lib/logoUtils';
import AuthModal from '../components/AuthModal';

const FavoritesPage = () => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      const err = error as Error
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
    } catch (error) {
      console.error('取消收藏失败:', error);
      alert('取消收藏失败，请重试');
    }
  };

  // 如果用户未登录
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
      <div className="min-h-screen bg-background-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
          {loadError && (
            <p className="text-red-500 mt-2">{loadError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary-800 mb-4 flex items-center">
            <Heart className="w-8 h-8 mr-3 text-red-500" />
            我的收藏
          </h1>
          <p className="text-lg text-gray-600">
            您收藏的所有工具，共 {favorites.length} 个
          </p>
        </div>

        {favorites.length === 0 ? (
          <div className="card p-12 text-center">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-primary-800 mb-2">还没有收藏任何工具</h3>
            <p className="text-gray-600 mb-6">
              去工具中心发现更多优质工具吧！
            </p>
            <Link to="/tools" className="btn-primary">
              浏览工具中心
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((favorite) => {
              const tool = favorite.tools;
              return (
                <div key={favorite.id} className="card overflow-hidden group relative">
                  {/* 取消收藏按钮 */}
                  <button
                    onClick={() => handleRemoveFavorite(favorite.tool_id)}
                    className="absolute top-4 right-4 z-10 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-sm"
                    title="取消收藏"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="p-6">
                    <div className="flex items-start space-x-3 mb-4">
                      <img
                        src={tool.logo_url || generateInitialLogo(tool.name, tool.categories || [])}
                        alt={tool.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-primary-800 group-hover:text-accent-600 transition-colors">
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

                    {/* Category Tags */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {tool.categories?.slice(0, 2).map((category, index) => (
                        <span key={index} className="tag-primary text-xs">
                          {category}
                        </span>
                      ))}
                    </div>

                    {/* Pricing */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-accent-600">
                        {tool.pricing === 'Free' ? '完全免费' : 
                         tool.pricing === 'Freemium' ? '提供免费版' :
                         tool.pricing === 'Paid' ? '付费' : '免费试用'}
                      </span>
                      <span className="text-xs text-gray-500">
                        收藏于 {new Date(favorite.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                      <Link
                        to={`/tools/${tool.id}`}
                        className="flex-1 btn-primary py-2 px-3 text-sm flex items-center justify-center"
                      >
                        查看详情
                        <ExternalLink className="ml-1 w-3 h-3" />
                      </Link>
                      <a
                        href={tool.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary py-2 px-3 text-sm"
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
    </div>
  );
};

export default FavoritesPage;