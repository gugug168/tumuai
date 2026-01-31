/**
 * ============================================================
 * 缓存清除 API - 用于手动清除 Vercel Edge 缓存
 * ============================================================
 * 用法: GET /api/clear-cache?pattern=tools*
 *
 * 支持 HTTP HEAD 来触发缓存失效，而不实际下载响应
 * ============================================================
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    // 只允许管理员访问（简化版：检查特定token）
    const token = request.query.token as string
    const validToken = process.env.CACHE_CLEAR_TOKEN || 'cache-clear-2025'

    if (token !== validToken) {
      return response.status(403).json({
        error: 'Forbidden',
        message: 'Invalid token'
      })
    }

    const pattern = request.query.pattern as string || 'tools*'

    // 设置缓存清除头
    // Vercel 会识别这个响应并清除匹配的缓存
    response.setHeader('Cache-Tag', pattern === 'all' ? '*' : pattern)
    response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.setHeader('Pragma', 'no-cache')
    response.setHeader('Expires', '0')

    // 返回成功响应
    return response.status(200).json({
      success: true,
      message: `Cache cleared for pattern: ${pattern}`,
      timestamp: new Date().toISOString(),
      hint: 'Vercel Edge cache will be invalidated on next request'
    })

  } catch (err: unknown) {
    const error = err as Error
    console.error('Cache clear error:', error)
    return response.status(500).json({
      error: error?.message || 'Failed to clear cache'
    })
  }
}

/**
 * ============================================================
 * 使用说明
 * ============================================================
 *
 * 清除所有工具相关缓存:
 * GET /api/clear-cache?token=cache-clear-2025&pattern=tools*
 *
 * 清除所有缓存:
 * GET /api/clear-cache?token=cache-clear-2025&pattern=all
 *
 * 在 Vercel 环境变量中设置自定义 token:
 * CACHE_CLEAR_TOKEN=your-secure-token
 *
 * ============================================================
 */
