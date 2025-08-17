import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

async function verifyAdmin(supabaseUrl: string, serviceKey: string, accessToken?: string) {
	const supabase = createClient(supabaseUrl, serviceKey)
	if (!accessToken) return null
	const { data: userRes } = await supabase.auth.getUser(accessToken)
	const userId = userRes?.user?.id
	if (!userId) return null
	const { data } = await supabase
		.from('admin_users')
		.select('id,user_id')
		.eq('user_id', userId)
		.maybeSingle()
	return data ? { userId } : null
}

const handler: Handler = async (event) => {
	try {
		const supabaseUrl = process.env.VITE_SUPABASE_URL as string
		const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
		if (!supabaseUrl || !serviceKey) {
			return { statusCode: 500, body: 'Missing Supabase server config' }
		}

		const authHeader = event.headers.authorization || event.headers.Authorization
		const accessToken = authHeader?.replace(/^Bearer\s+/i, '')
		const admin = await verifyAdmin(supabaseUrl, serviceKey, accessToken)
		if (!admin) return { statusCode: 403, body: 'Forbidden' }

		const supabase = createClient(supabaseUrl, serviceKey)
		const method = event.httpMethod.toUpperCase()
		if (method !== 'POST') {
			return { statusCode: 405, body: 'Method Not Allowed' }
		}

		const body = event.body ? JSON.parse(event.body) : {}
		const action = body?.action as string

		if (action === 'review_submission') {
			const { submissionId, status, adminNotes } = body || {}
			if (!submissionId || !status) return { statusCode: 400, body: 'Missing parameters' }

			// 拿到提交详情
			const { data: submission, error: fetchErr } = await supabase
				.from('tool_submissions')
				.select('*')
				.eq('id', submissionId)
				.maybeSingle()
			if (fetchErr) return { statusCode: 500, body: fetchErr.message }

			// 更新状态
			const { error: updErr } = await supabase
				.from('tool_submissions')
				.update({
					status,
					admin_notes: adminNotes || null,
					reviewed_by: admin.userId,
					reviewed_at: new Date().toISOString()
				})
				.eq('id', submissionId)
			if (updErr) return { statusCode: 500, body: updErr.message }

			// 审核通过则创建工具
			if (status === 'approved' && submission) {
				const insertObj: any = {
					name: submission.tool_name,
					tagline: submission.tagline,
					description: submission.description,
					website_url: submission.website_url,
					logo_url: submission.logo_url,
					categories: submission.categories || [],
					features: submission.features || [],
					pricing: submission.pricing || 'Free',
					featured: false,
					date_added: new Date().toISOString()
				}
				const { error: insErr } = await supabase.from('tools').insert([insertObj])
				if (insErr) return { statusCode: 500, body: insErr.message }
			}

			return { statusCode: 200, body: JSON.stringify({ ok: true }) }
		}

		if (action === 'create_tool') {
			const tool = body?.tool
			if (!tool?.name || !tool?.website_url) return { statusCode: 400, body: 'Missing fields' }
			const payload = {
				name: tool.name,
				tagline: tool.tagline || '',
				description: tool.description || '',
				website_url: tool.website_url,
				logo_url: tool.logo_url || null,
				categories: Array.isArray(tool.categories) ? tool.categories : [],
				features: Array.isArray(tool.features) ? tool.features : [],
				pricing: tool.pricing || 'Free',
				featured: !!tool.featured,
				date_added: new Date().toISOString()
			}
			const { data, error } = await supabase.from('tools').insert([payload]).select('id').maybeSingle()
			if (error) return { statusCode: 500, body: error.message }
			return { statusCode: 200, body: JSON.stringify({ id: data?.id }) }
		}

		if (action === 'update_tool') {
			const { id, updates } = body || {}
			if (!id || !updates) return { statusCode: 400, body: 'Missing id/updates' }
			const safe: any = {}
			for (const k of ['name','tagline','description','website_url','logo_url','categories','features','pricing','featured']) {
				if (k in updates) safe[k] = updates[k]
			}
			const { error } = await supabase.from('tools').update(safe).eq('id', id)
			if (error) return { statusCode: 500, body: error.message }
			return { statusCode: 200, body: JSON.stringify({ ok: true }) }
		}

		if (action === 'delete_tool') {
			const { id } = body || {}
			if (!id) return { statusCode: 400, body: 'Missing id' }
			const { error } = await supabase.from('tools').delete().eq('id', id)
			if (error) return { statusCode: 500, body: error.message }
			return { statusCode: 200, body: JSON.stringify({ ok: true }) }
		}

		return { statusCode: 400, body: 'Unknown action' }
	} catch (e: any) {
		return { statusCode: 500, body: e?.message || 'Unexpected error' }
	}
}

export { handler }


