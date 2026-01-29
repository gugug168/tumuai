// ============================================
// 批量浏览量更新 API (Vercel Node.js)
// ============================================
// 用于减少 N+1 查询问题，批量更新工具浏览量
// ============================================

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface IncrementRequest {
  toolIds: string[]
}

interface IncrementResponse {
  success: boolean
  updated: number
  message?: string
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  // CORS 支持
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (request.method === 'OPTIONS') {
    return response.status(200).end()
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) {
      return response.status(500).json({ error: 'Missing Supabase config' })
    }

    const { toolIds }: IncrementRequest = request.body

    if (!Array.isArray(toolIds) || toolIds.length === 0) {
      return response.status(400).json({
        success: false,
        updated: 0,
        message: 'Invalid tool IDs'
      })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // 批量更新浏览量 - 使用 RPC 函数
    const updatePromises = toolIds.map(toolId =>
      supabase.rpc('increment_views', {
        tool_id: toolId,
        amount: 1
      })
    )

    await Promise.allSettled(updatePromises)

    return response.status(200).json({
      success: true,
      updated: toolIds.length
    } as IncrementResponse)
  } catch (error) {
    console.error('Increment views error:', error)
    return response.status(500).json({
      success: false,
      updated: 0,
      message: error instanceof Error ? error.message : 'Unknown error'
    } as IncrementResponse)
  }
}
