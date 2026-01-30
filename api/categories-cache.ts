/**
 * ============================================================
 * Vercel API 代理层 - 分类数据缓存
 * ============================================================
 * 功能：
 * - 服务端获取分类数据，避免客户端直连 Supabase
 * - 使用 Cache-Control 头实现 CDN 层缓存
 * - 所有用户共享同一份缓存，大幅降低数据库负载
 * ============================================================
 */

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  color: string
  icon: string | null
  parent_id: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface CategoriesCacheResponse {
  categories: Category[]
  cached: boolean
  timestamp: string
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    // 1. 获取 Supabase 配置
    const supabaseUrl = process.env.VITE_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

    if (!supabaseUrl || !serviceKey) {
      console.error('Missing Supabase server config')
      return response.status(500).json({
        error: 'Server configuration error'
      })
    }

    // 2. 创建 Supabase 客户端（使用服务端密钥）
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false
      }
    })

    // 3. 查询分类数据 - 首先尝试包含 is_active 条件
    let { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    // 4. 如果因为字段不存在而失败，使用简化查询
    if (error && error.message.includes('is_active')) {
      console.log('⚠️ Categories API: is_active字段不存在，使用简化查询...')
      const result = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true })

      data = result.data
      error = result.error
    }

    // 5. 错误处理
    if (error) {
      console.error('Supabase error:', error)
      return response.status(500).json({
        error: 'Failed to fetch categories'
      })
    }

    // 6. 构建响应
    const result: CategoriesCacheResponse = {
      categories: data || [],
      cached: false,
      timestamp: new Date().toISOString()
    }

    // 7. 设置缓存头（Vercel Edge + CDN 缓存）
    // - s-maxage: CDN 缓存 10 分钟 (分类数据变化不频繁)
    // - stale-while-revalidate: 后台刷新期间可使用过期缓存 5 分钟
    response.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=300')

    // 8. 添加额外的缓存优化头
    response.setHeader('CDN-Cache-Control', 'public, s-maxage=600')
    response.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=600')

    return response.status(200).json(result)

  } catch (err: unknown) {
    const error = err as Error
    console.error('Categories cache API error:', error)
    return response.status(500).json({
      error: error?.message || 'Unexpected error'
    })
  }
}

/**
 * ============================================================
 * 使用说明
 * ============================================================
 *
 * 1. 在 Vercel 部署后，此 API 自动启用 Edge Runtime
 * 2. 响应会被 Vercel Edge Network 缓存 10 分钟
 * 3. 所有用户共享同一份缓存，大幅降低数据库负载
 *
 * 调用示例：
 * GET /api/categories-cache
 *
 * 4. 要强制刷新缓存，可以添加时间戳参数：
 * GET /api/categories-cache?_t=1234567890
 * ============================================================
 */
