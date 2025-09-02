import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) {
      return response.status(500).json({ error: 'Missing Supabase server config' })
    }

    const authHeader = request.headers.authorization || request.headers.Authorization
    const authHeaderStr = Array.isArray(authHeader) ? authHeader[0] : authHeader
    if (!authHeaderStr || !authHeaderStr.startsWith('Bearer ')) {
      return response.status(401).json({ error: 'Unauthorized' })
    }
    const accessToken = authHeaderStr.replace(/^Bearer\s+/i, '')

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: userRes, error: userErr } = await supabase.auth.getUser(accessToken)
    if (userErr || !userRes?.user) {
      return response.status(401).json({ error: 'Invalid token' })
    }
    const userId = userRes.user.id

    const { data, error } = await supabase
      .from('user_favorites')
      .select(`
        id,
        user_id,
        tool_id,
        created_at,
        tools (
          id,
          name,
          tagline,
          logo_url,
          categories,
          rating,
          pricing
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      return response.status(500).json({ error: error.message })
    }

    return response.status(200).json(data || [])
  } catch (e: unknown) {
    const error = e as Error
    return response.status(500).json({ 
      error: error?.message || 'Unexpected error' 
    })
  }
}