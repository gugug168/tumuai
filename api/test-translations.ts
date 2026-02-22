/**
 * 测试翻译 API - 绕过缓存
 * 仅用于调试，不缓存响应
 */
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // 禁用所有缓存
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('CDN-Cache-Control', 'no-store')
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  })

  const limit = Math.min(parseInt(req.query.limit) || 5, 20)
  const lang = req.query.lang || 'en'

  // 获取工具
  const { data: tools, error: toolsError } = await supabase
    .from('tools')
    .select('id, name, tagline, description, updated_at')
    .eq('status', 'published')
    .limit(limit)

  if (toolsError) {
    return res.status(500).json({ error: toolsError.message })
  }

  // 获取翻译
  const toolIds = tools.map(t => t.id)
  const { data: translations, error: transError } = await supabase
    .from('tool_translations')
    .select('tool_id, lang, tagline, description, source_updated_at')
    .eq('lang', lang)
    .in('tool_id', toolIds)

  if (transError) {
    return res.status(500).json({ error: transError.message })
  }

  // 合并翻译
  const transMap = new Map((translations || []).map(t => [t.tool_id, t]))

  const result = tools.map(tool => {
    const trans = transMap.get(tool.id)
    return {
      id: tool.id,
      name: tool.name,
      tagline_zh: tool.tagline,
      tagline_en: trans?.tagline || null,
      description_zh: tool.description?.substring(0, 100) + '...',
      description_en: trans?.description?.substring(0, 100) + '...' || null,
      timestamp_match: trans ? trans.source_updated_at === tool.updated_at : null
    }
  })

  return res.status(200).json({
    total_tools: tools.length,
    total_translations: translations?.length || 0,
    lang,
    tools: result,
    timestamp: new Date().toISOString()
  })
}
