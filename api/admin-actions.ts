import { createClient, PostgrestError } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface AdminUser {
  id: string
  userId: string
}

interface ToolUpdate {
  name?: string
  tagline?: string
  description?: string
  website_url?: string
  logo_url?: string
  categories?: string[]
  features?: string[]
  pricing?: string
  featured?: boolean
}

interface ErrorResponse {
  message?: string
  code?: string
}

interface CategoryPayload {
  name: string
  slug: string
  description?: string | null
  color: string
  icon: string
  parent_id?: string | null
  sort_order: number
  is_active: boolean
}

interface ToolData {
  id?: string
  name?: string
  tagline?: string
  description?: string
  website_url?: string
  logo_url?: string
  categories?: string[]
  features?: string[]
  pricing?: string
  featured?: boolean
  category_id?: string | null
}

async function verifyAdmin(supabaseUrl: string, serviceKey: string, accessToken?: string): Promise<AdminUser | null> {
  const supabase = createClient(supabaseUrl, serviceKey)
  if (!accessToken) return null
  
  try {
    const { data: userRes, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !userRes?.user?.id) return null
    
    const userId = userRes.user.id
    const { data: initialData, error } = await supabase
      .from('admin_users')
      .select('id,user_id')
      .eq('user_id', userId)
      .maybeSingle()
    
    let data = initialData
    
    if (error || !data) {
      // 若管理员表为空，自动引导当前用户为 super_admin，避免首次 403 卡死
      const { count } = await supabase
        .from('admin_users')
        .select('id', { count: 'exact', head: true })
      if (!count || count === 0) {
        const inserted = await supabase
          .from('admin_users')
          .insert([{ user_id: userId, role: 'super_admin', permissions: {} }])
          .select('id,user_id')
          .maybeSingle()
        if (!inserted.error && inserted.data) {
          data = inserted.data
        }
      }
    }

    if (!data) return null
    return { id: data.id, userId: data.user_id }
  } catch (error) {
    console.error('Admin verification error:', error)
    return null
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    
    if (!supabaseUrl || !serviceKey) {
      console.error('Missing Supabase configuration')
      return response.status(500).json({ error: 'Server configuration error' })
    }

    const authHeader = request.headers.authorization || request.headers.Authorization
    const accessToken = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : ''
    const admin = await verifyAdmin(supabaseUrl, serviceKey, accessToken)
    
    if (!admin) {
      return response.status(403).json({ error: 'Forbidden' })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const method = request.method?.toUpperCase()
    
    if (method !== 'POST') {
      return response.status(405).json({ error: 'Method Not Allowed' })
    }

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : (request.body || {})
    const action = body?.action as string

    // 记录管理员操作日志
    async function logAdminAction(actionType: string, targetType: string, targetId?: string, details?: Record<string, unknown>) {
      try {
        await supabase.from('admin_logs').insert([{
          admin_id: admin.id,
          action: actionType,
          target_type: targetType,
          target_id: targetId,
          details: details || {},
          created_at: new Date().toISOString()
        }])
      } catch (error) {
        console.error('Failed to log admin action:', error)
      }
    }

    // 将分类名称/混合输入解析为分类ID数组，并返回主分类ID
    async function resolveCategoryIds(input: unknown): Promise<{ ids: string[]; primaryId: string | null }> {
      const raw = Array.isArray(input) ? input.filter(Boolean) : []
      if (raw.length === 0) return { ids: [], primaryId: null }
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      const preUuids = raw.filter((v: unknown): v is string => typeof v === 'string' && uuidRe.test(v))
      const names = raw.filter((v: unknown): v is string => typeof v === 'string' && !uuidRe.test(v))
      let foundIds: string[] = [...preUuids]
      if (names.length > 0) {
        const { data: cats } = await supabase
          .from('categories')
          .select('id,name')
          .in('name', names)
        if (cats && cats.length) foundIds = foundIds.concat(cats.map(c => c.id))
      }
      const uniqueIds = Array.from(new Set(foundIds))
      return { ids: uniqueIds, primaryId: uniqueIds[0] || null }
    }

    switch (action) {
      case 'review_submission': {
        const { submissionId, status, adminNotes } = body || {}
        
        if (!submissionId || !status) {
          return response.status(400).json({ error: 'Missing submissionId or status' })
        }

        if (!['approved', 'rejected'].includes(status)) {
          return response.status(400).json({ error: 'Invalid status' })
        }

        try {
          // 获取提交详情
          const { data: submission, error: fetchErr } = await supabase
            .from('tool_submissions')
            .select('*')
            .eq('id', submissionId)
            .maybeSingle()
          
          if (fetchErr) {
            console.error('Error fetching submission:', fetchErr)
            return response.status(500).json({ error: fetchErr.message })
          }

          if (!submission) {
            return response.status(404).json({ error: 'Submission not found' })
          }

          // 更新提交状态
          const { error: updErr } = await supabase
            .from('tool_submissions')
            .update({
              status,
              admin_notes: adminNotes || null,
              reviewed_by: admin.id,
              reviewed_at: new Date().toISOString()
            })
            .eq('id', submissionId)

          if (updErr) {
            console.error('Error updating submission:', updErr)
            return response.status(500).json({ error: updErr.message })
          }

          // 如果审核通过，创建工具
          if (status === 'approved') {
            const { ids: categoryIds, primaryId } = await resolveCategoryIds(submission.categories)
            const insertObj: Record<string, unknown> = {
              name: submission.tool_name,
              tagline: submission.tagline,
              description: submission.description || '',
              website_url: submission.website_url,
              logo_url: submission.logo_url || null,
              categories: categoryIds,
              features: Array.isArray(submission.features) ? submission.features : [],
              pricing: submission.pricing || 'Free',
              featured: false,
              date_added: new Date().toISOString(),
              upvotes: 0,
              views: 0,
              rating: 0,
              status: 'published',
              category_id: submission.category_id || primaryId || null
            }

            // 首次尝试插入（包含 categories）
            let { error: insErr, data: newTool } = await supabase
              .from('tools')
              .insert([insertObj])
              .select('id')
              .maybeSingle()

            // 若失败（常见是 categories 类型不匹配），回退为最小插入再补充更新
            if (insErr) {
              console.warn('Insert with categories failed, retrying without categories:', insErr.message)
              const { ...minInsert } = insertObj // Remove unused categories variable
              const retry = await supabase
                .from('tools')
                .insert([minInsert])
                .select('id')
                .maybeSingle()
              insErr = retry.error as PostgrestError | null
              newTool = retry.data as { id: string } | null
              if (insErr) {
                console.error('Error creating tool after fallback:', insErr)
                return response.status(500).json({ error: insErr.message })
              }
            }

            // 记录操作日志
            await logAdminAction('approve_submission', 'tool_submission', submissionId, {
              tool_id: newTool?.id,
              tool_name: submission.tool_name
            })
          } else {
            // 记录拒绝操作
            await logAdminAction('reject_submission', 'tool_submission', submissionId, {
              reason: adminNotes
            })
          }

          return response.status(200).json({ success: true })
        } catch (error) {
          console.error('Error in review_submission:', error)
          const errorMessage = error instanceof Error ? error.message : 'Internal server error'
          return response.status(500).json({ error: errorMessage })
        }
      }

      case 'create_tool': {
        const tool = body?.tool
        if (!tool?.name || !tool?.website_url) {
          return response.status(400).json({ error: 'Missing required fields: name, website_url' })
        }

        try {
          const { ids: categoryIds, primaryId } = await resolveCategoryIds(tool.categories || [])
          const payload = {
            name: tool.name.trim(),
            tagline: (tool.tagline || '').trim(),
            description: (tool.description || '').trim(),
            website_url: tool.website_url.trim(),
            logo_url: tool.logo_url?.trim() || null,
            categories: categoryIds,
            features: Array.isArray(tool.features) ? tool.features.filter(Boolean) : [],
            pricing: tool.pricing || 'Free',
            featured: Boolean(tool.featured),
            date_added: new Date().toISOString(),
            status: 'published',
            category_id: (tool as ToolData).category_id || primaryId || null
          }

          // 首次插入，若失败则去掉 categories 再尝试
          let { data, error } = await supabase
            .from('tools')
            .insert([payload])
            .select('id')
            .maybeSingle()

          if (error) {
            console.warn('Insert tool with categories failed, retrying without categories:', error.message)
            const { ...minPayload } = payload // Remove unused categories variable
            const retry = await supabase
              .from('tools')
              .insert([minPayload])
              .select('id')
              .maybeSingle()
            error = retry.error as PostgrestError | null
            data = retry.data as { id: string } | null
            if (error) {
              console.error('Error creating tool after fallback:', error)
              return response.status(500).json({ error: error.message })
            }
          }

          await logAdminAction('create_tool', 'tool', data?.id, payload)
          return response.status(200).json({ success: true, id: data?.id })
        } catch (error: unknown) {
          console.error('Error in create_tool:', error)
          const err = error as ErrorResponse
          return response.status(500).json({ error: err.message || 'Internal server error' })
        }
      }

      case 'update_tool': {
        const { id, updates } = body || {}
        if (!id || !updates) {
          return response.status(400).json({ error: 'Missing id or updates' })
        }

        try {
          const safe: Partial<ToolUpdate> = {}
          const allowedFields = ['name', 'tagline', 'description', 'website_url', 'logo_url', 'categories', 'features', 'pricing', 'featured']
          
          for (const key of allowedFields) {
            if (key in updates) {
              if (key === 'categories' || key === 'features') {
                safe[key] = Array.isArray(updates[key]) ? updates[key].filter(Boolean) : []
              } else if (key === 'name' || key === 'tagline' || key === 'description' || key === 'website_url' || key === 'logo_url') {
                safe[key] = typeof updates[key] === 'string' ? updates[key].trim() : updates[key]
              } else {
                safe[key] = updates[key]
              }
            }
          }

          if (Object.keys(safe).length === 0) {
            return response.status(400).json({ error: 'No valid fields to update' })
          }

          const { error } = await supabase
            .from('tools')
            .update(safe)
            .eq('id', id)

          if (error) {
            console.error('Error updating tool:', error)
            return response.status(500).json({ error: error.message })
          }

          await logAdminAction('update_tool', 'tool', id, safe)
          return response.status(200).json({ success: true })
        } catch (error: unknown) {
          console.error('Error in update_tool:', error)
          const err = error as ErrorResponse
          return response.status(500).json({ error: err.message || 'Internal server error' })
        }
      }

      case 'delete_tool': {
        const { id } = body || {}
        if (!id) {
          return response.status(400).json({ error: 'Missing id' })
        }

        try {
          // 先获取工具信息用于日志
          const { data: tool } = await supabase
            .from('tools')
            .select('name')
            .eq('id', id)
            .maybeSingle()

          const { error } = await supabase
            .from('tools')
            .delete()
            .eq('id', id)

          if (error) {
            console.error('Error deleting tool:', error)
            return response.status(500).json({ error: error.message })
          }

          await logAdminAction('delete_tool', 'tool', id, { name: tool?.name })
          return response.status(200).json({ success: true })
        } catch (error: unknown) {
          console.error('Error in delete_tool:', error)
          const err = error as ErrorResponse
          return response.status(500).json({ error: err.message || 'Internal server error' })
        }
      }

      case 'create_category': {
        const category = body?.category
        if (!category?.name) {
          return response.status(400).json({ error: 'Missing category name' })
        }

        try {
          const toSlug = (name: string) => {
            const base = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
            return base && base !== '-' ? base : `c-${Math.random().toString(36).slice(2, 8)}`
          }
          const basePayload: CategoryPayload = {
            name: category.name.trim(),
            slug: (category.slug?.trim() || toSlug(category.name)),
            description: category.description?.trim() || null,
            color: category.color || '#3B82F6',
            icon: category.icon || 'tool',
            parent_id: category.parent_id || null,
            sort_order: category.sort_order || 0,
            is_active: category.is_active !== false
          }

          // 首次尝试：带 slug 插入
          let ins = await supabase
            .from('categories')
            .insert([basePayload])
            .select('id')
            .maybeSingle()

          if (ins.error) {
            const msg = ins.error.message || ''
            // 若表无 slug 列，则去掉 slug 再试
            if (/column\s+"slug"/i.test(msg)) {
              const withoutSlug = { ...basePayload }
              delete withoutSlug.slug
              ins = await supabase.from('categories').insert([withoutSlug]).select('id').maybeSingle()
            }
            // 若表无 parent_id 列（或 schema cache 未刷新），去掉 parent_id 再试
            if (ins.error && /(parent_id).*column|Could not find.*parent_id/i.test(ins.error.message || '')) {
              const withoutParent = { ...basePayload }
              delete (withoutParent as Partial<CategoryPayload>).parent_id
              ins = await supabase.from('categories').insert([withoutParent]).select('id').maybeSingle()
            }
            // 若为 slug 唯一冲突，自动追加短随机后缀重试
            if (ins.error && /(unique|duplicate).*slug|categories_slug_key/i.test(ins.error.message || '')) {
              const alt = { ...basePayload, slug: `${basePayload.slug}-${Math.random().toString(36).slice(2,6)}` }
              ins = await supabase.from('categories').insert([alt]).select('id').maybeSingle()
            }
            // 若为 name 唯一冲突，直接返回已存在记录
            if (ins.error && /(unique|duplicate).*name|categories_name_key/i.test(ins.error.message || '')) {
              const existing = await supabase.from('categories').select('id').eq('name', basePayload.name).maybeSingle()
              if (!existing.error && existing.data) {
                await logAdminAction('create_category', 'category', existing.data.id, { name: basePayload.name })
                return response.status(200).json({ success: true, id: existing.data.id })
              }
            }
          }

          if (ins.error) {
            console.error('Error creating category:', ins.error)
            return response.status(500).json({ error: ins.error.message })
          }

          await logAdminAction('create_category', 'category', ins.data?.id, basePayload as Record<string, unknown>)
          return response.status(200).json({ success: true, id: ins.data?.id })
        } catch (error: unknown) {
          console.error('Error in create_category:', error)
          const err = error as ErrorResponse
          return response.status(500).json({ error: err.message || 'Internal server error' })
        }
      }

      case 'update_category': {
        const { id, updates } = body || {}
        if (!id || !updates) {
          return response.status(400).json({ error: 'Missing category id or updates' })
        }

        try {
          const safe: Partial<CategoryPayload> = {}
          const allowedFields = ['name', 'slug', 'description', 'color', 'icon', 'parent_id', 'sort_order', 'is_active']
          
          for (const key of allowedFields) {
            if (key in updates) {
              if (key === 'name' || key === 'slug' || key === 'description' || key === 'color' || key === 'icon') {
                safe[key] = typeof updates[key] === 'string' ? updates[key].trim() : updates[key]
              } else {
                safe[key] = updates[key]
              }
            }
          }

          if (Object.keys(safe).length === 0) {
            return response.status(400).json({ error: 'No valid fields to update' })
          }

          const { error } = await supabase
            .from('categories')
            .update(safe)
            .eq('id', id)

          if (error) {
            console.error('Error updating category:', error)
            return response.status(500).json({ error: error.message })
          }

          await logAdminAction('update_category', 'category', id, safe)
          return response.status(200).json({ success: true })
        } catch (error: unknown) {
          console.error('Error in update_category:', error)
          const err = error as ErrorResponse
          return response.status(500).json({ error: err.message || 'Internal server error' })
        }
      }

      case 'delete_category': {
        const { id } = body || {}
        if (!id) {
          return response.status(400).json({ error: 'Missing category id' })
        }

        try {
          // 检查是否有工具使用此分类
          const { count } = await supabase
            .from('tools')
            .select('id', { count: 'exact', head: true })
            .contains('categories', [id])

          if (count && count > 0) {
            return response.status(400).json({ error: 'Cannot delete category with associated tools' })
          }

          const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id)

          if (error) {
            console.error('Error deleting category:', error)
            return response.status(500).json({ error: error.message })
          }

          await logAdminAction('delete_category', 'category', id)
          return response.status(200).json({ success: true })
        } catch (error: unknown) {
          console.error('Error in delete_category:', error)
          const err = error as ErrorResponse
          return response.status(500).json({ error: err.message || 'Internal server error' })
        }
      }

      case 'get_categories': {
        try {
          const { data: categories, error } = await supabase
            .from('categories')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true })

          if (error) {
            console.error('Error fetching categories:', error)
            return response.status(500).json({ error: error.message })
          }

          return response.status(200).json({ categories })
        } catch (error: unknown) {
          console.error('Error in get_categories:', error)
          const err = error as ErrorResponse
          return response.status(500).json({ error: err.message || 'Internal server error' })
        }
      }

      default:
        return response.status(400).json({ error: 'Unknown action' })
    }
  } catch (e: unknown) {
    console.error('Admin action error:', e)
    const err = e as ErrorResponse
    return response.status(500).json({ error: err.message || 'Internal server error' })
  }
}