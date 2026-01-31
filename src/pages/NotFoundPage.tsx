import React from 'react'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full text-center">
        <p className="text-sm font-medium text-gray-500">404</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-bold text-gray-900">
          页面不存在
        </h1>
        <p className="mt-3 text-gray-600">
          你访问的地址可能已变更或被删除。你可以返回首页，或去工具库继续浏览。
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
          >
            返回首页
          </Link>
          <Link
            to="/tools"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-gray-900 hover:bg-gray-50 transition-colors"
          >
            浏览工具库
          </Link>
        </div>
      </div>
    </div>
  )
}

