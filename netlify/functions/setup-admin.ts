import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const handler: Handler = async (event) => {
  try {
    const token = event.queryStringParameters?.token
    const allowed = process.env.ADMIN_SETUP_TOKEN
    if (!allowed || token !== allowed) {
      return { statusCode: 403, body: 'Forbidden' }
    }

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) {
      return { statusCode: 500, body: 'Missing Supabase server config' }
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const email = 'admin@civilaihub.com'
    // Supabase 默认最短密码长度为 6，故设置为 admin123
    const password = 'admin123'

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

    // Ensure password is updated to desired value
    const { error: pwdErr } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true
    })
    if (pwdErr) return { statusCode: 500, body: `Password update failed: ${pwdErr.message}` }

    // Ensure admin_users record (manually handle upsert without unique constraint)
    const { data: existingAdmin, error: selectErr } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (selectErr) return { statusCode: 500, body: selectErr.message }

    const permissions = {
      manage_tools: true,
      manage_users: true,
      manage_submissions: true,
      manage_admins: true,
      view_analytics: true,
      system_settings: true
    }

    if (existingAdmin?.id) {
      const { error: updateErr } = await supabase
        .from('admin_users')
        .update({ role: 'super_admin', permissions })
        .eq('id', existingAdmin.id)
      if (updateErr) return { statusCode: 500, body: updateErr.message }
    } else {
      const { error: insertErr } = await supabase
        .from('admin_users')
        .insert([{ user_id: userId, role: 'super_admin', permissions }])
      if (insertErr) return { statusCode: 500, body: insertErr.message }
    }

    return { statusCode: 200, body: 'Admin ready' }
  } catch (err: any) {
    return { statusCode: 500, body: err?.message || 'Unexpected error' }
  }
}

export { handler }


