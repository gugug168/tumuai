import type { VercelRequest, VercelResponse } from '@vercel/node'

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  setCors(response)

  if (request.method === 'OPTIONS') {
    return response.status(200).end()
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : (request.body || {})
    const url = typeof body?.url === 'string' ? body.url : ''
    const userAgent = typeof body?.userAgent === 'string' ? body.userAgent : ''
    const total = Array.isArray(body?.errors) ? body.errors.length : 0

    // Keep logs short to avoid noisy function logs.
    console.log('[client-error-report]', {
      url,
      userAgent: userAgent.slice(0, 120),
      total,
      timestamp: new Date().toISOString(),
    })

    return response.status(200).json({ success: true })
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message || 'Invalid payload'
    return response.status(400).json({ success: false, error: message })
  }
}

