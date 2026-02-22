import type { VercelRequest, VercelResponse } from '@vercel/node'

type SuggestedLocale = 'zh-CN' | 'en'

function normalizeHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(', ')
  return typeof value === 'string' ? value : ''
}

function parseAcceptLanguage(header: string): string[] {
  return header
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(';')[0]?.trim() || '')
    .filter(Boolean)
}

function suggestsChinese(acceptLanguages: string[]): boolean {
  return acceptLanguages.some((lang) => lang.toLowerCase() === 'zh' || lang.toLowerCase().startsWith('zh-'))
}

function countrySuggestsChinese(country: string): boolean {
  // Prefer Chinese for regions with high probability of zh users.
  return ['CN', 'HK', 'MO', 'TW', 'SG', 'MY'].includes(country.toUpperCase())
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store')

  const acceptLanguage = normalizeHeader(request.headers['accept-language'])
  const acceptLanguages = parseAcceptLanguage(acceptLanguage)

  const country = normalizeHeader(request.headers['x-vercel-ip-country']).toUpperCase()

  let suggestedLocale: SuggestedLocale = 'en'
  if (suggestsChinese(acceptLanguages) || countrySuggestsChinese(country)) {
    suggestedLocale = 'zh-CN'
  }

  return response.status(200).json({
    suggestedLocale,
    country: country || undefined
  })
}

