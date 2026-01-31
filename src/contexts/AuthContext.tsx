import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const signOut = async () => {
    try {
      // 先清除本地状态（立即响应UI）
      setUser(null)
      setSession(null)
      
      // 然后执行Supabase登出
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Supabase signOut error:', error)
        // 即使Supabase登出失败，也要清理本地状态
      }
      
      // 彻底清理本地缓存，避免某些扩展或缓存导致的残留会话
      try {
        Object.keys(localStorage)
          .filter((k) => k.toLowerCase().includes('supabase') || k.includes('sb-'))
          .forEach((k) => {
            console.log('Removing localStorage key:', k)
            localStorage.removeItem(k)
          })
        
        // 清理sessionStorage
        Object.keys(sessionStorage)
          .filter((k) => k.toLowerCase().includes('supabase') || k.includes('sb-'))
          .forEach((k) => {
            console.log('Removing sessionStorage key:', k)
            sessionStorage.removeItem(k)
          })
      } catch (e) {
        console.warn('Storage cleanup error:', e)
      }
      
      console.log('✅ 登出完成，已清理所有状态')
    } catch (error) {
      console.error('❌ 登出过程中发生错误:', error)
      throw error
    }
  }

  useEffect(() => {
    // 获取初始会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔄 认证状态变化:', event)
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const value = {
    user,
    session,
    loading,
    signOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
