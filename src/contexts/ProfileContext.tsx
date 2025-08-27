import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getUserProfile, updateUserProfile, type UserProfile } from '../lib/auth'
import { useAuth } from './AuthContext'

interface ProfileContextType {
  profile: UserProfile | null
  loading: boolean
  error: string | null
  refreshProfile: () => Promise<void>
  updateProfile: (data: Partial<UserProfile>) => Promise<void>
  clearProfile: () => void
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function useProfile() {
  const context = useContext(ProfileContext)
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return context
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth() // 依赖AuthContext，但职责分离
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取用户资料
  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log('📄 获取用户资料...')
      const profileData = await getUserProfile(user.id)
      setProfile(profileData)
      console.log('✅ 用户资料加载完成')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取用户资料失败'
      console.warn('⚠️ 用户资料加载失败:', errorMessage)
      setError(errorMessage)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  // 更新用户资料
  const updateProfile = useCallback(async (data: Partial<UserProfile>) => {
    if (!user) {
      throw new Error('用户未登录')
    }

    setLoading(true)
    setError(null)

    try {
      console.log('📝 更新用户资料...')
      const updatedProfile = await updateUserProfile(user.id, data)
      setProfile(updatedProfile)
      console.log('✅ 用户资料更新完成')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新用户资料失败'
      console.error('❌ 用户资料更新失败:', errorMessage)
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [user])

  // 清空用户资料
  const clearProfile = useCallback(() => {
    setProfile(null)
    setError(null)
    setLoading(false)
  }, [])

  // 当用户状态变化时，自动获取或清空资料
  useEffect(() => {
    if (user) {
      refreshProfile()
    } else {
      clearProfile()
    }
  }, [user, refreshProfile, clearProfile])

  const value = {
    profile,
    loading,
    error,
    refreshProfile,
    updateProfile,
    clearProfile
  }

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  )
}