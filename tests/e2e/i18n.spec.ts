import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      // ignore
    }
  })
})

test('renders English UI under /en', async ({ page }) => {
  await page.goto('/en/tools', { waitUntil: 'domcontentloaded' })

  await expect(page.getByTestId('lang-toggle')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tools' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()
})

test('language toggle switches to zh and preserves query', async ({ page }) => {
  await page.goto('/en/tools?sortBy=upvotes', { waitUntil: 'domcontentloaded' })

  await page.getByTestId('lang-toggle').click()

  await expect(page).toHaveURL(/\/tools\?sortBy=upvotes/)
  await expect(page.getByRole('link', { name: '工具中心' })).toBeVisible()
})

