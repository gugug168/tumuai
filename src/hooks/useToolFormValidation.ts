import { useState, useCallback, useMemo } from 'react';
import type { DuplicateCheckResult } from '../lib/duplicate-checker';

export interface ToolFormData {
  toolName: string;
  officialWebsite: string;
  shortDescription: string;
  detailedDescription: string;
  categories: string[];
  mainFeatures: string;
  pricingModel: string;
  logoFile: File | null;
  submitterEmail: string;
}

export interface FormErrors {
  toolName?: string;
  officialWebsite?: string;
  shortDescription?: string;
  categories?: string;
  pricingModel?: string;
  logoFile?: string;
  submitterEmail?: string;
}

/**
 * useToolFormValidation - 表单验证 Hook
 *
 * 提供:
 * - 表单数据状态管理
 * - 表单验证逻辑
 * - 错误状态管理
 * - 步骤完成状态追踪
 */
export function useToolFormValidation() {
  const [formData, setFormData] = useState<ToolFormData>({
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

  const [errors, setErrors] = useState<FormErrors>({});
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateCheckResult | null>(null);

  // URL 验证函数
  const isValidUrl = useCallback((url: string): boolean => {
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      return true;
    } catch {
      return false;
    }
  }, []);

  // 处理输入变化
  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // 清除对应字段的错误
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name as keyof FormErrors];
        return newErrors;
      });
    }
  }, [errors]);

  // 处理分类变化
  const handleCategoryChange = useCallback((category: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));

    if (errors.categories) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.categories;
        return newErrors;
      });
    }
  }, [errors]);

  // 处理文件变化
  const handleFileChange = useCallback((file: File | null) => {
    setFormData(prev => ({
      ...prev,
      logoFile: file
    }));

    if (errors.logoFile) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.logoFile;
        return newErrors;
      });
    }
  }, [errors]);

  // 处理重复检测
  const handleDuplicateChange = useCallback((info: DuplicateCheckResult) => {
    setDuplicateInfo(info);

    if (info.exists) {
      setErrors(prev => ({
        ...prev,
        officialWebsite: '该网站已存在于平台中'
      }));
    } else {
      if (errors.officialWebsite) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.officialWebsite;
          return newErrors;
        });
      }
    }
  }, [errors]);

  // 表单验证
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // 工具名称验证
    if (!formData.toolName.trim()) {
      newErrors.toolName = '工具名称为必填项';
    }

    // 网址验证
    if (!formData.officialWebsite.trim()) {
      newErrors.officialWebsite = '官方网址为必填项';
    } else {
      // URL格式验证
      if (!isValidUrl(formData.officialWebsite)) {
        newErrors.officialWebsite = '请输入有效的网址格式';
      }

      // 重复检测验证
      if (duplicateInfo?.exists) {
        newErrors.officialWebsite = '该网站已存在于平台中，无法重复提交';
      }
    }

    // 简介验证
    if (!formData.shortDescription.trim()) {
      newErrors.shortDescription = '一句话简介为必填项';
    } else if (formData.shortDescription.length > 100) {
      newErrors.shortDescription = '简介不能超过100字';
    }

    // 分类验证
    if (formData.categories.length === 0) {
      newErrors.categories = '请至少选择一个分类';
    }

    // 定价验证
    if (!formData.pricingModel) {
      newErrors.pricingModel = '请选择定价模式';
    }

    // 邮箱格式验证（选填）
    if (formData.submitterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.submitterEmail)) {
      newErrors.submitterEmail = '请输入有效的邮箱地址';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, duplicateInfo, isValidUrl]);

  // 计算步骤完成状态
  const stepCompletion = useMemo(() => ({
    1: formData.officialWebsite.length > 0,
    2: formData.toolName.length > 0 && formData.shortDescription.length > 0,
    3: formData.categories.length > 0,
    4: formData.pricingModel.length > 0,
    5: false
  }), [formData]);

  // 当前步骤
  const currentStep = useMemo(() => {
    if (formData.officialWebsite.length === 0) return 1;
    if (formData.toolName.length === 0 || formData.shortDescription.length === 0) return 2;
    if (formData.categories.length === 0) return 3;
    if (formData.pricingModel.length === 0) return 4;
    return 5;
  }, [formData]);

  // 重置表单
  const resetForm = useCallback(() => {
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
    setErrors({});
    setDuplicateInfo(null);
  }, []);

  return {
    formData,
    setFormData,
    errors,
    duplicateInfo,
    stepCompletion,
    currentStep,
    handleInputChange,
    handleCategoryChange,
    handleFileChange,
    handleDuplicateChange,
    validateForm,
    resetForm,
    isValidUrl
  };
}
