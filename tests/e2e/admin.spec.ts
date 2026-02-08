import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const ADMIN_USER = process.env.E2E_ADMIN_USER || 'admin@civilaihub.com'
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || 'admin123'
const SUPABASE_URL = process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const SUPABASE_TOKEN = process.env.E2E_SUPABASE_TOKEN || ''

if (!SUPABASE_URL) {
  console.error('❌ 错误: 缺少 Supabase URL 环境变量')
  console.log('请设置 E2E_SUPABASE_URL 或 VITE_SUPABASE_URL 环境变量')
  process.exit(1)
}

// 从 URL 中提取项目 ID 用于本地存储键
const PROJECT_ID = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'unknown'
const SB_LOCAL_KEY = `sb-${PROJECT_ID}-auth-token`

async function tryInjectToken(page) {
  // 优先使用直接提供的访问令牌
  if (SUPABASE_TOKEN) {
    await page.addInitScript(([k, v]) => {
      try { localStorage.setItem(k, v) } catch { /* ignore storage errors */ }
    }, [SB_LOCAL_KEY, JSON.stringify({ access_token: SUPABASE_TOKEN })])
    return true
  }
  // 次选使用 anon key 以密码登录换取 token
  if (SUPABASE_ANON_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      const { data, error } = await supabase.auth.signInWithPassword({ email: ADMIN_USER, password: ADMIN_PASS })
      if (error) throw error
      const token = data.session?.access_token
      if (!token) throw new Error('No access token from Supabase')
      await page.addInitScript(([k, v]) => {
        try { localStorage.setItem(k, v) } catch { /* ignore storage errors */ }
      }, [SB_LOCAL_KEY, JSON.stringify({ access_token: token })])
      return true
    } catch {
      // 忽略，后续走 UI 登录
    }
  }
  return false
}

async function uiLoginIfNeeded(page) {
  // 若已在管理员页，直接返回
  const adminHeading = page.getByTestId('admin-dashboard-title')
  if (await adminHeading.isVisible().catch(() => false)) return

  // 跳转到登录页尝试 UI 登录
  await page.goto('/admin-login', { waitUntil: 'domcontentloaded' })

  // 等待登录页面加载
  await expect(page.getByTestId('admin-login-title')).toBeVisible({ timeout: 10000 })

  // 使用稳定的测试 ID 定位输入框
  await page.getByTestId('admin-email-input').fill(ADMIN_USER)
  await page.getByTestId('admin-password-input').fill(ADMIN_PASS)

  // 点击登录按钮
  await page.getByTestId('admin-login-button').click()

  // 等待跳转到管理页面
  await page.waitForURL('**/admin*', { timeout: 30000 })
  await expect(page.getByTestId('admin-dashboard-title')).toBeVisible({ timeout: 20000 })
}

test.beforeEach(async ({ page }) => {
  await tryInjectToken(page)
  // 不抛错，让用例自行处理 UI 登录回退
})

test.describe('Admin flows', () => {
  test('login and load dashboard', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    // 若未注入 token 或跳转失败，则回退 UI 登录
    if (!await page.getByTestId('admin-dashboard-title').isVisible().catch(() => false)) {
      await uiLoginIfNeeded(page)
    }
    await expect(page.getByTestId('admin-dashboard-title')).toBeVisible({ timeout: 20000 })
  })

  test('navigate to tool review and approve first pending submission if any', async ({ page }) => {
    await page.goto('/admin')
    if (!await page.getByTestId('admin-dashboard-title').isVisible().catch(() => false)) {
      await uiLoginIfNeeded(page)
    }
    
    // 点击工具审核标签
    await page.getByTestId('admin-tab-submissions').click()
    
    // 等待审核页面加载
    await page.waitForTimeout(1000)
    
    // 查找第一个待审核的提交，如果有的话
    const firstApproveButton = page.locator('[data-testid^="approve-submission-"]').first()
    const hasSubmissions = await firstApproveButton.count().then(c => c > 0)
    
    if (hasSubmissions) {
      await firstApproveButton.click()
      // 等待操作完成，成功后不应有报错提示
      await page.waitForTimeout(2000)
      await expect(page.getByText('操作失败', { exact: false })).toHaveCount(0)
    } else {
      console.log('No pending submissions found for approval')
    }
  })

  test('filter tool submissions by status triggers reload', async ({ page }) => {
    await page.goto('/admin')
    if (!await page.getByTestId('admin-dashboard-title').isVisible().catch(() => false)) {
      await uiLoginIfNeeded(page)
    }

    await page.getByTestId('admin-tab-submissions').click()
    await expect(page.getByTestId('submissions-status-filter')).toBeVisible({ timeout: 20000 })

    const req = page.waitForRequest(r =>
      r.url().includes('/api/admin-datasets') &&
      r.url().includes('sections=submissions') &&
      r.url().includes('submissionStatus=approved')
    )

    await page.getByTestId('submissions-status-filter').selectOption('approved')
    await req
    await expect(page).toHaveURL(/subStatus=approved/)
  })

  test('navigate to category management', async ({ page }) => {
    await page.goto('/admin')
    if (!await page.getByTestId('admin-dashboard-title').isVisible().catch(() => false)) {
      await uiLoginIfNeeded(page)
    }
    
    // 点击分类管理标签
    await page.getByTestId('admin-tab-categories').click()
    
    // 等待分类管理页面加载
    await page.waitForTimeout(1000)
    await page.getByRole('button', { name: '新增分类' }).click()
    // 简化：直接命名
    const name = `测试分类${Date.now().toString().slice(-4)}`
    await page.getByText('分类名称').first().locator('..').getByRole('textbox').fill(name)
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText(name)).toBeVisible({ timeout: 20000 })
  })

  test('create tool (modal) then see it in tools list', async ({ page }) => {
    await page.goto('/admin')
    if (!await page.getByText('管理员控制台', { exact: false }).isVisible().catch(() => false)) {
      await uiLoginIfNeeded(page)
    }
    await page.getByRole('button', { name: '工具管理' }).click()
    await page.getByRole('button', { name: '新增工具' }).click()
    const toolName = `E2E工具${Date.now().toString().slice(-4)}`
    await page.getByText('工具名称 *').first().locator('..').getByRole('textbox').fill(toolName)
    await page.getByText('一句话简介 *').first().locator('..').getByRole('textbox').fill('端到端测试工具')
    await page.getByText('官网地址 *').first().locator('..').getByRole('textbox').fill('https://example.com')
    await page.getByRole('button', { name: /创建工具|保存/ }).click()
    await expect(page.getByText(toolName)).toBeVisible({ timeout: 20000 })
  })
})


