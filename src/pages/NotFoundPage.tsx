import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLocale } from '../contexts/LocaleContext'

export default function NotFoundPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const localizePath = (path: string) => {
    if (locale !== 'en') return path
    if (path === '/') return '/en'
    return `/en${path}`
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full text-center">
        <p className="text-sm font-medium text-gray-500">404</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-bold text-gray-900">
          {t('notFound.title')}
        </h1>
        <p className="mt-3 text-gray-600">
          {t('notFound.description')}
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={localizePath('/')}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
          >
            {t('notFound.backHome')}
          </Link>
          <Link
            to={localizePath('/tools')}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-gray-900 hover:bg-gray-50 transition-colors"
          >
            {t('notFound.browseTools')}
          </Link>
        </div>
      </div>
    </div>
  )
}
