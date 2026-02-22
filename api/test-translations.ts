/**
 * 测试翻译 API - 绕过缓存，显示详细调试信息
 */
import { createClient } from '@supabase/supabase-js'

type Lang = 'zh-CN' | 'en'

type ToolTranslationRow = {
  tool_id: string
  lang: string
  tagline: string | null
  description: string | null
  source_updated_at: string | null
}

type ToolLike = Record<string, unknown> & {
  id: string
  updated_at?: string | null
}

function normalizeLang(raw: string | null): Lang {
  return raw === 'en' ? 'en' : 'zh-CN'
}

async function fetchToolTranslations(
  supabase: ReturnType<typeof createClient>,
  toolIds: string[],
  lang: Lang
): Promise<{ map: Map<string, ToolTranslationRow> | null; debug: any }> {
  const debug: any = { lang, toolIdsCount: toolIds.length, step: 'start' }

  if (lang !== 'en') {
    debug.step = 'lang_not_en'
    return { map: null, debug }
  }
  if (toolIds.length === 0) {
    debug.step = 'no_tool_ids'
    return { map: new Map(), debug }
  }

  const { data, error } = await supabase
    .from('tool_translations')
    .select('tool_id,lang,tagline,description,source_updated_at')
    .eq('lang', lang)
    .in('tool_id', toolIds)

  debug.step = 'query_complete'
  debug.dataLength = data?.length
  debug.error = error?.message

  if (error) {
    if ((error as { code?: string }).code === '42P01') {
      debug.step = 'table_not_exist'
      return { map: null, debug }
    }
    if (error.message && error.message.includes('tool_translations')) {
      debug.step = 'table_error'
      return { map: null, debug }
    }
    throw new Error(error.message)
  }

  const rows = Array.isArray(data) ? (data as ToolTranslationRow[]) : []
  const map = new Map<string, ToolTranslationRow>()
  for (const row of rows) {
    if (row && row.tool_id) map.set(row.tool_id, row)
  }

  debug.mapSize = map.size
  debug.step = 'success'
  return { map, debug }
}

function applyTranslationsToTools(
  tools: ToolLike[],
  translations: Map<string, ToolTranslationRow> | null
): { tools: ToolLike[]; debug: any[] } {
  const debug: any[] = []

  if (!translations || translations.size === 0) {
    return { tools, debug: [{ step: 'no_translations' }] }
  }

  const result = tools.map((tool) => {
    const row = translations.get(tool.id)
    const d: any = {
      toolId: tool.id,
      toolName: tool.name,
      hasTranslation: !!row
    }

    if (!row) {
      debug.push({ ...d, step: 'no_translation_row' })
      return tool
    }

    const sourceUpdatedAt = row.source_updated_at || null
    const toolUpdatedAt = tool.updated_at || null
    d.sourceUpdatedAt = sourceUpdatedAt
    d.toolUpdatedAt = toolUpdatedAt
    d.timestampMatch = sourceUpdatedAt === toolUpdatedAt

    if (sourceUpdatedAt && toolUpdatedAt && sourceUpdatedAt !== toolUpdatedAt) {
      debug.push({ ...d, step: 'timestamp_mismatch' })
      return tool
    }

    debug.push({ ...d, step: 'translation_applied', translatedTagline: row.tagline?.substring(0, 30) })
    return {
      ...tool,
      tagline: row.tagline ?? tool.tagline,
      description: row.description ?? tool.description
    }
  })

  return { tools: result, debug }
}

export default async function handler(req: any, res: any) {
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

  const limit = Math.min(parseInt(req.query.limit) || 3, 10)
  const offset = parseInt(req.query.offset) || 0
  const lang = normalizeLang(req.query.lang || 'en')

  // 获取工具
  const { data: tools, error: toolsError } = await supabase
    .from('tools')
    .select('id, name, tagline, description, updated_at')
    .eq('status', 'published')
    .range(offset, offset + limit - 1)

  if (toolsError) {
    return res.status(500).json({ error: toolsError.message })
  }

  const toolList = (tools || []) as ToolLike[]

  // 获取翻译
  const { map: translations, debug: transDebug } = await fetchToolTranslations(
    supabase,
    toolList.map((t) => t.id).filter(Boolean),
    lang
  )

  // 应用翻译
  const { tools: resultTools, debug: applyDebug } = applyTranslationsToTools(toolList, translations)

  return res.status(200).json({
    params: { limit, offset, lang },
    toolsCount: toolList.length,
    translationDebug: transDebug,
    applyDebug,
    tools: resultTools.map(t => ({
      id: t.id,
      name: t.name,
      tagline: t.tagline?.substring(0, 60),
      description: t.description?.substring(0, 60),
      updated_at: t.updated_at
    })),
    timestamp: new Date().toISOString()
  })
}
