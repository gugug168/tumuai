// 缓存和存储清理工具
export function cleanupOldCache() {
  try {
    // 清理旧的认证存储
    const keysToClean = [
      'sb-auth-token',
      'supabase.auth.token',
      'sb-bixljqdwkjuzftlpmgtb-auth-token'
    ]
    
    keysToClean.forEach(key => {
      if (localStorage.getItem(key)) {
        console.log(`🧹 清理旧存储键: ${key}`)
        localStorage.removeItem(key)
      }
      if (sessionStorage.getItem(key)) {
        sessionStorage.removeItem(key)
      }
    })

    // 清理所有Supabase相关的存储
    Object.keys(localStorage)
      .filter(key => key.includes('supabase') || key.includes('sb-'))
      .filter(key => key !== 'tumuai-auth-v2-stable') // 保留新的存储键
      .forEach(key => {
        console.log(`🧹 清理Supabase存储: ${key}`)
        localStorage.removeItem(key)
      })

    // 标记清理已完成
    localStorage.setItem('cache-cleanup-v2', 'completed')
    console.log('✅ 缓存清理完成')
    
    return true
  } catch (error) {
    console.error('❌ 缓存清理失败:', error)
    return false
  }
}

// 检查是否需要清理缓存
export function shouldCleanupCache(): boolean {
  return !localStorage.getItem('cache-cleanup-v2')
}

// 应用版本检查和强制刷新机制
export function checkVersionAndRefresh() {
  const currentVersion = '2.0.0' // 当前应用版本
  const storedVersion = localStorage.getItem('tumuai-app-version')
  
  if (!storedVersion || storedVersion !== currentVersion) {
    console.log(`📱 检测到版本更新: ${storedVersion} -> ${currentVersion}`)
    
    // 清理旧缓存
    cleanupOldCache()
    
    // 更新版本标识
    localStorage.setItem('tumuai-app-version', currentVersion)
    
    // 如果是从旧版本升级，强制刷新页面
    if (storedVersion && storedVersion !== currentVersion) {
      console.log('🔄 强制刷新页面以应用最新更新')
      setTimeout(() => {
        window.location.reload()
      }, 1000)
      return true
    }
  }
  
  return false
}

// 错误检测和自动恢复
export function handleCriticalError(error: Error) {
  const errorMessage = error.message.toLowerCase()
  
  // 检测关键错误类型
  const isCriticalError = 
    errorMessage.includes('unexpected token') ||
    errorMessage.includes('not valid json') ||
    errorMessage.includes('multiple gotrueclient') ||
    errorMessage.includes('network error')
  
  if (isCriticalError) {
    console.error('🚨 检测到关键错误，尝试自动恢复:', error)
    
    // 清理所有缓存
    cleanupOldCache()
    
    // 显示用户友好提示
    const shouldRefresh = confirm(
      '检测到应用需要更新以修复问题。\n点击"确定"刷新页面获取最新版本。'
    )
    
    if (shouldRefresh) {
      window.location.reload()
    }
    
    return true
  }
  
  return false
}