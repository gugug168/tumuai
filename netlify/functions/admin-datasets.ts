import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

async function verifyAdmin(supabaseUrl: string, serviceKey: string, accessToken?: string) {
  const supabase = createClient(supabaseUrl, serviceKey)
  if (!accessToken) return null
  const { data: userRes } = await supabase.auth.getUser(accessToken)
  const userId = userRes?.user?.id
  if (!userId) return null
  const { data } = await supabase.from('admin_users').select('id,user_id').eq('user_id', userId).maybeSingle()
  return data ? { userId } : null
}

const handler: Handler = async (event) => {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) return { statusCode: 500, body: 'Missing Supabase server config' }

    const authHeader = event.headers.authorization || event.headers.Authorization
    const accessToken = authHeader?.replace(/^Bearer\s+/i, '')
    const admin = await verifyAdmin(supabaseUrl, serviceKey, accessToken)
    if (!admin) return { statusCode: 403, body: 'Forbidden' }

    const supabase = createClient(supabaseUrl, serviceKey)

    const [submissions, users, tools, logs] = await Promise.all([
      supabase.from('tool_submissions').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('user_profiles').select('id,user_id,email,full_name,avatar_url,created_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('tools').select('id,name,tagline,website_url,logo_url,categories,features,pricing,featured,date_added,upvotes,views,rating,review_count,created_at,updated_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('admin_logs').select('id,admin_id,action,target_type,target_id,details,ip_address,user_agent,created_at').order('created_at', { ascending: false }).limit(100)
    ])

    const body = {
      submissions: submissions.data || [],
      users: users.data || [],
      tools: tools.data || [],
      logs: logs.data || []
    }

    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || 'Unexpected error' }
  }
}

export { handler }


