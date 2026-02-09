/**
 * 刷新统计数据物化视图
 * 用于定时刷新 tools_stats 物化视图，保持计数数据最新
 *
 * 端点: POST /api/refresh-stats
 * 用途: Vercel Cron Job 或手动触发刷新
 *
 * Cron 配置 (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/refresh-stats",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  // 只允许 POST 请求或 Cron 触发
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  // 简单的安全验证：检查是否有 Authorization header 或来自 Vercel Cron
  const authHeader = request.headers.authorization
  const isVercelCron = request.headers['x-vercel-cron'] === 'true'

  if (!authHeader && !isVercelCron) {
    return response.status(401).json({ error: 'Unauthorized' })
  }

  // 验证 Authorization header (如果提供)
  if (authHeader && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(403).json({ error: 'Forbidden' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  if (!supabaseUrl || !serviceKey) {
    return response.status(500).json({ error: 'Server configuration error' })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  })

  try {
    // 调用刷新函数
    const { error } = await supabase.rpc('refresh_tools_stats')

    if (error) {
      console.error('Failed to refresh tools_stats:', error)
      return response.status(500).json({ error: 'Failed to refresh stats', details: error.message })
    }

    // 获取最新统计数据
    const { data: stats } = await supabase
      .from('tools_stats')
      .select('*')
      .single()

    return response.status(200).json({
      success: true,
      message: 'Stats refreshed successfully',
      stats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Refresh stats error:', error)
    return response.status(500).json({ error: 'Internal server error' })
  }
}
