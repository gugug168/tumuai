import React from 'react'
import { AuthProvider } from './AuthContext'
import { ProfileProvider } from './ProfileContext'

/**
 * 应用程序上下文提供者组合组件
 * 
 * 架构设计：
 * - AuthProvider: 负责认证状态管理（用户登录、会话、登出）
 * - ProfileProvider: 负责用户资料管理（依赖AuthProvider的用户状态）
 * 
 * 职责分离遵循SOLID原则：
 * - S: 单一职责 - 每个Provider只负责特定领域
 * - D: 依赖倒置 - ProfileProvider依赖AuthProvider的抽象接口
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProfileProvider>
        {children}
      </ProfileProvider>
    </AuthProvider>
  )
}