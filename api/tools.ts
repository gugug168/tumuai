import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const handler: Handler = async (event) => {
  try {
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing Supabase server config' })
      }
    }

    const limit = Math.min(parseInt(event.queryStringParameters?.limit || '60', 10), 200)

    const supabase = createClient(supabaseUrl, serviceKey)

    const { data, error } = await supabase
      .from('tools')
      .select('id,name,tagline,logo_url,categories,features,pricing,rating,views,upvotes,date_added')
      .eq('status', 'published')  // 只返回已发布的工具
      .order('upvotes', { ascending: false })
      .limit(limit)

    if (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      }
    }

    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=60'
      },
      body: JSON.stringify(data || [])
    }
  } catch (err: unknown) {
    const error = err as Error
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error?.message || 'Unexpected error' })
    }
  }
}

export { handler }


