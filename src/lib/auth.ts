import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  username?: string
  full_name?: string
  avatar_url?: string
  bio?: string
  company?: string
  position?: string
  website?: string
  location?: string
  created_at: string
  updated_at: string
}

export interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
}

// 注册用户
export async function signUp(email: string, password: string, userData?: {
  username?: string
  full_name?: string
}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData
    }
  })

  if (error) throw error

  // 创建用户资料
  if (data.user && userData) {
    await createUserProfile(data.user.id, userData)
  }

  return data
}

// 登录
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) throw error
  return data
}

// 登出
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// 创建用户资料
export async function createUserProfile(userId: string, profileData: {
  username?: string
  full_name?: string
  avatar_url?: string
  bio?: string
  company?: string
  position?: string
  website?: string
  location?: string
}) {
  const { data, error } = await supabase
    .from('user_profiles')
    .insert([{
      id: userId,
      ...profileData
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

// 获取用户资料
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

// 更新用户资料
export async function updateUserProfile(userId: string, updates: Partial<UserProfile>) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

// 获取当前用户
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// 监听认证状态变化
export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange(callback)
}