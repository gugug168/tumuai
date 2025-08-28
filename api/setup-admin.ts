import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = req.query?.token
    const allowed = process.env.ADMIN_SETUP_TOKEN
    if (!allowed || token !== allowed) {
      return res.status(403).send('Forbidden')
    }

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    if (!supabaseUrl || !serviceKey) {
      return res.status(500).send('Missing Supabase server config')
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const email = 'admin@civilaihub.com'
    // Supabase 默认最短密码长度为 6，故设置为 admin123
    const password = 'admin123'

    // Create or fetch user
    const { data: userData } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    let userId = userData?.user?.id
    if (!userId) {
      // user exists, fetch it
      const { data: usersList, error: listErr } = await supabase.auth.admin.listUsers()
      if (listErr) return res.status(500).send(listErr.message)
      userId = usersList.users.find(u => u.email === email)?.id
      if (!userId) return res.status(500).send('Failed to locate admin user')
    }

    // Ensure password is updated to desired value
    const { error: pwdErr } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true
    })
    if (pwdErr) return res.status(500).send(`Password update failed: ${pwdErr.message}`)

    // Ensure admin_users record (manually handle upsert without unique constraint)
    const { data: existingAdmin, error: selectErr } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (selectErr) return res.status(500).send(selectErr.message)

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
      if (updateErr) return res.status(500).send(updateErr.message)
    } else {
      const { error: insertErr } = await supabase
        .from('admin_users')
        .insert([{ user_id: userId, role: 'super_admin', permissions }])
      if (insertErr) return res.status(500).send(insertErr.message)
    }

    return res.status(200).send('Admin ready')
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).send(error?.message || 'Unexpected error')
  }
}


