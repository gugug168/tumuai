/**
 * Logo 提取 API
 * 从网站自动提取图标并更新到数据库
 */

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface LogoCandidate {
  url: string
  type: string
  size?: string
  quality: number
  isSvg?: boolean
}

/**
 * 带超时的 fetch 请求
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * 解析 HTML 提取所有图标候选
 */
function extractLogoCandidates(html: string, baseUrl: string): LogoCandidate[] {
  const candidates: LogoCandidate[] = []
  const base = new URL(baseUrl)

  // 匹配所有 link 标签中的图标
  const linkRegex = /<link\s+([^>]*?)>/gi
  let match

  while ((match = linkRegex.exec(html)) !== null) {
    const linkAttrs = match[1]
    const relMatch = linkAttrs.match(/rel=["']([^"']+)["']/i)
    const hrefMatch = linkAttrs.match(/href=["']([^"']+)["']/i)
    const sizesMatch = linkAttrs.match(/sizes=["']([^"']+)["']/i)
    const typeMatch = linkAttrs.match(/type=["']([^"']+)["']/i)

    if (!relMatch || !hrefMatch) continue

    const rel = relMatch[1]
    let href = hrefMatch[1]

    // 转换为绝对 URL
    if (!href.startsWith('http') && !href.startsWith('//')) {
      href = new URL(href, base.origin).href
    } else if (href.startsWith('//')) {
      href = base.protocol + href
    }

    // 检查是否是图标相关的 link
    const iconRels = ['icon', 'shortcut icon', 'apple-touch-icon', 'mask-icon', 'fluid-icon']
    if (!iconRels.some(r => rel.toLowerCase().includes(r))) continue

    // 计算质量分数
    let quality = 50
    let logoType = 'icon'

    if (rel.toLowerCase().includes('apple-touch-icon')) {
      quality = 95
      logoType = 'apple-touch-icon'
    } else if (typeMatch && typeMatch[1].includes('svg')) {
      quality = 100
      logoType = 'svg'
    } else if (href.endsWith('.svg')) {
      quality = 100
      logoType = 'svg'
    } else if (sizesMatch) {
      const size = parseInt(sizesMatch[1].split('x')[0])
      quality = 60 + Math.min(size / 10, 30)
      logoType = 'sized-icon'
    }

    candidates.push({
      url: href,
      type: logoType,
      size: sizesMatch?.[1],
      quality,
      isSvg: href.endsWith('.svg') || typeMatch?.[1].includes('svg')
    })
  }

  // 匹配 og:image
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
  if (ogImageMatch) {
    let ogImage = ogImageMatch[1]
    if (!ogImage.startsWith('http') && !ogImage.startsWith('//')) {
      ogImage = new URL(ogImage, base.origin).href
    } else if (ogImage.startsWith('//')) {
      ogImage = base.protocol + ogImage
    }
    candidates.push({
      url: ogImage,
      type: 'og-image',
      quality: 70
    })
  }

  // 按质量排序
  return candidates.sort((a, b) => b.quality - a.quality)
}

/**
 * 验证 logo URL 是否有效
 */
async function validateLogoUrl(logoUrl: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(logoUrl, { method: 'HEAD' }, 5000)
    return response.ok
  } catch {
    return false
  }
}

/**
 * 从网站 HTML 中提取高质量图标
 */
async function extractLogoFromHtml(websiteUrl: string): Promise<string | null> {
  console.log('🔍 开始提取网站图标:', websiteUrl)

  try {
    const url = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`)
    const origin = url.origin

    // 1. 抓取网站 HTML
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    let html: string
    try {
      const response = await fetch(origin, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml'
        }
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      html = await response.text()
    } catch (fetchError) {
      clearTimeout(timeoutId)
      console.warn('⚠️ 无法抓取网站HTML，使用备用方案:', fetchError)
      return getFallbackLogo(origin)
    }

    // 2. 提取图标候选
    const candidates = extractLogoCandidates(html, origin)

    if (candidates.length === 0) {
      console.log('❌ 未找到图标候选')
      return getFallbackLogo(origin)
    }

    console.log(`✅ 找到 ${candidates.length} 个图标候选`)

    // 3. 按优先级验证并返回第一个可用的
    for (const candidate of candidates) {
      if (await validateLogoUrl(candidate.url)) {
        console.log(`✅ 成功获取图标: ${candidate.type}`)
        return candidate.url
      }
    }

    // 4. 如果所有候选都失败，使用备用服务
    console.log('⚠️ 所有图标候选都无法访问，使用备用服务')
    return getFallbackLogo(origin)

  } catch (error) {
    console.error('❌ 提取图标失败:', error)
    return null
  }
}

/**
 * 获取备用图标
 */
function getFallbackLogo(websiteOrigin: string): string {
  const url = new URL(websiteOrigin)
  const domain = url.hostname
  return `https://cdn2.iconhorse.com/icons/${domain}.png`
}

/**
 * 验证管理员权限
 */
async function verifyAdmin(supabaseUrl: string, serviceKey: string, accessToken?: string) {
  const supabase = createClient(supabaseUrl, serviceKey)
  if (!accessToken) return null

  try {
    const { data: userRes, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !userRes?.user?.id) return null

    const userId = userRes.user.id
    const { data, error } = await supabase
      .from('admin_users')
      .select('id,user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !data) {
      // 若管理员表为空，自动引导当前用户为 super_admin
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
          return { id: inserted.data.id, userId: inserted.data.user_id }
        }
      }
      return null
    }

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

    // 仅在需要更新数据库时验证管理员权限
    const action = request.body?.action

    if (action === 'extract_from_url') {
      // 预览模式不需要管理员权限
      const { websiteUrl } = request.body || {}
      if (!websiteUrl) {
        return response.status(400).json({ error: 'Missing websiteUrl' })
      }

      const logoUrl = await extractLogoFromHtml(websiteUrl)
      return response.status(200).json({ logoUrl })
    }

    // 其他操作需要管理员权限
    const admin = await verifyAdmin(supabaseUrl, serviceKey, accessToken)
    if (!admin) {
      return response.status(403).json({ error: 'Forbidden' })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method Not Allowed' })
    }

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : (request.body || {})

    switch (action) {
      case 'extract_single': {
        const { toolId, websiteUrl } = body
        if (!toolId || !websiteUrl) {
          return response.status(400).json({ error: 'Missing toolId or websiteUrl' })
        }

        try {
          // 提取 logo
          const logoUrl = await extractLogoFromHtml(websiteUrl)

          if (!logoUrl) {
            return response.status(500).json({ error: 'Failed to extract logo' })
          }

          // 更新数据库
          const { error: updateError } = await supabase
            .from('tools')
            .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
            .eq('id', toolId)

          if (updateError) {
            console.error('Error updating tool logo:', updateError)
            return response.status(500).json({ error: updateError.message })
          }

          // 记录日志
          try {
            await supabase.from('admin_logs').insert([{
              admin_id: admin.id,
              action: 'refresh_tool_logo',
              target_type: 'tool',
              target_id: toolId,
              details: { logo_url: logoUrl },
              created_at: new Date().toISOString()
            }])
          } catch (logError) {
            console.error('Failed to log action:', logError)
          }

          return response.status(200).json({ success: true, logoUrl })
        } catch (error) {
          console.error('Error in extract_single:', error)
          const errorMessage = error instanceof Error ? error.message : 'Internal server error'
          return response.status(500).json({ error: errorMessage })
        }
      }

      case 'extract_batch': {
        const { toolIds } = body

        // 如果没有指定工具ID，获取所有缺失 logo 的工具
        let toolsToUpdate: Array<{ id: string; website_url: string }> = []

        if (Array.isArray(toolIds) && toolIds.length > 0) {
          // 获取指定工具
          const { data: tools, error } = await supabase
            .from('tools')
            .select('id, website_url')
            .in('id', toolIds)

          if (!error && tools) {
            toolsToUpdate = tools
          }
        } else {
          // 获取所有缺失或低质量 logo 的工具
          const { data: tools, error } = await supabase
            .from('tools')
            .select('id, website_url, logo_url')
            .or('logo_url.is.null,logo_url.eq.,logo_url.cs.{https://www.google.com/s2/favicons}')

          if (!error && tools) {
            toolsToUpdate = tools.map(t => ({ id: t.id, website_url: t.website_url }))
          }
        }

        const results: Array<{ toolId: string; logoUrl?: string; error?: string }> = []
        let updated = 0

        for (const tool of toolsToUpdate) {
          try {
            const logoUrl = await extractLogoFromHtml(tool.website_url)

            if (logoUrl) {
              const { error: updateError } = await supabase
                .from('tools')
                .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
                .eq('id', tool.id)

              if (!updateError) {
                updated++
                results.push({ toolId: tool.id, logoUrl })
              } else {
                results.push({ toolId: tool.id, error: updateError.message })
              }
            } else {
              results.push({ toolId: tool.id, error: 'Failed to extract logo' })
            }
          } catch (error) {
            results.push({
              toolId: tool.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        }

        // 记录批量操作日志
        try {
          await supabase.from('admin_logs').insert([{
            admin_id: admin.id,
            action: 'batch_refresh_tool_logos',
            target_type: 'tool',
            details: { updated, total: toolsToUpdate.length },
            created_at: new Date().toISOString()
          }])
        } catch (logError) {
          console.error('Failed to log batch action:', logError)
        }

        return response.status(200).json({
          success: true,
          total: toolsToUpdate.length,
          updated,
          results
        })
      }

      default:
        return response.status(400).json({ error: 'Unknown action' })
    }
  } catch (e: unknown) {
    console.error('Logo extract API error:', e)
    const err = e as Error
    return response.status(500).json({ error: err.message || 'Internal server error' })
  }
}
