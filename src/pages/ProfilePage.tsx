import React, { useState, useEffect, useCallback } from 'react';
import { User, Heart, Star, Settings, TrendingUp, Camera, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { updateUserProfile } from '../lib/auth';
import { getUserFavorites } from '../lib/community';
import { getBestDisplayLogoUrl } from '../lib/logoUtils';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useToast, createToastHelpers } from '../components/Toast';
import { useMetaTags } from '../hooks/useMetaTags';
import { useTranslation } from 'react-i18next';
import type { Tool } from '../types';

type ProfileTab = 'favorites' | 'activity' | 'reviews' | 'settings';

const VALID_PROFILE_TABS: ProfileTab[] = ['favorites', 'activity', 'reviews', 'settings'];

function isValidProfileTab(value: string | null): value is ProfileTab {
  return !!value && VALID_PROFILE_TABS.includes(value as ProfileTab);
}

const ProfilePage = () => {
  const { t } = useTranslation();
  // Phase 1优化: 接入 useMetaTags hook（用户个人页面添加 noIndex）
  useMetaTags({
    title: t('profile.pageTitle'),
    description: t('profile.pageDescription'),
    noIndex: true // 个人页面不索引
  });

  const { user } = useAuth();
  const { profile, refreshProfile } = useProfile();
  const { showToast } = useToast();
  const toast = createToastHelpers(showToast);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ProfileTab>(() => {
    const tab = searchParams.get('tab');
    return isValidProfileTab(tab) ? tab : 'favorites';
  });
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
  const loadFavorites = useCallback(async () => {
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
  }, [user]);

  // 当用户改变或激活收藏标签页时加载收藏数据
  useEffect(() => {
    if (user && activeTab === 'favorites') {
      loadFavorites();
    }
  }, [user, activeTab, loadFavorites]);

  // URL 参数同步（支持 /profile?tab=favorites 直达）
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (isValidProfileTab(tab) && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams, activeTab]);

  const handleTabChange = (tab: ProfileTab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    }, { replace: true });
  };

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
      toast.success(t('profile.updateSuccess'), t('profile.updateSuccessMessage'));
    } catch (error) {
      console.error('更新失败:', error);
      toast.error(t('profile.updateError'), (error as Error).message);
    }
  };

  const tabs = [
    { id: 'favorites', label: t('profile.tabs.favorites'), icon: Heart },
    { id: 'activity', label: t('profile.tabs.activity'), icon: TrendingUp },
    { id: 'reviews', label: t('profile.tabs.reviews'), icon: Star },
    { id: 'settings', label: t('profile.tabs.settings'), icon: Settings }
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
                {t('profile.joinDate', { date: new Date(profile?.created_at || '').toLocaleDateString() })}
              </p>

              {/* Stats */}
              <div className="flex justify-center md:justify-start space-x-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{favorites.length}</div>
                  <div className="text-sm text-gray-500">{t('profile.stats.favorites')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">0</div>
                  <div className="text-sm text-gray-500">{t('profile.stats.reviews')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">0</div>
                  <div className="text-sm text-gray-500">{t('profile.stats.views')}</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('profile.edit')}
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
                    onClick={() => handleTabChange(tab.id as ProfileTab)}
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
                <h3 className="text-lg font-semibold text-gray-900 mb-6">{t('profile.tabs.favorites')}</h3>
                {loadingFavorites ? (
                  <div className="text-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500">{t('profile.loading')}</p>
                  </div>
                ) : favorites.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">{t('profile.noFavorites')}</p>
                    <Link to="/tools" className="text-blue-600 hover:text-blue-700 underline">
                      {t('profile.browseToolsHint')}
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {favorites.slice(0, 6).map((favorite) => {
                      const tool = favorite.tools;
                      return (
                        <div key={favorite.id} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center space-x-3 mb-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                              <img
                                src={getBestDisplayLogoUrl(tool.logo_url, tool.name, tool.categories || [])}
                                alt={tool.name}
                                className="w-full h-full object-contain p-1"
                              />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 text-sm">{tool.name}</h4>
                              <p className="text-xs text-gray-500">{tool.categories?.[0] || '工具'}</p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{tool.tagline}</p>
                          <div className="flex space-x-2">
                            <Link
                              to={`/tools/${tool.id}`}
                              state={{ tool }}
                              className="flex-1 bg-blue-600 text-white text-xs py-1.5 px-3 rounded text-center hover:bg-blue-700 transition-colors"
                            >
                              {t('profile.viewDetails')}
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
                      to="/profile?tab=favorites"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      {t('profile.viewAllFavorites', { count: favorites.length })}
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">{t('profile.tabs.activity')}</h3>
                <div className="text-center py-12">
                  <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">{t('profile.noActivity')}</p>
                </div>
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">{t('profile.tabs.reviews')}</h3>
                <div className="text-center py-12">
                  <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">{t('profile.noReviews')}</p>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">{t('profile.tabs.settings')}</h3>
                {isEditing ? (
                  <form onSubmit={handleEditSubmit} className="max-w-2xl space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.labels.username')}</label>
                        <input
                          type="text"
                          value={editForm.username}
                          onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.labels.fullName')}</label>
                        <input
                          type="text"
                          value={editForm.full_name}
                          onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.labels.bio')}</label>
                      <textarea
                        value={editForm.bio}
                        onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                        placeholder={t('profile.placeholders.bio')}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.labels.company')}</label>
                        <input
                          type="text"
                          value={editForm.company}
                          onChange={(e) => setEditForm({...editForm, company: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.labels.position')}</label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.labels.website')}</label>
                        <input
                          type="url"
                          value={editForm.website}
                          onChange={(e) => setEditForm({...editForm, website: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                          placeholder={t('profile.placeholders.website')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('profile.labels.location')}</label>
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
                        {t('profile.save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        {t('profile.cancel')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="max-w-2xl space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">{t('profile.labels.userId')}</label>
                        <p className="text-gray-900">{user.id}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">{t('profile.labels.email')}</label>
                        <p className="text-gray-900">{user.email}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">{t('profile.labels.username')}</label>
                        <p className="text-gray-900">{profile?.username || t('profile.notSet')}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">{t('profile.labels.fullName')}</label>
                        <p className="text-gray-900">{profile?.full_name || t('profile.notSet')}</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">{t('profile.labels.bio')}</label>
                      <p className="text-gray-900">{profile?.bio || t('profile.notSet')}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">{t('profile.labels.company')}</label>
                        <p className="text-gray-900">{profile?.company || t('profile.notSet')}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">{t('profile.labels.position')}</label>
                        <p className="text-gray-900">{profile?.position || t('profile.notSet')}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">{t('profile.labels.website')}</label>
                        <p className="text-gray-900">{profile?.website || t('profile.notSet')}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">{t('profile.labels.location')}</label>
                        <p className="text-gray-900">{profile?.location || t('profile.notSet')}</p>
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
