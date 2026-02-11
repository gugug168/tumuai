import React, { useState, useEffect } from 'react';
import { Upload, Tag, DollarSign, Image, FileText, AlertCircle, Sparkles, Check, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadToolLogo, validateImageFile } from '../lib/storage';
import { SUBMIT_PRICING_OPTIONS, EMERGENCY_CATEGORIES } from '../lib/config';
import { getCategories } from '../lib/supabase';
import { autoGenerateLogo, generateInitialLogo, extractLogoFromHtml } from '../lib/logoUtils';
import SmartURLInput from '../components/SmartURLInput';
import { useToast, createToastHelpers } from '../components/Toast';
import { useMetaTags } from '../hooks/useMetaTags';
import type { DuplicateCheckResult } from '../lib/duplicate-checker';

// 表单步骤定义
const FORM_STEPS = [
  { id: 1, title: 'AI智能填入', icon: Sparkles },
  { id: 2, title: '基本信息', icon: FileText },
  { id: 3, title: '分类功能', icon: Tag },
  { id: 4, title: '定价Logo', icon: DollarSign },
  { id: 5, title: '提交审核', icon: Upload }
];

// AI智能填入类型定义（与SmartURLInput保持一致）
interface AIAnalysisResult {
  name: string;
  tagline: string;
  description: string;
  features: string[];
  pricing: 'Free' | 'Freemium' | 'Paid' | 'Trial';
  categories: string[];
  confidence: number;
  reasoning: string;
}

const SubmitToolPage = () => {
  // Phase 1优化: 接入 useMetaTags hook
  useMetaTags({
    title: '提交新工具 - TumuAI.net',
    description: '发现优质的土木工程AI工具？与社区分享，帮助更多工程师提升工作效率。',
    canonical: 'https://www.tumuai.net/submit'
  });

  const { showToast } = useToast();
  const toast = createToastHelpers(showToast);

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
  const [showSuccess, setShowSuccess] = useState(false);

  // 动态分类数据状态
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // Logo 相关状态
  const [fetchedLogoUrl, setFetchedLogoUrl] = useState<string | null>(null);
  const [isFetchingLogo, setIsFetchingLogo] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  // 表单步骤状态跟踪
  const [currentStep, setCurrentStep] = useState(1);
  const [stepCompletion, setStepCompletion] = useState<Record<number, boolean>>({
    1: false, 2: false, 3: false, 4: false, 5: false
  });

  // 重复检测状态
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateCheckResult | null>(null);

  // 草稿恢复提示
  const [showDraftNotice, setShowDraftNotice] = useState(false);

  // Phase 3优化: 表单草稿自动保存 (LocalStorage)
  const DRAFT_KEY = 'submit_tool_draft';

  // 从草稿恢复（仅首次加载）
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        // 排除 logoFile（File 对象不能序列化）
        if (draft && typeof draft === 'object' && draft.toolName) {
          setFormData(prev => ({
            ...prev,
            toolName: draft.toolName || '',
            officialWebsite: draft.officialWebsite || '',
            shortDescription: draft.shortDescription || '',
            detailedDescription: draft.detailedDescription || '',
            categories: Array.isArray(draft.categories) ? draft.categories : [],
            mainFeatures: draft.mainFeatures || '',
            pricingModel: draft.pricingModel || '',
            submitterEmail: draft.submitterEmail || ''
          }));
          setShowDraftNotice(true);
        }
      }
    } catch (error) {
      console.warn('草稿恢复失败:', error);
    }
  }, []);

  // 自动保存草稿（防抖 3 秒）
  useEffect(() => {
    // 检查表单是否有内容
    const hasContent = formData.toolName || formData.officialWebsite ||
      formData.shortDescription || formData.detailedDescription ||
      formData.categories.length > 0 || formData.mainFeatures || formData.pricingModel;

    if (!hasContent) return;

    const timer = setTimeout(() => {
      try {
        // 排除 logoFile，File 对象无法序列化
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          ...formData,
          logoFile: undefined
        }));
      } catch {
        // LocalStorage 写入失败时静默处理
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [formData]);

  // 清除草稿
  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  };

  // 获取分类数据
  useEffect(() => {
    const loadCategories = async () => {
      try {
        console.log('🔄 SubmitToolPage: 开始获取分类数据...');
        setCategoriesLoading(true);
        const dbCategories = await getCategories();
        const categoryNames = dbCategories.map(c => c.name);
        setAvailableCategories(categoryNames);
        console.log('✅ SubmitToolPage: 获取分类成功', categoryNames.length, '个分类');
      } catch (error) {
        console.error('❌ SubmitToolPage: 获取分类失败:', error);
        // 使用emergency fallback
        setAvailableCategories([...EMERGENCY_CATEGORIES]);
        console.log('🚨 SubmitToolPage: 使用emergency分类');
      } finally {
        setCategoriesLoading(false);
      }
    };

    loadCategories();
  }, []);

  // 监听表单数据变化，更新步骤完成状态
  useEffect(() => {
    setStepCompletion({
      1: formData.officialWebsite.length > 0,
      2: formData.toolName.length > 0 && formData.shortDescription.length > 0,
      3: formData.categories.length > 0,
      4: formData.pricingModel.length > 0,
      5: false
    });

    // 更新当前步骤
    if (formData.officialWebsite.length === 0) {
      setCurrentStep(1);
    } else if (formData.toolName.length === 0 || formData.shortDescription.length === 0) {
      setCurrentStep(2);
    } else if (formData.categories.length === 0) {
      setCurrentStep(3);
    } else if (formData.pricingModel.length === 0) {
      setCurrentStep(4);
    } else {
      setCurrentStep(5);
    }
  }, [formData]);

  // 自动获取网站 Logo（防抖）
  useEffect(() => {
    const autoFetchLogo = async () => {
      if (formData.officialWebsite && isValidUrl(formData.officialWebsite)) {
        // 如果用户已上传文件，不自动覆盖
        if (formData.logoFile) return;

        setIsFetchingLogo(true);
        try {
          console.log('🔍 自动获取网站图标...');
          const logoUrl = await extractLogoFromHtml(formData.officialWebsite);

          if (logoUrl) {
            setFetchedLogoUrl(logoUrl);
            setLogoPreviewUrl(logoUrl);
            console.log('✅ 成功获取图标:', logoUrl);
          }
        } catch (error) {
          console.warn('⚠️ 自动获取图标失败:', error);
        } finally {
          setIsFetchingLogo(false);
        }
      } else {
        // 清空获取的图标
        setFetchedLogoUrl(null);
        if (!formData.logoFile) {
          setLogoPreviewUrl(null);
        }
      }
    };

    // 防抖：800ms 后执行
    const timeoutId = setTimeout(autoFetchLogo, 800);
    return () => clearTimeout(timeoutId);
  }, [formData.officialWebsite, formData.logoFile]);

  // URL 验证函数
  function isValidUrl(url: string): boolean {
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      return true;
    } catch {
      return false;
    }
  }

  // 手动刷新图标
  const handleRefreshLogo = async () => {
    if (!formData.officialWebsite || !isValidUrl(formData.officialWebsite)) {
      toast.error('无效网址', '请先输入有效的网站地址');
      return;
    }

    setIsFetchingLogo(true);
    try {
      const logoUrl = await extractLogoFromHtml(formData.officialWebsite);

      if (logoUrl) {
        setFetchedLogoUrl(logoUrl);
        setLogoPreviewUrl(logoUrl);
        toast.success('图标已更新', '成功从网站获取最新图标');
      } else {
        toast.error('获取失败', '无法从网站获取图标，请稍后重试');
      }
    } catch (error) {
      console.error('刷新图标失败:', error);
      toast.error('刷新失败', '请稍后重试');
    } finally {
      setIsFetchingLogo(false);
    }
  };

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

      // 创建预览 URL
      setLogoPreviewUrl(URL.createObjectURL(file));
      // 清除自动获取的图标
      setFetchedLogoUrl(null);

      if (errors.logoFile) {
        setErrors(prev => ({
          ...prev,
          logoFile: ''
        }));
      }
    }
  };

  // 处理重复检测结果
  const handleDuplicateChange = (info: DuplicateCheckResult) => {
    setDuplicateInfo(info);
    
    // 如果发现重复，设置错误状态
    if (info.exists) {
      setErrors(prev => ({
        ...prev,
        officialWebsite: '该网站已存在于平台中'
      }));
    } else {
      // 清除网站URL相关错误
      if (errors.officialWebsite) {
        setErrors(prev => ({
          ...prev,
          officialWebsite: ''
        }));
      }
    }
  };

  // AI智能填入完成处理
  const handleAIFillComplete = (data: AIAnalysisResult) => {
    console.log('AI分析结果:', data);
    
    // 自动填入表单数据
    setFormData(prev => ({
      ...prev,
      toolName: data.name || prev.toolName,
      shortDescription: data.tagline || prev.shortDescription,
      detailedDescription: data.description || prev.detailedDescription,
      categories: data.categories && data.categories.length > 0 ? data.categories : prev.categories,
      mainFeatures: data.features && data.features.length > 0 ? data.features.join(', ') : prev.mainFeatures,
      pricingModel: data.pricing ? data.pricing.toLowerCase() : prev.pricingModel
    }));
    
    // 显示成功提示
    const confidence = Math.round((data.confidence || 0) * 100);
    toast.success(
      'AI分析完成',
      `置信度: ${confidence}% | ${data.reasoning || '基于网站内容分析'}`
    );
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
      
      // 重复检测验证
      if (duplicateInfo?.exists) {
        newErrors.officialWebsite = '该网站已存在于平台中，无法重复提交';
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
      
      // 处理Logo：优先使用自动获取的，其次上传用户文件，最后生成
      let logoUrl = null;

      // 1. 优先使用自动获取的图标
      if (fetchedLogoUrl && !formData.logoFile) {
        console.log('✅ 使用自动获取的图标:', fetchedLogoUrl);
        logoUrl = fetchedLogoUrl;
      } else if (formData.logoFile) {
        // 2. 用户上传了Logo文件
        try {
          console.log('🖼️ 开始上传用户Logo文件:', formData.logoFile.name);
          logoUrl = await uploadToolLogo(formData.logoFile, formData.toolName);
          console.log('✅ 用户Logo上传成功:', logoUrl);
        } catch (uploadError) {
          console.error('❌ Logo上传失败:', uploadError);
          toast.error(
            '图片上传失败',
            `${(uploadError as Error).message}。建议：检查网络连接、确保图片小于5MB、尝试JPG/PNG格式`
          );
          return;
        }
      } else {
        // 3. 兜底：自动生成Logo
        try {
          console.log('🎨 开始自动生成Logo...');
          logoUrl = await autoGenerateLogo(formData.toolName, formData.officialWebsite, formData.categories);
          console.log('✅ 自动生成Logo成功:', logoUrl);
        } catch (logoError) {
          console.warn('⚠️ 自动Logo生成失败，使用默认生成:', logoError);
          // 兜底：使用简单的首字母生成
          logoUrl = generateInitialLogo(formData.toolName, formData.categories);
          console.log('🔤 使用首字母Logo生成');
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
        toast.error('提交失败', error.message);
        return;
      }

      console.log('提交成功:', data);

      // 显示成功庆祝动画
      setShowSuccess(true);

      // Phase 3优化: 提交成功后清除草稿
      clearDraft();

      // 3秒后重置表单并关闭成功状态
      setTimeout(() => {
        setShowSuccess(false);
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
        // 重置 Logo 相关状态
        setFetchedLogoUrl(null);
        setLogoPreviewUrl(null);
        setIsFetchingLogo(false);
        setStepCompletion({ 1: false, 2: false, 3: false, 4: false, 5: false });
        setCurrentStep(1);
      }, 3000);
      
    } catch (error) {
      console.error('提交过程中发生错误:', error);
      toast.error('提交失败', (error as Error).message);
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

          {/* Phase 3优化: 草稿恢复提示 */}
          {showDraftNotice && (
            <div className="mt-4 max-w-xl mx-auto p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-sm">
              <span className="text-blue-700">已恢复上次未完成的草稿</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowDraftNotice(false)}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  继续编辑
                </button>
                <button
                  onClick={() => {
                    clearDraft();
                    setFormData({
                      toolName: '', officialWebsite: '', shortDescription: '',
                      detailedDescription: '', categories: [], mainFeatures: '',
                      pricingModel: '', logoFile: null, submitterEmail: ''
                    });
                    setShowDraftNotice(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  丢弃草稿
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 步骤指示器 */}
        <div className="mb-8 hidden md:block">
          <div className="flex items-center justify-between">
            {FORM_STEPS.map((step) => {
              const IconComponent = step.icon;
              const isCompleted = stepCompletion[step.id];
              const isCurrent = currentStep === step.id;
              const isPast = currentStep > step.id;

              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isCurrent
                          ? 'bg-blue-600 text-white shadow-lg scale-110'
                          : isPast
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-6 h-6" />
                      ) : (
                        <IconComponent className="w-5 h-5" />
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium mt-2 transition-colors ${
                        isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < FORM_STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 max-w-24 transition-colors duration-300 ${
                        isCompleted || isPast ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    ></div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* 移动端步骤指示器 */}
        <div className="md:hidden mb-6">
          <div className="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm">
            {FORM_STEPS.map((step) => {
              const IconComponent = step.icon;
              const isCompleted = stepCompletion[step.id];
              const isCurrent = currentStep === step.id;

              return (
                <div key={step.id} className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <IconComponent className="w-4 h-4" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-center mt-2 text-sm text-gray-600">
            步骤 {currentStep} / {FORM_STEPS.length}: {FORM_STEPS[currentStep - 1].title}
          </div>
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

        {/* AI智能填入区域 */}
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl border border-blue-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">AI智能填入 (Beta)</h3>
                <p className="text-sm text-gray-600">输入网址，让AI帮您自动填写工具信息</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>实时重复检测</span>
            </div>
          </div>
          
          {/* 智能URL输入框 */}
          <div className="space-y-4">
            <SmartURLInput
              value={formData.officialWebsite}
              onChange={(url) => setFormData(prev => ({ ...prev, officialWebsite: url }))}
              onDuplicateChange={handleDuplicateChange}
              onAIFillComplete={handleAIFillComplete}
              enableAIFill={true}
              placeholder="输入工具网站地址，如：https://chatgpt.com"
              disabled={isSubmitting}
            />
            
            <div className="text-xs text-gray-600 mt-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
              <div className="flex items-start space-x-2">
                <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-800 mb-1">AI智能填入使用指南：</p>
                  <ul className="space-y-1 text-gray-600">
                    <li>• 输入有效URL后，系统将自动检测重复工具</li>
                    <li>• 检测通过后，点击"AI智能填入"按钮启动分析</li>
                    <li>• AI将自动抓取网站内容并生成工具信息</li>
                    <li>• 请在生成后仔细检查并完善相关信息</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submission Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基本信息 */}
            <div className={`p-8 border-b transition-all duration-300 ${
              currentStep >= 2 ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
            }`}>
              <div className="flex items-center mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 transition-all duration-300 ${
                  stepCompletion[2] ? 'bg-green-500 text-white' : currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {stepCompletion[2] ? <Check className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">基本信息</h3>
                {stepCompletion[2] && (
                  <span className="ml-auto text-sm text-green-600 flex items-center">
                    <Check className="w-4 h-4 mr-1" /> 已完成
                  </span>
                )}
              </div>
              
              <div className="max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  工具名称 *
                </label>
                <input
                  type="text"
                  name="toolName"
                  value={formData.toolName}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                    errors.toolName ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 hover:border-gray-400'
                  } bg-white text-gray-900 placeholder-gray-500`}
                  placeholder="例如：StructuralGPT"
                />
                {errors.toolName && (
                  <p className="mt-1 text-sm text-red-600">{errors.toolName}</p>
                )}
              </div>

              {/* 官方网址已移到AI智能填入区域 */}
              {duplicateInfo?.exists && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    ⚠️ 检测到网站重复，请返回上方修改网址或选择其他工具
                  </p>
                </div>
              )}

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
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
                    errors.shortDescription ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 hover:border-gray-400'
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-all duration-200 bg-white text-gray-900 placeholder-gray-500"
                  placeholder="详细描述工具的功能、特点、使用场景等..."
                />
              </div>
            </div>

            {/* 分类和功能 */}
            <div className={`p-8 border-b transition-all duration-300 ${
              currentStep >= 3 ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
            }`}>
              <div className="flex items-center mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 transition-all duration-300 ${
                  stepCompletion[3] ? 'bg-green-500 text-white' : currentStep === 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {stepCompletion[3] ? <Check className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">分类和功能</h3>
                {stepCompletion[3] && (
                  <span className="ml-auto text-sm text-green-600 flex items-center">
                    <Check className="w-4 h-4 mr-1" /> 已完成
                  </span>
                )}
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  选择分类 * <span className="text-gray-500">(可多选)</span>
                </label>
                {categoriesLoading ? (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                    加载分类数据中...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {availableCategories.map((category) => (
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
                )}
                {errors.categories && (
                  <p className="mt-2 text-sm text-red-600">{errors.categories}</p>
                )}
                {!categoriesLoading && availableCategories.length === 0 && (
                  <p className="mt-2 text-sm text-amber-600">
                    ⚠️ 暂时无法获取分类数据，请稍后重试
                  </p>
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-all duration-200 bg-white text-gray-900 placeholder-gray-500"
                  placeholder="用逗号分隔，例如：AI优化, 参数化设计, 成本估算"
                />
              </div>
            </div>

            {/* 定价和Logo */}
            <div className={`p-8 border-b transition-all duration-300 ${
              currentStep >= 4 ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
            }`}>
              <div className="flex items-center mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 transition-all duration-300 ${
                  stepCompletion[4] ? 'bg-green-500 text-white' : currentStep === 4 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {stepCompletion[4] ? <Check className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">定价和Logo</h3>
                {stepCompletion[4] && (
                  <span className="ml-auto text-sm text-green-600 flex items-center">
                    <Check className="w-4 h-4 mr-1" /> 已完成
                  </span>
                )}
              </div>
              
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
                    工具Logo (可选)
                  </label>

                  {/* Logo 预览区域 */}
                  {(logoPreviewUrl || fetchedLogoUrl) && (
                    <div className="mb-3 flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shadow-sm flex items-center justify-center">
                        <img
                          src={logoPreviewUrl || fetchedLogoUrl || undefined}
                          alt="Logo预览"
                          className="w-full h-full object-contain"
                          onError={() => setLogoPreviewUrl(null)}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700">
                          {formData.logoFile ? formData.logoFile.name : '自动获取的图标'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formData.logoFile ? '用户上传' : '来自网站自动提取'}
                        </p>
                      </div>
                      {fetchedLogoUrl && !formData.logoFile && (
                        <button
                          type="button"
                          onClick={handleRefreshLogo}
                          disabled={isFetchingLogo}
                          className="p-2 text-blue-600 hover:text-blue-700 disabled:opacity-50"
                          title="刷新图标"
                        >
                          <RefreshCw className={`w-4 h-4 ${isFetchingLogo ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* 自动获取状态 */}
                  {isFetchingLogo && (
                    <div className="mb-3 flex items-center text-sm text-blue-600">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                      正在从网站获取图标...
                    </div>
                  )}

                  {/* 上传区域 */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="relative flex-1">
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

                      {/* 手动刷新按钮 */}
                      {formData.officialWebsite && (
                        <button
                          type="button"
                          onClick={handleRefreshLogo}
                          disabled={isFetchingLogo}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                          title="从网站重新获取图标"
                        >
                          <RefreshCw className={`w-4 h-4 mr-1 ${isFetchingLogo ? 'animate-spin' : ''}`} />
                          刷新
                        </button>
                      )}
                    </div>

                    {errors.logoFile && (
                      <p className="mt-1 text-sm text-red-600">{errors.logoFile}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      支持 JPG、PNG 格式，文件大小不超过 5MB
                    </p>
                    <p className="mt-1 text-xs text-blue-600">
                      💡 输入网址后会自动获取图标，也可点击"刷新"按钮手动获取
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 联系信息 */}
            <div className="p-8">
              <div className="flex items-center mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 transition-all duration-300 ${
                  currentStep === 5 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  <Upload className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">联系信息（选填）</h3>
              </div>
              
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
            <div className="pt-6 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                完成度: <span className="font-semibold text-blue-600">{Object.values(stepCompletion).filter(Boolean).length} / 5</span>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-8 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-105"
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

      {/* 成功庆祝动画 */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">提交成功！</h2>
            <p className="text-gray-600 mb-4">
              工具提交成功！我们会在1-3个工作日内审核，审核结果将通过邮件通知您。
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
              <span>正在自动关闭...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmitToolPage;
