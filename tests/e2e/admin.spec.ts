import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const ADMIN_USER = process.env.E2E_ADMIN_USER || 'admin@civilaihub.com'
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || 'admin123'
const SUPABASE_URL = process.env.E2E_SUPABASE_URL || 'https://bixljqdwkjuzftlpmgtb.supabase.co'
const SUPABASE_ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY || ''
const SB_LOCAL_KEY = `sb-bixljqdwkjuzftlpmgtb-auth-token`

async function getAccessToken(): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data, error } = await supabase.auth.signInWithPassword({ email: ADMIN_USER, password: ADMIN_PASS })
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('No access token from Supabase')
  return token
}

test.beforeEach(async ({ page }) => {
  // Inject a valid Supabase access token into localStorage before any navigation
  const token = await getAccessToken()
  await page.addInitScript(([k, v]) => {
    try { localStorage.setItem(k, v) } catch {}
  }, [SB_LOCAL_KEY, JSON.stringify({ access_token: token })])
})

test.describe('Admin flows', () => {
  test('login and load dashboard', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    // 容忍自动跳转/鉴权过程
    await page.waitForURL('**/admin', { timeout: 30000 })
    await expect(page.getByText('管理员控制台', { exact: false })).toBeVisible({ timeout: 20000 })
  })

  test('review approve first pending submission if any', async ({ page }) => {
    await page.goto('/admin')
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


