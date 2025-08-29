import React, { useState } from 'react';
import { Upload, Link as LinkIcon, Tag, DollarSign, Image, FileText, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadToolLogo, validateImageFile } from '../lib/storage';
import { FALLBACK_CATEGORIES, SUBMIT_PRICING_OPTIONS } from '../lib/config';
import { autoGenerateLogo, generateInitialLogo } from '../lib/logoUtils';

const SubmitToolPage = () => {
  const [formData, setFormData] = useState({
    toolName: '',
    officialWebsite: '',
    shortDescription: '',
    detailedDescription: '',
    categories: [] as string[],
    mainFeatures: '',
    pricingModel: '',
    logoFile: null as File | null,
    submitterEmail: ''
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // 清除对应字段的错误
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleCategoryChange = (category: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
    
    if (errors.categories) {
      setErrors(prev => ({
        ...prev,
        categories: ''
      }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 使用统一的文件验证函数
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        setErrors(prev => ({
          ...prev,
          logoFile: validation.error || '文件格式不正确'
        }));
        return;
      }
      
      setFormData(prev => ({
        ...prev,
        logoFile: file
      }));
      
      if (errors.logoFile) {
        setErrors(prev => ({
          ...prev,
          logoFile: ''
        }));
      }
    }
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    // 必填字段验证
    if (!formData.toolName.trim()) {
      newErrors.toolName = '工具名称为必填项';
    }

    if (!formData.officialWebsite.trim()) {
      newErrors.officialWebsite = '官方网址为必填项';
    } else {
      // URL格式验证
      try {
        new URL(formData.officialWebsite);
      } catch {
        newErrors.officialWebsite = '请输入有效的网址格式';
      }
    }

    if (!formData.shortDescription.trim()) {
      newErrors.shortDescription = '一句话简介为必填项';
    } else if (formData.shortDescription.length > 100) {
      newErrors.shortDescription = '简介不能超过100字';
    }

    if (formData.categories.length === 0) {
      newErrors.categories = '请至少选择一个分类';
    }

    if (!formData.pricingModel) {
      newErrors.pricingModel = '请选择定价模式';
    }

    // Logo文件不再是必填项
    // if (!formData.logoFile) {
    //   newErrors.logoFile = '请上传工具Logo';
    // }

    // 邮箱格式验证（选填）
    if (formData.submitterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.submitterEmail)) {
      newErrors.submitterEmail = '请输入有效的邮箱地址';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('开始提交工具...', formData);
      
      // 处理Logo：上传用户文件或自动生成
      let logoUrl = null;
      
      if (formData.logoFile) {
        // 用户上传了Logo文件
        try {
          console.log('正在上传用户 logo...');
          logoUrl = await uploadToolLogo(formData.logoFile, formData.toolName);
          console.log('用户Logo 上传成功:', logoUrl);
        } catch (uploadError) {
          console.error('Logo 上传失败:', uploadError);
          alert(`图片上传失败: ${(uploadError as Error).message}`);
          return;
        }
      } else {
        // 自动生成Logo
        try {
          console.log('正在自动生成 logo...');
          logoUrl = await autoGenerateLogo(formData.toolName, formData.officialWebsite, formData.categories);
          console.log('自动生成Logo 成功:', logoUrl);
        } catch (logoError) {
          console.warn('自动Logo生成失败，使用默认生成:', logoError);
          // 兜底：使用简单的首字母生成
          logoUrl = generateInitialLogo(formData.toolName, formData.categories);
        }
      }

      const submissionData = {
        submitter_email: formData.submitterEmail || null,
        tool_name: formData.toolName,
        tagline: formData.shortDescription,
        description: formData.detailedDescription || null,
        website_url: formData.officialWebsite,
        logo_url: logoUrl,
        categories: formData.categories,
        features: formData.mainFeatures.split(',').map(f => f.trim()).filter(f => f),
        pricing: formData.pricingModel === 'free' ? 'Free' : 
                 formData.pricingModel === 'freemium' ? 'Freemium' :
                 formData.pricingModel === 'paid' ? 'Paid' : 'Trial'
      };
      
      console.log('提交数据:', submissionData);

      // 直接使用匿名策略插入（RLS 已允许 public 插入 tool_submissions）
      const { data, error } = await supabase
        .from('tool_submissions')
        .insert([submissionData]);
      
      if (error) {
        console.error('数据库插入错误:', error);
        alert(`提交失败: ${error.message}`);
        return;
      }
      
      console.log('提交成功:', data);
      
      // 显示成功消息
      alert('✅ 工具提交成功！我们会在1-3个工作日内审核，审核结果将通过邮件通知您。');
      
      // 重置表单
      setFormData({
        toolName: '',
        officialWebsite: '',
        shortDescription: '',
        detailedDescription: '',
        categories: [],
        mainFeatures: '',
        pricingModel: '',
        logoFile: null,
        submitterEmail: ''
      });
      
    } catch (error) {
      console.error('提交过程中发生错误:', error);
      alert('提交失败: ' + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">提交新工具</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            发现了优秀的土木工程AI工具？与社区分享，帮助更多工程师提升工作效率
          </p>
        </div>

        {/* Submission Guidelines */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            提交指南
          </h3>
          <ul className="text-blue-800 space-y-2 text-sm">
            <li>• 确保工具与土木工程相关，能够提升工程师的工作效率</li>
            <li>• 提供准确、详细的工具描述和功能介绍</li>
            <li>• 工具必须是正常运行且可访问的</li>
            <li>• 我们会在1-3个工作日内审核您的提交</li>
            <li>• 审核通过后，工具将出现在我们的工具目录中</li>
          </ul>
        </div>

        {/* Submission Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基本信息 */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                基本信息
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    工具名称 *
                  </label>
                  <input
                    type="text"
                    name="toolName"
                    value={formData.toolName}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.toolName ? 'border-red-300' : 'border-gray-300'
                    } bg-white text-gray-900 placeholder-gray-500`}
                    placeholder="例如：StructuralGPT"
                  />
                  {errors.toolName && (
                    <p className="mt-1 text-sm text-red-600">{errors.toolName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    官方网址 *
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="url"
                      name="officialWebsite"
                      value={formData.officialWebsite}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.officialWebsite ? 'border-red-300' : 'border-gray-300'
                      } bg-white text-gray-900 placeholder-gray-500`}
                      placeholder="https://example.com"
                    />
                  </div>
                  {errors.officialWebsite && (
                    <p className="mt-1 text-sm text-red-600">{errors.officialWebsite}</p>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  一句话简介 * <span className="text-gray-500">(少于100字)</span>
                </label>
                <input
                  type="text"
                  name="shortDescription"
                  value={formData.shortDescription}
                  onChange={handleInputChange}
                  maxLength={100}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.shortDescription ? 'border-red-300' : 'border-gray-300'
                  } bg-white text-gray-900 placeholder-gray-500`}
                  placeholder="简洁描述工具的核心功能和价值"
                />
                <div className="flex justify-between mt-1">
                  {errors.shortDescription ? (
                    <p className="text-sm text-red-600">{errors.shortDescription}</p>
                  ) : (
                    <div></div>
                  )}
                  <p className="text-sm text-gray-500">{formData.shortDescription.length}/100</p>
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  详细描述 (选填)
                </label>
                <textarea
                  name="detailedDescription"
                  value={formData.detailedDescription}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                  placeholder="详细描述工具的功能、特点、使用场景等..."
                />
              </div>
            </div>

            {/* 分类和功能 */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Tag className="w-5 h-5 mr-2 text-blue-600" />
                分类和功能
              </h3>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  选择分类 * <span className="text-gray-500">(可多选)</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {FALLBACK_CATEGORIES.map((category) => (
                    <label key={category} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.categories.includes(category)}
                        onChange={() => handleCategoryChange(category)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{category}</span>
                    </label>
                  ))}
                </div>
                {errors.categories && (
                  <p className="mt-2 text-sm text-red-600">{errors.categories}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  主要功能 (选填)
                </label>
                <input
                  type="text"
                  name="mainFeatures"
                  value={formData.mainFeatures}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                  placeholder="用逗号分隔，例如：AI优化, 参数化设计, 成本估算"
                />
              </div>
            </div>

            {/* 定价和Logo */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
                定价和Logo
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    定价模式 *
                  </label>
                  <select
                    name="pricingModel"
                    value={formData.pricingModel}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.pricingModel ? 'border-red-300' : 'border-gray-300'
                    } bg-white text-gray-900`}
                  >
                    <option value="">请选择定价模式</option>
                    {SUBMIT_PRICING_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.pricingModel && (
                    <p className="mt-1 text-sm text-red-600">{errors.pricingModel}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    上传工具Logo (可选)
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label
                      htmlFor="logo-upload"
                      className={`w-full px-3 py-2 border-2 border-dashed rounded-lg cursor-pointer hover:border-blue-400 transition-colors flex items-center justify-center ${
                        errors.logoFile ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <Image className="w-5 h-5 mr-2 text-gray-400" />
                      <span className="text-gray-600">
                        {formData.logoFile ? formData.logoFile.name : '点击上传图片'}
                      </span>
                    </label>
                  </div>
                  {errors.logoFile && (
                    <p className="mt-1 text-sm text-red-600">{errors.logoFile}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    支持 JPG、PNG 格式，文件大小不超过 5MB
                  </p>
                  <p className="mt-1 text-xs text-blue-600">
                    💡 未上传Logo？我们会自动从网站获取favicon或生成首字母Logo
                  </p>
                </div>
              </div>
            </div>

            {/* 联系信息 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                联系信息
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  提交人邮箱 (选填)
                </label>
                <input
                  type="email"
                  name="submitterEmail"
                  value={formData.submitterEmail}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.submitterEmail ? 'border-red-300' : 'border-gray-300'
                  } bg-white text-gray-900 placeholder-gray-500`}
                  placeholder="用于通知审核结果"
                />
                {errors.submitterEmail && (
                  <p className="mt-1 text-sm text-red-600">{errors.submitterEmail}</p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    提交审核
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Contact Information */}
        <div className="mt-8 text-center text-gray-600">
          <p>
            有问题？联系我们：
            <a href="mailto:submit@civilaihub.com" className="text-blue-600 hover:text-blue-700 ml-1">
              submit@civilaihub.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubmitToolPage;