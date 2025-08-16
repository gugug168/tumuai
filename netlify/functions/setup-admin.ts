import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const handler: Handler = async (event) => {
  try {
    const token = event.queryStringParameters?.token
    const allowed = process.env.ADMIN_SETUP_TOKEN
    if (!allowed || token !== allowed) {
      return { statusCode: 403, body: 'Forbidden' }
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) {
      return { statusCode: 500, body: 'Missing Supabase server config' }
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const email = 'admin@civilaihub.com'
    const password = 'admin'

    // Create or fetch user
    const { data: userData, error: adminErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    let userId = userData?.user?.id
    if (!userId) {
      // user exists, fetch it
      const { data: usersList, error: listErr } = await supabase.auth.admin.listUsers()
      if (listErr) return { statusCode: 500, body: listErr.message }
      userId = usersList.users.find(u => u.email === email)?.id
      if (!userId) return { statusCode: 500, body: 'Failed to locate admin user' }
    }

    // Ensure admin_users record
    const { error: upsertErr } = await supabase
      .from('admin_users')
      .upsert({
        user_id: userId,
        role: 'super_admin',
        permissions: {
          manage_tools: true,
          manage_users: true,
          manage_submissions: true,
          manage_admins: true,
          view_analytics: true,
          system_settings: true
        }
      }, { onConflict: 'user_id' })

    if (upsertErr) return { statusCode: 500, body: upsertErr.message }

    return { statusCode: 200, body: 'Admin ready' }
  } catch (err: any) {
    return { statusCode: 500, body: err?.message || 'Unexpected error' }
  }
}

export { handler }


