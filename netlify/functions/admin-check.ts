import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const handler: Handler = async (event) => {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) {
      return { statusCode: 500, body: 'Missing Supabase server config' }
    }

    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, body: 'Unauthorized' }
    }
    const accessToken = authHeader.replace(/^Bearer\s+/i, '')

    const supabase = createClient(supabaseUrl, serviceKey)

    // Verify token and get user id
    const { data: userRes, error: userErr } = await supabase.auth.getUser(accessToken)
    if (userErr || !userRes?.user) {
      return { statusCode: 401, body: 'Invalid token' }
    }

    const userId = userRes.user.id

    const { data, error } = await supabase
      .from('admin_users')
      .select('id,user_id,role,permissions,created_at,updated_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      return { statusCode: 500, body: error.message }
    }

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data || null)
    }
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || 'Unexpected error' }
  }
}

export { handler }


