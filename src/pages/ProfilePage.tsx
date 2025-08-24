import React, { useState, useEffect } from 'react';
import { User, Heart, Star, Settings, TrendingUp, Camera, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { updateUserProfile } from '../lib/auth';
import { getUserFavorites } from '../lib/community';
import { useNavigate, Link } from 'react-router-dom';
import type { Tool } from '../types';

const ProfilePage = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('favorites');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    username: '',
    full_name: '',
    bio: '',
    company: '',
    position: '',
    website: '',
    location: ''
  });
  const [favorites, setFavorites] = useState<Tool[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const navigate = useNavigate();

  // 当profile更新时，更新editForm
  useEffect(() => {
    if (profile) {
      setEditForm({
        username: profile.username || '',
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        company: profile.company || '',
        position: profile.position || '',
        website: profile.website || '',
        location: profile.location || ''
      });
    }
  }, [profile]);

  // 如果用户未登录，重定向到首页
  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  // 加载用户收藏数据
  const loadFavorites = async () => {
    if (!user) return;
    try {
      setLoadingFavorites(true);
      const data = await getUserFavorites();
      setFavorites(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('加载收藏失败:', error);
      setFavorites([]);
    } finally {
      setLoadingFavorites(false);
    }
  };

  // 当用户改变或激活收藏标签页时加载收藏数据
  useEffect(() => {
    if (user && activeTab === 'favorites') {
      loadFavorites();
    }
  }, [user, activeTab]);

  // 如果用户未登录，不渲染页面内容
  if (!user) {
    return null;
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      await updateUserProfile(user.id, editForm);
      await refreshProfile(); // 刷新profile数据
      setIsEditing(false);
      alert('资料更新成功');
    } catch (error) {
      console.error('更新失败:', error);
      alert('更新失败: ' + (error as Error).message);
    }
  };

  const tabs = [
    { id: 'favorites', label: '收藏的工具', icon: Heart },
    { id: 'activity', label: '最近活动', icon: TrendingUp },
    { id: 'reviews', label: '我的评价', icon: Star },
    { id: 'settings', label: '账户设置', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
            <div className="relative">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username || '用户'}
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-12 h-12 text-gray-400" />
                </div>
              )}
              <button className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors">
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {profile?.full_name || profile?.username || '用户'}
              </h1>
              {profile?.position && profile?.company && (
                <p className="text-gray-600 mb-1">{profile.position} @ {profile.company}</p>
              )}
              {profile?.bio && (
                <p className="text-gray-600 mb-2">{profile.bio}</p>
              )}
              <p className="text-gray-500 text-sm mb-4">
                加入时间：{new Date(profile?.created_at || '').toLocaleDateString()}
              </p>
              
              {/* Stats */}
              <div className="flex justify-center md:justify-start space-x-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{favorites.length}</div>
                  <div className="text-sm text-gray-500">收藏工具</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">0</div>
                  <div className="text-sm text-gray-500">发表评价</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">0</div>
                  <div className="text-sm text-gray-500">浏览次数</div>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              编辑资料
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-8">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-8">
            {/* Favorites Tab */}
            {activeTab === 'favorites' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">我收藏的工具</h3>
                {loadingFavorites ? (
                  <div className="text-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500">加载中...</p>
                  </div>
                ) : favorites.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">还没有收藏任何工具</p>
                    <Link to="/tools" className="text-blue-600 hover:text-blue-700 underline">
                      去工具中心发现更多工具
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {favorites.slice(0, 6).map((favorite) => {
                      const tool = favorite.tools;
                      return (
                        <div key={favorite.id} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center space-x-3 mb-3">
                            <img
                              src={tool.logo_url || 'https://via.placeholder.com/40x40?text=Tool'}
                              alt={tool.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 text-sm">{tool.name}</h4>
                              <p className="text-xs text-gray-500">{tool.categories?.[0] || '工具'}</p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{tool.tagline}</p>
                          <div className="flex space-x-2">
                            <Link
                              to={`/tools/${tool.id}`}
                              className="flex-1 bg-blue-600 text-white text-xs py-1.5 px-3 rounded text-center hover:bg-blue-700 transition-colors"
                            >
                              查看详情
                            </Link>
                            <a
                              href={tool.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-gray-200 text-gray-700 text-xs py-1.5 px-2 rounded hover:bg-gray-300 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {favorites.length > 6 && (
                  <div className="text-center mt-6">
                    <Link
                      to="/favorites"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      查看全部收藏 ({favorites.length})
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">最近活动</h3>
                <div className="text-center py-12">
                  <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">暂无活动记录</p>
                </div>
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">我的评价</h3>
                <div className="text-center py-12">
                  <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">还没有发表任何评价</p>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">账户设置</h3>
                {isEditing ? (
                  <form onSubmit={handleEditSubmit} className="max-w-2xl space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
                        <input
                          type="text"
                          value={editForm.username}
                          onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">真实姓名</label>
                        <input
                          type="text"
                          value={editForm.full_name}
                          onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">个人简介</label>
                      <textarea
                        value={editForm.bio}
                        onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                        placeholder="简单介绍一下自己..."
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">公司</label>
                        <input
                          type="text"
                          value={editForm.company}
                          onChange={(e) => setEditForm({...editForm, company: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">职位</label>
                        <input
                          type="text"
                          value={editForm.position}
                          onChange={(e) => setEditForm({...editForm, position: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">个人网站</label>
                        <input
                          type="url"
                          value={editForm.website}
                          onChange={(e) => setEditForm({...editForm, website: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                          placeholder="https://example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">所在地</label>
                        <input
                          type="text"
                          value={editForm.location}
                          onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                        />
                      </div>
                    </div>
                    
                    <div className="flex space-x-4">
                      <button
                        type="submit"
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        保存更改
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="max-w-2xl space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">用户ID</label>
                        <p className="text-gray-900">{user.id}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">邮箱</label>
                        <p className="text-gray-900">{user.email}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">用户名</label>
                        <p className="text-gray-900">{profile?.username || '未设置'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">真实姓名</label>
                        <p className="text-gray-900">{profile?.full_name || '未设置'}</p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">个人简介</label>
                      <p className="text-gray-900">{profile?.bio || '未设置'}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">公司</label>
                        <p className="text-gray-900">{profile?.company || '未设置'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">职位</label>
                        <p className="text-gray-900">{profile?.position || '未设置'}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">个人网站</label>
                        <p className="text-gray-900">{profile?.website || '未设置'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">所在地</label>
                        <p className="text-gray-900">{profile?.location || '未设置'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;