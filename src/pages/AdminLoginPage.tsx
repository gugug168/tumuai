import React, { useState } from 'react'
import { Shield, Mail, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { checkAdminStatus } from '../lib/admin'

const AdminLoginPage = () => {
  const [email, setEmail] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [performanceInfo, setPerformanceInfo] = useState<{
    loginTime?: number
    authTime?: number
    totalTime?: number
  } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setPerformanceInfo(null)
    
    const totalStartTime = Date.now()
    
    try {
      // 允许 admin/admin 快速登录（演示用途）。若是 admin/admin，则尝试以固定管理员邮箱登录
      const loginEmail = email.includes('@') ? email : 'admin@civilaihub.com'
      const loginPassword = email === 'admin' && password === 'admin123' ? 'admin123' : password
      
      // 监控登录认证时间
      const authStartTime = Date.now()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })
      const authTime = Date.now() - authStartTime
      
      if (signInError) throw signInError

      // 监控权限检查时间
      const permissionStartTime = Date.now()
      console.log('✅ 登录成功，准备验证管理员权限...')
      
      // 验证管理员权限
      const adminStatus = await checkAdminStatus()
      if (!adminStatus) {
        throw new Error('您不是管理员用户，无法访问管理后台。请联系系统管理员申请权限。')
      }
      console.log('✅ 管理员权限验证成功:', adminStatus.role)
      
      const permissionTime = Date.now() - permissionStartTime
      
      const totalTime = Date.now() - totalStartTime
      
      // 记录性能信息
      const perfInfo = {
        authTime,
        permissionTime,
        totalTime
      }
      setPerformanceInfo(perfInfo)
      
      console.log('⚡ 登录性能统计:', perfInfo)
      
      // 延迟一点显示性能信息再跳转
      setTimeout(() => {
        window.location.assign('/admin')
      }, 1000)
      
    } catch (err) {
      const totalTime = Date.now() - totalStartTime
      setPerformanceInfo({ totalTime })
      setError(err instanceof Error ? err.message : '登录失败，请重试')
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
        
        {/* 性能监控信息显示 */}
        {performanceInfo && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-sm font-medium text-green-800 mb-2">⚡ 登录性能统计</h3>
            <div className="space-y-1 text-xs text-green-700">
              {performanceInfo.authTime && (
                <div>认证时间: {performanceInfo.authTime}ms</div>
              )}
              {performanceInfo.permissionTime && (
                <div>权限检查: {performanceInfo.permissionTime}ms</div>
              )}
              {performanceInfo.totalTime && (
                <div className="font-medium">总耗时: {performanceInfo.totalTime}ms</div>
              )}
            </div>
            {performanceInfo.totalTime && performanceInfo.totalTime < 1000 && (
              <div className="text-xs text-green-600 mt-1">✨ 性能优化生效！登录速度已提升</div>
            )}
          </div>
        )}
        
      </div>
    </div>
  )
}

export default AdminLoginPage


