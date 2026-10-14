import { expect, test } from '@playwright/test'
import path from 'node:path'
import { makeUser, totp } from '../tests/helpers.mjs'

test.describe.configure({ mode: 'serial' })

const stamp = Date.now()
const admin = { email: `vk${stamp}@example.com`, password: 'admin-password-123' }
const shots = process.env.SHOTS_DIR
const fixture = (name) => path.join(import.meta.dirname, 'fixtures', name)
let secret = ''

test.beforeAll(async () => {
  await makeUser(admin.email, admin.password, { admin: true })
})

test('admin sets up the authenticator app and logs in', async ({ page }) => {
  await page.goto('/admin/products')
  await expect(page).toHaveURL(/\/admin\/login$/)
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Password').fill(admin.password)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Set up your code app' })).toBeVisible()
  await expect(page.getByAltText('QR code for the authenticator app')).toBeVisible()
  secret = (await page.locator('.font-mono').textContent()).trim()
  if (shots) await page.screenshot({ path: `${shots}/admin-setup.png` })
  await page.getByLabel('6-digit code').fill(totp(secret))
  await page.getByRole('button', { name: 'Finish setup' }).click()
  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible()
  await expect(page.getByText('No products yet')).toBeVisible()
})

async function login(page) {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Password').fill(admin.password)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible()
  await page.getByLabel('6-digit code').fill(totp(secret))
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible()
}

test('wrong code is refused; admin pages stay locked', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Password').fill(admin.password)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('6-digit code').fill('000000')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('That code didn’t work')).toBeVisible()
  await page.goto('/admin/products')
  await expect(page).toHaveURL(/\/admin\/login$/)
})

test('admin fills in store settings and adds products with photos and stock', async ({ page }) => {
  await login(page)

  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByLabel('WhatsApp number for bookings').fill('9876543210')
  await page.getByLabel('UPI ID').fill('vkstore@okbank')
  await page.getByLabel('Pickup address').fill('Shop 4, Main Market')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByText('Settings saved.')).toBeVisible()

  await page.getByRole('link', { name: 'Products' }).click()
  await page.getByRole('link', { name: 'Add product' }).click()
  await page.locator('input[type=file]').setInputFiles([fixture('shirt.jpg'), fixture('jeans.jpg')])
  await expect(page.getByText('COVER')).toBeVisible()
  await expect(page.getByAltText('Photo 2')).toBeVisible()
  // Remove the second photo again.
  await page.getByRole('button', { name: 'Remove photo 2' }).click()
  await page.getByLabel('Name').fill('Oxford Shirt, Sky Blue')
  await page.getByLabel('Category').selectOption({ label: 'Shirts' })
  await page.getByLabel('Description').fill('Soft cotton, regular fit. Worn once.')
  await page.getByLabel('MRP (optional)').fill('1299')
  await page.getByLabel('Selling price').fill('549')
  await page.getByRole('button', { name: 'Add one M', exact: true }).click()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Add one L', exact: true }).click()
  await expect(page.getByText('4 pieces total')).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/admin-add-product.png`, fullPage: true })
  await page.getByRole('button', { name: 'Save and show in shop' }).click()
  await expect(page.getByText('Saved. It’s live in the shop.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Edit product' })).toBeVisible()
  await expect(page.getByAltText('Photo 1')).toBeVisible()

  // MRP below price is refused before saving.
  await page.getByLabel('MRP (optional)').fill('100')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('MRP must be a whole number')).toBeVisible()

  await page.goto('/admin/products/new')
  await page.locator('input[type=file]').setInputFiles(fixture('jeans.jpg'))
  await expect(page.getByText('COVER')).toBeVisible()
  await page.getByLabel('Name').fill('Slim Jeans, Dark Wash')
  await page.getByLabel('Category').selectOption({ label: 'Jeans' })
  await page.getByLabel('MRP (optional)').fill('1999')
  await page.getByLabel('Selling price').fill('799')
  await page.getByRole('button', { name: 'Add one 32', exact: true }).click()
  await page.getByRole('button', { name: 'Save and show in shop' }).click()
  await expect(page.getByText('Saved. It’s live in the shop.')).toBeVisible()

  await page.getByRole('link', { name: 'Products', exact: true }).click()
  await expect(page.getByText('Oxford Shirt, Sky Blue')).toBeVisible()
  await expect(page.getByText('Slim Jeans, Dark Wash')).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/admin-products.png` })
})

test('shoppers browse by category and see sizes and prices', async ({ page, browser }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'New in' })).toBeVisible()
  const shirt = page.getByRole('link', { name: /Oxford Shirt, Sky Blue/ })
  await expect(shirt).toBeVisible()
  await expect(shirt).toContainText('58% off')
  await expect(page.getByRole('link', { name: /Slim Jeans/ })).toContainText('Only 1 left')
  if (shots) await page.screenshot({ path: `${shots}/shop-phone.png`, fullPage: true })

  await page.getByRole('link', { name: 'Jeans', exact: true }).click()
  await expect(page).toHaveURL(/cat=jeans/)
  await expect(page.getByText('1 item')).toBeVisible()
  await expect(page.getByRole('link', { name: /Oxford Shirt/ })).toHaveCount(0)

  await page.getByRole('link', { name: 'All', exact: true }).click()
  await shirt.click()
  await expect(page.getByRole('heading', { name: 'Oxford Shirt, Sky Blue' })).toBeVisible()
  await expect(page.getByText('YOU SAVE ₹750')).toBeVisible()
  await expect(page.getByRole('button', { name: 'S, sold out' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'M', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Only 1 left in M')).toBeVisible()
  await page.getByRole('button', { name: 'L', exact: true }).click()
  await page.getByRole('button', { name: 'Increase quantity' }).click()
  await expect(page.getByText('₹1,098')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled()
  if (shots) await page.screenshot({ path: `${shots}/product-phone.png` })

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 860 } })
  await desktop.goto('http://localhost:5173/')
  await expect(desktop.getByRole('link', { name: /Oxford Shirt/ })).toBeVisible()
  await desktop.waitForTimeout(300)
  if (shots) await desktop.screenshot({ path: `${shots}/shop-desktop.png` })
  await desktop.close()
})
