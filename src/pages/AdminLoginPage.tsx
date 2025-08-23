import React, { useState } from 'react'
import { Shield, Mail, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { checkAdminStatus } from '../lib/admin'

const AdminLoginPage = () => {
  const [email, setEmail] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // 允许 admin/admin 快速登录（演示用途）。若是 admin/admin，则尝试以固定管理员邮箱登录
      const loginEmail = email.includes('@') ? email : 'admin@civilaihub.com'
      const loginPassword = email === 'admin' && password === 'admin123' ? 'admin123' : password
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })
      if (signInError) throw signInError

      // 简化验证流程：登录成功后直接跳转，让AdminDashboard处理权限验证
      console.log('✅ 登录成功，跳转到管理员页面')
      await new Promise(res => setTimeout(res, 500)) // 短暂等待确保会话保存
      window.location.assign('/admin')
    } catch (err: any) {
      setError(err?.message || '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-8">
        <div className="flex items-center mb-6">
          <Shield className="w-7 h-7 text-indigo-600" />
          <h1 className="ml-2 text-xl font-bold text-gray-900" data-testid="admin-login-title">管理员登录</h1>
        </div>
        {error && (
          <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm" data-testid="login-error">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="admin-login-form">
          <div>
            <label className="block text-sm text-gray-700 mb-2">账号</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin 或 邮箱"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                data-testid="admin-email-input"
                autoComplete="username"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-2">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="admin 或 实际密码"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                data-testid="admin-password-input"
                autoComplete="current-password"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
            data-testid="admin-login-button"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AdminLoginPage


