import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 检查环境变量是否已设置
if (!supabaseUrl) {
  console.error('Missing VITE_SUPABASE_URL environment variable')
  throw new Error('Missing VITE_SUPABASE_URL environment variable. Please check your .env file or Netlify environment variables.')
}

if (!supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY environment variable')
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable. Please check your .env file or Netlify environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true
  }
})

// 临时禁用RLS的客户端配置
// 注意：前端不再创建额外的 admin 客户端，以避免多 GoTrueClient 警告和不必要的权限暴露。

// 工具数据类型定义
export interface Tool {
  id: string
  name: string
  tagline: string
  description?: string
  website_url: string
  logo_url?: string
  categories: string[]
  features: string[]
  pricing: 'Free' | 'Freemium' | 'Paid' | 'Trial'
  featured: boolean
  date_added: string
  upvotes: number
  views: number
  rating: number
  review_count: number
  created_at: string
  updated_at: string
}

// 获取所有工具
export async function getTools(limit = 60) {
  try {
    // 优先走 Netlify Functions，降低 RLS/跨域影响
    const resp = await fetch(`/.netlify/functions/tools?limit=${limit}`, { cache: 'no-store' })
    if (resp.ok) {
      const json = await resp.json()
      return Array.isArray(json) ? json as Tool[] : []
    }
    // 兜底直连 Supabase
    const { data, error } = await supabase
      .from('tools')
      .select('id,name,tagline,logo_url,categories,features,pricing,rating,views,upvotes,date_added')
      .eq('status', 'published')  // 只获取已发布的工具
      .order('upvotes', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching tools:', error)
      throw error
    }

    return data as Tool[]
  } catch (error) {
    console.error('Unexpected error fetching tools:', error)
    throw error
  }
}

// 获取精选工具
export async function getFeaturedTools() {
  try {
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .eq('featured', true)
      .eq('status', 'published')  // 只获取已发布的精选工具
      .order('upvotes', { ascending: false })
      .limit(8)

    if (error) {
      console.error('Error fetching featured tools:', error)
      return []
    }

    return data as Tool[]
  } catch (error) {
    console.error('Unexpected error fetching featured tools:', error)
    return []
  }
}

// 获取最新工具
export async function getLatestTools() {
  try {
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .eq('status', 'published')  // 只获取已发布的最新工具
      .order('date_added', { ascending: false })
      .limit(12)

    if (error) {
      console.error('Error fetching latest tools:', error)
      return []
    }

    return data as Tool[]
  } catch (error) {
    console.error('Unexpected error fetching latest tools:', error)
    return []
  }
}

// 根据ID获取工具详情
export async function getToolById(id: string) {
  try {
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error(`Error fetching tool with id ${id}:`, error)
      return null
    }

    return data as Tool
  } catch (error) {
    console.error(`Unexpected error fetching tool with id ${id}:`, error)
    return null
  }
}

// 增加工具浏览量
export async function incrementToolViews(id: string) {
  try {
    const { error } = await supabase
      .from('tools')
      .update({ views: (supabase as any).sql`views + 1` })
      .eq('id', id)

    if (error) {
      console.error('Error incrementing views:', error)
    }
  } catch (error) {
    console.error('Unexpected error incrementing views:', error)
  }
}

// 搜索工具
export async function searchTools(query: string, filters?: {
  categories?: string[]
  features?: string[]
  pricing?: string
}) {
  try {
    let queryBuilder = supabase
      .from('tools')
      .select('*')
      .eq('status', 'published')  // 只搜索已发布的工具

    // 文本搜索
    if (query) {
      queryBuilder = queryBuilder.or(`name.ilike.%${query}%,tagline.ilike.%${query}%,description.ilike.%${query}%`)
    }

    // 分类筛选
    if (filters?.categories && filters.categories.length > 0) {
      queryBuilder = queryBuilder.overlaps('categories', filters.categories)
    }

    // 功能筛选
    if (filters?.features && filters.features.length > 0) {
      queryBuilder = queryBuilder.overlaps('features', filters.features)
    }

    // 定价筛选
    if (filters?.pricing) {
      queryBuilder = queryBuilder.eq('pricing', filters.pricing)
    }

    const { data, error } = await queryBuilder.order('upvotes', { ascending: false })

    if (error) {
      console.error('Error searching tools:', error)
      return []
    }

    return data as Tool[]
  } catch (error) {
    console.error('Unexpected error searching tools:', error)
    return []
  }
}

// 静态分类数据作为fallback
const fallbackCategories = [
  {
    id: 1,
    name: 'AI结构设计',
    description: '基于AI的结构设计与分析工具',
    icon: 'Brain',
    color: '#3B82F6'
  },
  {
    id: 2,
    name: 'BIM软件',
    description: '建筑信息模型设计与管理',
    icon: 'Layers',
    color: '#10B981'
  },
  {
    id: 3,
    name: '效率工具',
    description: '提升工作效率的专业工具',
    icon: 'Zap',
    color: '#F59E0B'
  },
  {
    id: 4,
    name: '岩土工程',
    description: '岩土工程分析与设计',
    icon: 'Mountain',
    color: '#8B5CF6'
  },
  {
    id: 5,
    name: '项目管理',
    description: '项目协作与管理工具',
    icon: 'Users',
    color: '#EF4444'
  },
  {
    id: 6,
    name: '智能施工管理',
    description: '施工过程管理与优化',
    icon: 'HardHat',
    color: '#06B6D4'
  }
];

// 获取分类列表
export async function getCategories() {
  try {
    console.log('🔍 开始获取分类数据...')
    
    // 首先尝试包含 is_active 条件的查询
    let { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    // 如果因为字段不存在而失败，则使用没有 is_active 条件的查询
    if (error && error.message.includes('is_active')) {
      console.log('⚠️ is_active字段不存在，使用简化查询...')
      const result = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true })
      
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('❌ Supabase查询失败:', error)
      console.log('🔄 使用fallback分类数据...')
      return fallbackCategories
    }

    // 如果数据为空或者很少，也使用fallback
    if (!data || data.length === 0) {
      console.log('📄 数据库中无分类数据，使用fallback分类数据...')
      return fallbackCategories
    }

    console.log('✅ 获取分类成功:', data.length, '个分类')
    return data
  } catch (error) {
    console.error('❌ 获取分类异常:', error)
    console.log('🔄 使用fallback分类数据...')
    return fallbackCategories
  }
}