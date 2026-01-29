// ============================================
// 批量浏览量更新 API
// ============================================
// 用于减少 N+1 查询问题，批量更新工具浏览量
// 支持延迟更新策略以减少数据库写入压力
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface IncrementRequest {
  toolIds: string[]
  delay?: number // 延迟更新毫秒数
}

interface IncrementResponse {
  success: boolean
  updated: number
  message?: string
}

// 内存缓存用于延迟更新
const viewUpdates = new Map<string, number>()
let flushTimeout: number | null = null

/**
 * 刷新待处理的浏览量更新到数据库
 */
async function flushUpdates() {
  if (viewUpdates.size === 0) return

  const updates = Array.from(viewUpdates.entries())
  viewUpdates.clear()

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // 批量更新 - 使用 RPC 函数更高效
    for (const [toolId, increment] of updates) {
      await supabase.rpc('increment_views', {
        tool_id: toolId,
        amount: increment
      })
    }

    console.log(`✅ Flushed ${updates.length} view updates`)
  } catch (error) {
    console.error('❌ Error flushing view updates:', error)
    // 失败时恢复到缓存
    for (const [toolId, increment] of updates) {
      viewUpdates.set(toolId, (viewUpdates.get(toolId) || 0) + increment)
    }
  }
}

/**
 * 延迟刷新
 */
function scheduleFlush(delay: number = 5000) {
  if (flushTimeout) clearTimeout(flushTimeout)
  flushTimeout = setTimeout(flushUpdates, delay)
}

/**
 * 处理 POST 请求 - 批量增加浏览量
 */
async function handleIncrement(req: Request): Promise<IncrementResponse> {
  try {
    const { toolIds, delay = 5000 }: IncrementRequest = await req.json()

    if (!Array.isArray(toolIds) || toolIds.length === 0) {
      return {
        success: false,
        updated: 0,
        message: 'Invalid tool IDs'
      }
    }

    // 记录到内存缓存
    for (const toolId of toolIds) {
      viewUpdates.set(toolId, (viewUpdates.get(toolId) || 0) + 1)
    }

    // 安排延迟刷新
    scheduleFlush(delay)

    return {
      success: true,
      updated: toolIds.length
    }
  } catch (error) {
    console.error('Error in handleIncrement:', error)
    return {
      success: false,
      updated: 0,
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * 处理 POST 请求 - 立即刷新
 */
async function handleFlush(): Promise<IncrementResponse> {
  try {
    const size = viewUpdates.size
    await flushUpdates()
    return {
      success: true,
      updated: size
    }
  } catch (error) {
    console.error('Error in handleFlush:', error)
    return {
      success: false,
      updated: 0,
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * 主处理函数
 */
serve(async (req) => {
  // CORS 处理
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    })
  }

  // 路由处理
  const url = new URL(req.url)
  const path = url.pathname

  try {
    if (path === '/api/increment-views' && req.method === 'POST') {
      const result = await handleIncrement(req)
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    if (path === '/api/increment-views/flush' && req.method === 'POST') {
      const result = await handleFlush()
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    return new Response('Not Found', { status: 404 })
  } catch (error) {
    console.error('API Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
})
