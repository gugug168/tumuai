/**
 * ToolManagementModal 组件 - 工具创建/编辑弹窗
 *
 * 从 AdminDashboard 的弹窗逻辑中提取
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, Save, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { createTool, updateTool, deleteTool, extractLogoForPreview } from '../../lib/admin';
import { getBestDisplayLogoUrl } from '../../lib/logoUtils';

interface Tool {
  id?: string;
  name: string;
  tagline: string;
  description?: string;
  website_url: string;
  logo_url?: string;
  categories: string[];
  features: string[];
  pricing: 'Free' | 'Freemium' | 'Paid' | 'Trial';
  featured: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface ToolManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  tool?: Tool;
  categories: Category[];
  mode: 'create' | 'edit';
}

const ToolManagementModal: React.FC<ToolManagementModalProps> = ({
  isOpen,
  onClose,
  onSave,
  tool,
  categories,
  mode
}) => {
  const [formData, setFormData] = useState<Tool>({
    name: '',
    tagline: '',
    description: '',
    website_url: '',
    logo_url: '',
    categories: [],
    features: [],
    pricing: 'Free',
    featured: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featureInput, setFeatureInput] = useState('');
  const [fetchingLogo, setFetchingLogo] = useState(false);

  useEffect(() => {
    if (tool) {
      setFormData(tool);
    } else {
      setFormData({
        name: '',
        tagline: '',
        description: '',
        website_url: '',
        logo_url: '',
        categories: [],
        features: [],
        pricing: 'Free',
        featured: false
      });
    }
  }, [tool, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'create') {
        await createTool(formData);
      } else if (tool?.id) {
        await updateTool(tool.id, formData);
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!tool?.id) return;

    if (window.confirm('确定要删除这个工具吗？此操作不可撤销。')) {
      try {
        await deleteTool(tool.id);
        onSave();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : '删除失败');
      }
    }
  };

  const addFeature = () => {
    if (featureInput.trim()) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, featureInput.trim()]
      }));
      setFeatureInput('');
    }
  };

  const removeFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const toggleCategory = (categoryName: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(categoryName)
        ? prev.categories.filter(c => c !== categoryName)
        : [...prev.categories, categoryName]
    }));
  };

  const handleAutoFetchLogo = async () => {
    if (!formData.website_url) {
      setError('请先填写官网地址');
      return;
    }

    setFetchingLogo(true);
    setError(null);

    try {
      const logoUrl = await extractLogoForPreview(formData.website_url);

      if (logoUrl) {
        setFormData(prev => ({ ...prev, logo_url: logoUrl }));
      } else {
        setError('无法自动获取图标，请手动输入');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取图标失败');
    } finally {
      setFetchingLogo(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? '新增工具' : '编辑工具'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 基本信息 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">工具名称 *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 placeholder-gray-500"
              placeholder="例如：AutoCAD"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">一句话简介 *</label>
            <input
              type="text"
              required
              value={formData.tagline}
              onChange={(e) => setFormData(prev => ({ ...prev, tagline: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 placeholder-gray-500"
              placeholder="例如：专业的CAD设计软件"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">详细描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 placeholder-gray-500"
              placeholder="详细介绍工具的功能和特点..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">官网地址 *</label>
              <input
                type="url"
                required
                value={formData.website_url}
                onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 placeholder-gray-500"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Logo地址</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 placeholder-gray-500"
                  placeholder="https://example.com/logo.png"
                />
                <button
                  type="button"
                  onClick={handleAutoFetchLogo}
                  disabled={fetchingLogo || !formData.website_url}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  title="从官网自动获取图标"
                >
                  <RefreshCw className={`h-4 w-4 ${fetchingLogo ? 'animate-spin' : ''}`} />
                  <span className="text-sm">自动获取</span>
                </button>
              </div>
              {formData.logo_url && (
                <div className="mt-2 flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                  <img
                    src={getBestDisplayLogoUrl(formData.logo_url, formData.name || 'Tool', formData.categories || [])}
                    alt="Logo预览"
                    className="w-8 h-8 object-contain rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span className="text-xs text-gray-500 truncate flex-1">{formData.logo_url}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">定价模式 *</label>
              <select
                value={formData.pricing}
                onChange={(e) => setFormData(prev => ({ ...prev, pricing: e.target.value as 'Free' | 'Freemium' | 'Paid' | 'Trial' }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="Free">免费</option>
                <option value="Freemium">免费增值</option>
                <option value="Paid">付费</option>
                <option value="Trial">试用</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">状态</label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.featured}
                  onChange={(e) => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">设为精选</span>
              </label>
            </div>
          </div>

          {/* 分类选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">所属分类</label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map(category => (
                <label key={category.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.categories.includes(category.name)}
                    onChange={() => toggleCategory(category.name)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{category.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 功能特性 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">功能特性</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white text-gray-900 placeholder-gray-500"
                placeholder="添加功能特性..."
              />
              <button type="button" onClick={addFeature} className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.features.map((feature, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                >
                  {feature}
                  <button type="button" onClick={() => removeFeature(index)} className="ml-1 text-gray-500 hover:text-gray-700">
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-between pt-4 border-t">
            <div>
              {mode === 'edit' && tool?.id && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除工具
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                取消
              </button>
              <button type="submit" disabled={loading} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {mode === 'create' ? '创建工具' : '保存更改'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ToolManagementModal;
