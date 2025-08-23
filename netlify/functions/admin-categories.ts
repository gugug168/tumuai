import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function handler(event: any, _context: any) {
  // 只允许POST请求
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { action, data } = JSON.parse(event.body || '{}')

    function toSlug(name: string): string {
      const base = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      return base && base !== '-' ? base : `c-${Math.random().toString(36).slice(2, 8)}`
    }
    const authHeader = event.headers.authorization || event.headers.Authorization
    
    // 验证管理员权限
    if (!authHeader) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: '未提供认证信息' })
      }
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !userData.user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: '无效的认证信息' })
      }
    }

    // 检查是否是管理员
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (adminError || !adminData) {
      const { count } = await supabase
        .from('admin_users')
        .select('id', { count: 'exact', head: true })
      if (!count || count === 0) {
        await supabase.from('admin_users').insert([{ user_id: userData.user.id, role: 'super_admin', permissions: {} }])
      } else {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: '无管理员权限' })
        }
      }
    }

    let result

    switch (action) {
      case 'list': {
        const { data: categories, error: listError } = await supabase
          .from('categories')
          .select('*')
          .order('sort_order')
          .order('name')
        
        if (listError) throw listError
        result = categories
        break
      }

      case 'create':
        {
          const payloadWithSlug = {
            name: data.name,
            slug: data.slug || toSlug(data.name),
            description: data.description,
            icon: data.icon,
            color: data.color,
            sort_order: data.sort_order || 0,
            is_active: data.is_active !== false
          }
          let insertResp = await supabase.from('categories').insert([payloadWithSlug]).select().maybeSingle()
          if (insertResp.error) {
            const msg = insertResp.error.message || ''
            // 若后端无 slug 列，降级去掉 slug 重试
            if (/column\s+"slug"/i.test(msg)) {
              const payloadWithoutSlug = { ...payloadWithSlug } as any
              delete payloadWithoutSlug.slug
              insertResp = await supabase.from('categories').insert([payloadWithoutSlug]).select().maybeSingle()
            }
            // 若为 slug 唯一冲突，追加随机后缀重试
            if (insertResp.error && /(unique|duplicate).*slug|categories_slug_key/i.test(insertResp.error.message || '')) {
              const alt = { ...payloadWithSlug, slug: `${payloadWithSlug.slug}-${Math.random().toString(36).slice(2,6)}` }
              insertResp = await supabase.from('categories').insert([alt]).select().maybeSingle()
            }
            // 若为 name 唯一冲突，直接返回已存在记录
            if (insertResp.error && /(unique|duplicate).*name|categories_name_key/i.test(insertResp.error.message || '')) {
              const existing = await supabase.from('categories').select('*').eq('name', data.name).maybeSingle()
              if (!existing.error && existing.data) {
                result = existing.data
                break
              }
            }
          }
          if (insertResp.error) throw insertResp.error
          result = insertResp.data
        }
        break

      case 'update':
        {
          const payloadWithSlug = {
            name: data.name,
            slug: data.slug || toSlug(data.name),
            description: data.description,
            icon: data.icon,
            color: data.color,
            sort_order: data.sort_order,
            is_active: data.is_active,
            updated_at: new Date().toISOString()
          }
          let updateResp = await supabase.from('categories').update(payloadWithSlug).eq('id', data.id).select().maybeSingle()
          if (updateResp.error && /column\s+"slug"/i.test(updateResp.error.message || '')) {
            const payloadWithoutSlug = { ...payloadWithSlug } as any
            delete payloadWithoutSlug.slug
            updateResp = await supabase.from('categories').update(payloadWithoutSlug).eq('id', data.id).select().maybeSingle()
          }
          if (updateResp.error) throw updateResp.error
          result = updateResp.data
        }
        break

      case 'delete': {
        const { error: deleteError } = await supabase
          .from('categories')
          .delete()
          .eq('id', data.id)
        
        if (deleteError) throw deleteError
        result = { success: true, id: data.id }
        break
      }

      case 'getToolsByCategory': {
        const { data: tools, error: toolsError } = await supabase
          .from('tools')
          .select('id, name, category_id, status')
          .eq('category_id', data.categoryId)
        
        if (toolsError) throw toolsError
        result = tools
        break
      }

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: '无效的操作' })
        }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ success: true, data: result })
    }

  } catch (error) {
    console.error('管理员分类操作错误:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: '服务器内部错误', 
        details: error.message 
      })
    }
  }
}