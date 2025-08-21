import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const ADMIN_USER = process.env.E2E_ADMIN_USER || 'admin@civilaihub.com'
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || 'admin123'
const SUPABASE_URL = process.env.E2E_SUPABASE_URL || 'https://bixljqdwkjuzftlpmgtb.supabase.co'
const SUPABASE_ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY || ''
const SUPABASE_TOKEN = process.env.E2E_SUPABASE_TOKEN || ''
const SB_LOCAL_KEY = `sb-bixljqdwkjuzftlpmgtb-auth-token`

async function tryInjectToken(page) {
  // 优先使用直接提供的访问令牌
  if (SUPABASE_TOKEN) {
    await page.addInitScript(([k, v]) => {
      try { localStorage.setItem(k, v) } catch {}
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
        try { localStorage.setItem(k, v) } catch {}
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
  const adminHeading = page.getByText('管理员控制台', { exact: false })
  if (await adminHeading.isVisible().catch(() => false)) return

  // 跳转到登录页尝试 UI 登录
  await page.goto('/admin-login', { waitUntil: 'domcontentloaded' })

  // 尝试多种方式定位邮箱与密码输入框
  const emailLocator = page.locator('input[type="email"], input[name*="email" i], input[autocomplete="username"]').first()
  const passwordLocator = page.locator('input[type="password"], input[name*="password" i], input[autocomplete="current-password"]').first()

  // 回退：若未命中，使用第一个与第二个文本框
  const hasEmail = await emailLocator.count().then(c => c > 0)
  const hasPass = await passwordLocator.count().then(c => c > 0)
  if (!hasEmail) {
    await page.getByRole('textbox').first().fill(ADMIN_USER)
  } else {
    await emailLocator.fill(ADMIN_USER)
  }
  if (!hasPass) {
    await page.locator('input').nth(1).fill(ADMIN_PASS)
  } else {
    await passwordLocator.fill(ADMIN_PASS)
  }

  // 登录按钮
  const loginBtn = page.getByRole('button', { name: /登录|登入|Login/i }).first()
  await loginBtn.click({ trial: false }).catch(async () => {
    await page.locator('button').first().click().catch(() => {})
  })

  await page.waitForURL('**/admin', { timeout: 30000 })
  await expect(page.getByText('管理员控制台', { exact: false })).toBeVisible({ timeout: 20000 })
}

test.beforeEach(async ({ page }) => {
  const injected = await tryInjectToken(page)
  // 不抛错，让用例自行处理 UI 登录回退
})

test.describe('Admin flows', () => {
  test('login and load dashboard', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    // 若未注入 token 或跳转失败，则回退 UI 登录
    if (!await page.getByText('管理员控制台', { exact: false }).isVisible().catch(() => false)) {
      await uiLoginIfNeeded(page)
    }
    await expect(page.getByText('管理员控制台', { exact: false })).toBeVisible({ timeout: 20000 })
  })

  test('review approve first pending submission if any', async ({ page }) => {
    await page.goto('/admin')
    if (!await page.getByText('管理员控制台', { exact: false }).isVisible().catch(() => false)) {
      await uiLoginIfNeeded(page)
    }
    await page.getByRole('button', { name: '工具审核' }).click()
    const approve = page.getByRole('button', { name: '通过' }).first()
    if (await approve.isVisible()) {
      await approve.click()
      // 成功后不应有报错提示
      await expect(page.getByText('操作失败', { exact: false })).toHaveCount(0)
    }
  })

  test('create/update category', async ({ page }) => {
    await page.goto('/admin')
    if (!await page.getByText('管理员控制台', { exact: false }).isVisible().catch(() => false)) {
      await uiLoginIfNeeded(page)
    }
    await page.getByRole('button', { name: '分类管理' }).click()
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


