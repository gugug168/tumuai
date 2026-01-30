import { supabase } from './supabase';
import type { Category } from '../types';

interface CategoryCache {
  data: Category[];
  timestamp: number;
  version: string; // 用于检测数据库更新
}

/**
 * CategoryManager - 统一的分类数据管理器
 * 
 * 功能特性：
 * - 智能缓存：5分钟内复用缓存数据，提升性能
 * - 数据库优先：始终尝试从数据库获取最新数据
 * - 容错机制：数据库失败时使用最小化fallback
 * - 缓存失效：支持手动清除缓存，确保数据一致性
 */
export class CategoryManager {
  private static cache: CategoryCache | null = null;
  private static readonly CACHE_DURATION = 15 * 60 * 1000; // 15分钟缓存 (分类数据变化不频繁)
  
  // 紧急情况下的最小分类集（仅在数据库完全无法访问时使用）
  private static readonly EMERGENCY_FALLBACK: Category[] = [
    {
      id: 'emergency-1',
      name: 'AI结构设计',
      slug: 'ai-structural-design',
      description: '基于AI的结构设计工具',
      color: '#3B82F6',
      icon: 'Brain',
      parent_id: null,
      sort_order: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'emergency-2', 
      name: 'BIM软件',
      slug: 'bim-software',
      description: '建筑信息模型软件',
      color: '#10B981',
      icon: 'Layers',
      parent_id: null,
      sort_order: 2,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'emergency-3',
      name: '效率工具', 
      slug: 'efficiency-tools',
      description: '提升工作效率的工具',
      color: '#F59E0B',
      icon: 'Zap',
      parent_id: null,
      sort_order: 3,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  /**
   * 获取分类数据 - 智能缓存策略
   * @returns Promise<Category[]> 分类列表
   */
  static async getCategories(): Promise<Category[]> {
    try {
      // 检查缓存是否有效
      const now = Date.now();
      if (this.cache && (now - this.cache.timestamp < this.CACHE_DURATION)) {
        console.log('🚀 CategoryManager: 使用缓存数据', this.cache.data.length, '个分类');
        return this.cache.data;
      }

      console.log('🔄 CategoryManager: 缓存过期，从数据库获取最新数据...');
      
      // 从数据库获取最新数据
      const dbCategories = await this.fetchFromDatabase();
      
      if (dbCategories.length > 0) {
        // 更新缓存
        this.cache = {
          data: dbCategories,
          timestamp: now,
          version: this.generateVersionHash(dbCategories)
        };
        
        console.log('✅ CategoryManager: 数据库获取成功', dbCategories.length, '个分类');
        return dbCategories;
      }
      
      // 如果数据库返回空数据但没有错误，使用emergency fallback
      console.warn('⚠️ CategoryManager: 数据库返回空数据，使用emergency fallback');
      return this.EMERGENCY_FALLBACK;
      
    } catch (error) {
      console.error('❌ CategoryManager: 获取分类失败', error);
      
      // 如果有缓存数据，使用过期的缓存
      if (this.cache && this.cache.data.length > 0) {
        console.log('🔄 CategoryManager: 使用过期缓存数据');
        return this.cache.data;
      }
      
      // 最后的fallback
      console.log('🚨 CategoryManager: 使用emergency fallback');
      return this.EMERGENCY_FALLBACK;
    }
  }

  /**
   * 从数据库获取分类数据 - 优先使用服务端 API
   * @returns Promise<Category[]>
   */
  private static async fetchFromDatabase(): Promise<Category[]> {
    // 优先使用服务端 API (有 CDN 缓存，速度更快)
    try {
      console.log('🌐 CategoryManager: 尝试通过服务端 API 获取分类...');
      const response = await fetch('/api/categories-cache');

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ CategoryManager: 服务端 API 获取成功`, result.categories?.length, '个分类');
        return result.categories || [];
      }

      console.warn('⚠️ CategoryManager: 服务端 API 返回非成功状态，回退到直连数据库');
    } catch (apiError) {
      console.warn('⚠️ CategoryManager: 服务端 API 请求失败，回退到直连数据库:', apiError);
    }

    // 回退到直连数据库
    return await this.fetchDirectFromDatabase();
  }

  /**
   * 直接从 Supabase 数据库获取分类数据
   * @returns Promise<Category[]>
   */
  private static async fetchDirectFromDatabase(): Promise<Category[]> {
    // 首先尝试包含 is_active 条件的查询
    let { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    // 如果因为字段不存在而失败，则使用没有 is_active 条件的查询
    if (error && error.message.includes('is_active')) {
      console.log('⚠️ CategoryManager: is_active字段不存在，使用简化查询...');
      const result = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('❌ CategoryManager: 数据库查询失败:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * 生成数据版本哈希（简单实现）
   * @param categories 分类数据
   * @returns 版本哈希字符串
   */
  private static generateVersionHash(categories: Category[]): string {
    const dataString = categories.map(c => `${c.id}-${c.name}-${c.updated_at}`).join('|');
    // 使用简单的哈希算法，避免btoa对非ASCII字符的问题
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(16).substring(0, 16);
  }

  /**
   * 清除缓存 - 用于强制刷新数据
   */
  static clearCache(): void {
    console.log('🗑️ CategoryManager: 清除缓存');
    this.cache = null;
  }

  /**
   * 获取缓存状态信息 - 用于调试
   * @returns 缓存状态信息
   */
  static getCacheInfo(): {
    hasCache: boolean;
    cacheAge?: number;
    categoriesCount?: number;
    version?: string;
  } {
    if (!this.cache) {
      return { hasCache: false };
    }

    const now = Date.now();
    return {
      hasCache: true,
      cacheAge: now - this.cache.timestamp,
      categoriesCount: this.cache.data.length,
      version: this.cache.version
    };
  }

  /**
   * 检查缓存是否需要刷新
   * @returns 是否需要刷新
   */
  static needsRefresh(): boolean {
    if (!this.cache) return true;
    
    const now = Date.now();
    return (now - this.cache.timestamp) >= this.CACHE_DURATION;
  }
}

// 为管理员操作提供的缓存失效函数
export const invalidateCategoryCache = (): void => {
  CategoryManager.clearCache();
  console.log('🔄 分类缓存已失效，下次获取将从数据库重新加载');
};

// 导出简化的获取函数，保持向后兼容
export const getCategories = (): Promise<Category[]> => {
  return CategoryManager.getCategories();
};

export default CategoryManager;