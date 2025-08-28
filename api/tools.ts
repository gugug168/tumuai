import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) {
      return response.status(500).json({ error: 'Missing Supabase server config' })
    }

    const limitParam = request.query.limit as string
    const limit = Math.min(parseInt(limitParam || '60', 10), 200)

    const supabase = createClient(supabaseUrl, serviceKey)

    const { data, error } = await supabase
      .from('tools')
      .select('id,name,tagline,logo_url,categories,features,pricing,rating,views,upvotes,date_added')
      .eq('status', 'published')  // 只返回已发布的工具
      .order('upvotes', { ascending: false })
      .limit(limit)

    if (error) {
      return response.status(500).json({ error: error.message })
    }

    response.setHeader('Cache-Control', 'public, max-age=60')
    return response.status(200).json(data || [])
  } catch (err: unknown) {
    const error = err as Error
    return response.status(500).json({ 
      error: error?.message || 'Unexpected error' 
    })
  }
}