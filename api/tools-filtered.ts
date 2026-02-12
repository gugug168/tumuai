import type { VercelRequest, VercelResponse } from '@vercel/node'
import publicApiHandler from './public-api'

function withAction(request: VercelRequest, action: string): void {
  const base = `http://${request.headers.host || 'localhost'}`
  const url = new URL(request.url || '/', base)
  url.searchParams.set('action', action)
  request.url = `${url.pathname}${url.search}`
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  withAction(request, 'tools-filtered')
  return publicApiHandler(request, response)
}

