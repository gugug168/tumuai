import { supabase } from './supabase-client';
import type { Category } from '../types';

/**
 * CategoryManager
 *
 * Responsibilities:
 * - Fetch categories (API first, DB fallback, emergency fallback)
 *
 * NOTE:
 * - Caching + request de-dup is handled by `unifiedCache` in `src/lib/supabase.ts`
 *   to avoid multiple independent caching layers fighting each other.
 */
export class CategoryManager {
  // Emergency fallback used only when both API + DB fail or return empty.
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

  static async getCategories(): Promise<Category[]> {
    try {
      const categories = await this.fetchFromApiOrDb();
      return categories.length > 0 ? categories : this.EMERGENCY_FALLBACK;
    } catch (error) {
      console.error('❌ CategoryManager: 获取分类失败', error);
      return this.EMERGENCY_FALLBACK;
    }
  }

  private static async fetchFromApiOrDb(): Promise<Category[]> {
    const isDev = import.meta.env.DEV;

    // 1) Prefer Vercel API (CDN cached) in production.
    if (!isDev) {
      try {
        const response = await fetch('/api/categories-cache');
        if (response.ok) {
          const result = await response.json();
          return result.categories || [];
        }
        throw new Error(`API returned ${response.status}`);
      } catch (apiError) {
        // 2) Fallback to direct Supabase query
        console.warn('⚠️ CategoryManager: 服务端 API 获取失败，回退到直连数据库:', apiError);
      }
    }

    // 2) Direct Supabase query
    // Try query with is_active first (some older schemas may not have it).
    let { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error && error.message.includes('is_active')) {
      const fallback = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      throw error;
    }

    return data || [];
  }
}

// Backwards-compatible named export.
export const getCategories = (): Promise<Category[]> => CategoryManager.getCategories();

export default CategoryManager;
