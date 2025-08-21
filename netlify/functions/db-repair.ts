import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function handler(event, context) {
  // 处理OPTIONS预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    }
  }

  try {
    // 验证管理员权限（兼容大小写）
    const authHeader = event.headers.authorization || event.headers.Authorization
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
      // 若 admin_users 为空，自动引导首位登录用户为 super_admin
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

    console.log('开始执行数据库修复...')

    // 1. 修复categories表结构（加入 slug 唯一列）
    console.log('修复categories表...')
    await supabase.rpc('exec_sql', {
      sql: `
        -- 删除现有表并重新创建
        DROP TABLE IF EXISTS categories CASCADE;
        
        CREATE TABLE categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL UNIQUE,
          slug VARCHAR(255) UNIQUE,
          description TEXT,
          color VARCHAR(7) DEFAULT '#3B82F6',
          icon VARCHAR(50) DEFAULT 'Folder',
          parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
          sort_order INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    }).catch(e => console.log('Categories表已存在或无需修复'))

    // 2. 插入8个土木行业分类（生成 slug）
    console.log('插入8个土木行业分类...')
    function toSlug(name: string): string {
      const base = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      return base && base !== '-' ? base : `c-${Math.random().toString(36).slice(2, 8)}`
    }
    const categories = [
      { name: '结构设计', slug: toSlug('结构设计'), description: '建筑结构设计与分析工具', color: '#EF4444', icon: 'Building2', sort_order: 1 },
      { name: '建筑设计', slug: toSlug('建筑设计'), description: '建筑设计与建模软件', color: '#F97316', icon: 'Home', sort_order: 2 },
      { name: '施工管理', slug: toSlug('施工管理'), description: '项目管理和施工协调工具', color: '#10B981', icon: 'Construction', sort_order: 3 },
      { name: '造价预算', slug: toSlug('造价预算'), description: '工程造价与预算计算工具', color: '#8B5CF6', icon: 'Calculator', sort_order: 4 },
      { name: 'BIM建模', slug: toSlug('BIM建模'), description: '建筑信息模型与协作平台', color: '#06B6D4', icon: 'Box', sort_order: 5 },
      { name: '岩土工程', slug: toSlug('岩土工程'), description: '地质分析与基础设计工具', color: '#84CC16', icon: 'Mountain', sort_order: 6 },
      { name: '市政工程', slug: toSlug('市政工程'), description: '道路、桥梁、管网设计工具', color: '#F59E0B', icon: 'Road', sort_order: 7 },
      { name: '效率工具', slug: toSlug('效率工具'), description: '通用办公与效率提升工具', color: '#64748B', icon: 'Zap', sort_order: 8 }
    ]

    for (const category of categories) {
      await supabase.from('categories').upsert(category as any, { onConflict: 'name' })
    }

    // 3. 修复tool_submissions表
    console.log('修复tool_submissions表...')
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE tool_submissions 
        ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id),
        ADD COLUMN IF NOT EXISTS admin_notes TEXT,
        ADD COLUMN IF NOT EXISTS reviewed_by UUID,
        ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;
      `
    }).catch(e => console.log('tool_submissions表字段已存在'))

    // 4. 修复tools表
    console.log('修复tools表...')
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE tools 
        ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);
        
        -- 添加外键约束
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'tools_category_id_fkey' AND table_name = 'tools'
          ) THEN
            ALTER TABLE tools 
            ADD CONSTRAINT tools_category_id_fkey 
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `
    }).catch(e => console.log('tools表字段已存在'))

    // 5. 创建修复函数
    console.log('创建修复函数...')
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION approve_tool_submission(
          submission_id UUID,
          admin_notes TEXT DEFAULT NULL
        ) RETURNS TABLE (
          tool_id UUID,
          tool_name VARCHAR
        ) AS $$
        BEGIN
          -- 更新提交状态
          UPDATE tool_submissions 
          SET status = 'approved', 
              reviewed_at = NOW(),
              admin_notes = COALESCE(approve_tool_submission.admin_notes, admin_notes)
          WHERE id = submission_id;

          -- 创建正式工具记录
          RETURN QUERY
          INSERT INTO tools (
            name, tagline, description, website_url, logo_url,
            categories, features, pricing, category_id,
            status, upvotes, views, favorites_count, reviews_count, comments_count
          )
          SELECT 
            tool_name, tagline, description, website_url, logo_url,
            categories, features, pricing, category_id,
            'published', 0, 0, 0, 0, 0
          FROM tool_submissions 
          WHERE id = submission_id
          RETURNING id, tool_name;
        END;
        $$ LANGUAGE plpgsql;

        CREATE OR REPLACE FUNCTION manage_category(
          action_type VARCHAR,
          category_data JSONB
        ) RETURNS JSONB AS $$
        DECLARE
          result JSONB;
        BEGIN
          CASE action_type
            WHEN 'create' THEN
              INSERT INTO categories (name, description, color, icon, sort_order)
              VALUES (
                category_data->>'name',
                category_data->>'description',
                COALESCE(category_data->>'color', '#3B82F6'),
                COALESCE(category_data->>'icon', 'Folder'),
                COALESCE((category_data->>'sort_order')::INTEGER, 0)
              )
              RETURNING row_to_json(categories.*) INTO result;
              
            WHEN 'update' THEN
              UPDATE categories 
              SET 
                name = category_data->>'name',
                description = category_data->>'description',
                color = COALESCE(category_data->>'color', color),
                icon = COALESCE(category_data->>'icon', icon),
                sort_order = COALESCE((category_data->>'sort_order')::INTEGER, sort_order),
                is_active = COALESCE((category_data->>'is_active')::BOOLEAN, is_active),
                updated_at = NOW()
              WHERE id = (category_data->>'id')::UUID
              RETURNING row_to_json(categories.*) INTO result;
              
            WHEN 'delete' THEN
              DELETE FROM categories 
              WHERE id = (category_data->>'id')::UUID
              RETURNING jsonb_build_object('deleted', true, 'id', id) INTO result;
              
            WHEN 'list' THEN
              SELECT jsonb_agg(row_to_json(categories.*)) INTO result
              FROM categories ORDER BY sort_order, name;
          END CASE;
          
          RETURN result;
        END;
        $$ LANGUAGE plpgsql;
      `
    }).catch(e => console.log('函数已存在'))

    // 6. 验证修复结果
    const { data: categoriesCount } = await supabase
      .from('categories')
      .select('*', { count: 'exact' })

    const { data: allCategories } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order')

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type'
      },
      body: JSON.stringify({
        success: true,
        message: '数据库修复完成',
        categoriesCount: categoriesCount?.length || 0,
        categories: allCategories,
        repairDetails: {
          categoriesCreated: categories.length,
          tablesFixed: ['categories', 'tool_submissions', 'tools'],
          functionsCreated: ['approve_tool_submission', 'manage_category']
        }
      })
    }

  } catch (error) {
    console.error('数据库修复错误:', error)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type'
      },
      body: JSON.stringify({
        error: '数据库修复失败',
        details: error.message
      })
    }
  }
}