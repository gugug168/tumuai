// TypeScript 类型守卫工具
// 用于运行时类型检查和提高类型安全性

import type { Tool } from '../types';

// 基础类型守卫
export const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value);
};

export const isBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean';
};

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

export const isArray = <T>(value: unknown, itemGuard?: (item: unknown) => item is T): value is T[] => {
  if (!Array.isArray(value)) return false;
  if (itemGuard) {
    return value.every(itemGuard);
  }
  return true;
};

export const isNonEmptyString = (value: unknown): value is string => {
  return isString(value) && value.trim().length > 0;
};

export const isPositiveNumber = (value: unknown): value is number => {
  return isNumber(value) && value > 0;
};

export const isValidEmail = (value: unknown): value is string => {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
};

export const isValidUrl = (value: unknown): value is string => {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

// 工具相关的类型守卫
export const isValidPricing = (value: unknown): value is Tool['pricing'] => {
  return isString(value) && ['Free', 'Freemium', 'Paid', 'Trial'].includes(value);
};

export const isValidToolCategory = (value: unknown): value is string => {
  return isNonEmptyString(value) && value.length <= 50;
};

export const isValidToolFeature = (value: unknown): value is string => {
  return isNonEmptyString(value) && value.length <= 100;
};

export const isPartialTool = (value: unknown): value is Partial<Tool> => {
  if (!isObject(value)) return false;
  
  // 检查可选字段是否符合预期类型
  const tool = value as Record<string, unknown>;
  
  if (tool.id !== undefined && !isString(tool.id)) return false;
  if (tool.name !== undefined && !isNonEmptyString(tool.name)) return false;
  if (tool.tagline !== undefined && !isString(tool.tagline)) return false;
  if (tool.description !== undefined && !isString(tool.description)) return false;
  if (tool.website_url !== undefined && !isValidUrl(tool.website_url)) return false;
  if (tool.logo_url !== undefined && (tool.logo_url !== null && !isValidUrl(tool.logo_url))) return false;
  if (tool.pricing !== undefined && !isValidPricing(tool.pricing)) return false;
  if (tool.featured !== undefined && !isBoolean(tool.featured)) return false;
  if (tool.categories !== undefined && !isArray(tool.categories, isValidToolCategory)) return false;
  if (tool.features !== undefined && !isArray(tool.features, isValidToolFeature)) return false;
  if (tool.upvotes !== undefined && !isNumber(tool.upvotes)) return false;
  if (tool.views !== undefined && !isNumber(tool.views)) return false;
  if (tool.rating !== undefined && !isNumber(tool.rating)) return false;
  if (tool.review_count !== undefined && !isNumber(tool.review_count)) return false;
  
  return true;
};

export const isValidTool = (value: unknown): value is Tool => {
  if (!isObject(value)) return false;
  
  const tool = value as Record<string, unknown>;
  
  // 检查必需字段
  return (
    isString(tool.id) &&
    isNonEmptyString(tool.name) &&
    isString(tool.tagline) &&
    isValidUrl(tool.website_url) &&
    isValidPricing(tool.pricing) &&
    isBoolean(tool.featured) &&
    isArray(tool.categories, isValidToolCategory) &&
    isArray(tool.features, isValidToolFeature) &&
    isNumber(tool.upvotes) &&
    isNumber(tool.views) &&
    isNumber(tool.rating) &&
    isNumber(tool.review_count)
  );
};

// API 响应类型守卫
export const isApiErrorResponse = (value: unknown): value is { error: string; message?: string } => {
  return isObject(value) && isNonEmptyString((value as any).error);
};

export const isApiSuccessResponse = <T>(
  value: unknown,
  dataGuard: (data: unknown) => data is T
): value is { data: T; success: boolean } => {
  return (
    isObject(value) &&
    isBoolean((value as any).success) &&
    (value as any).success === true &&
    dataGuard((value as any).data)
  );
};

// 用户输入验证守卫
export const isValidSearchQuery = (value: unknown): value is string => {
  return isString(value) && value.trim().length >= 1 && value.length <= 100;
};

export const isValidSortOption = (value: unknown): value is string => {
  const validSortOptions = ['upvotes', 'date_added', 'rating', 'views', 'name'];
  return isString(value) && validSortOptions.includes(value);
};

export const isValidFilterValue = (value: unknown): value is string | string[] => {
  if (isString(value)) return true;
  return isArray(value, isString);
};

// 环境变量类型守卫
export const isValidEnvVar = (value: unknown): value is string => {
  return isNonEmptyString(value);
};

export const hasRequiredEnvVars = (vars: Record<string, unknown>): boolean => {
  const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  return required.every(key => isValidEnvVar(vars[key]));
};

// 实用工具函数
export const assertIsString = (value: unknown, fieldName: string): asserts value is string => {
  if (!isString(value)) {
    throw new Error(`Expected ${fieldName} to be a string, got ${typeof value}`);
  }
};

export const assertIsNumber = (value: unknown, fieldName: string): asserts value is number => {
  if (!isNumber(value)) {
    throw new Error(`Expected ${fieldName} to be a number, got ${typeof value}`);
  }
};

export const assertIsValidTool = (value: unknown): asserts value is Tool => {
  if (!isValidTool(value)) {
    throw new Error('Invalid tool object structure');
  }
};

// 安全的类型转换函数
export const safeParseInt = (value: unknown, fallback = 0): number => {
  if (isNumber(value)) return Math.floor(value);
  if (isString(value)) {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
};

export const safeParseFloat = (value: unknown, fallback = 0.0): number => {
  if (isNumber(value)) return value;
  if (isString(value)) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
};

export const safeStringify = (value: unknown): string => {
  if (isString(value)) return value;
  if (value === null || value === undefined) return '';
  return String(value);
};

// 数组安全操作
export const safeArrayAccess = <T>(array: T[], index: number): T | undefined => {
  if (!Array.isArray(array) || index < 0 || index >= array.length) {
    return undefined;
  }
  return array[index];
};

export const safeArrayFilter = <T>(
  array: unknown,
  predicate: (item: unknown) => item is T
): T[] => {
  if (!Array.isArray(array)) return [];
  return array.filter(predicate);
};

// 对象安全操作
export const safeObjectAccess = <T>(
  obj: unknown,
  key: string,
  guard: (value: unknown) => value is T
): T | undefined => {
  if (!isObject(obj)) return undefined;
  const value = obj[key];
  return guard(value) ? value : undefined;
};

// 深度克隆安全函数
export const safeDeepClone = <T>(obj: T): T => {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    // 如果JSON序列化失败，返回原对象（浅拷贝的风险）
    console.warn('Failed to deep clone object, returning original');
    return obj;
  }
};

// Promise 错误安全包装
export const safeAsync = async <T>(
  asyncFn: () => Promise<T>,
  fallback: T,
  onError?: (error: Error) => void
): Promise<T> => {
  try {
    return await asyncFn();
  } catch (error) {
    if (onError && error instanceof Error) {
      onError(error);
    }
    return fallback;
  }
};