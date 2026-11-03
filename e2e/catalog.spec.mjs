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
  await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible()
  await expect(page.getByText('No bookings waiting')).toBeVisible()
  await page.getByRole('link', { name: 'Products' }).click()
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
  await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible()
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
  await page.getByLabel('Name', { exact: true }).fill('Oxford Shirt, Sky Blue')
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
  await page.locator('input[type=file]').setInputFiles([fixture('jeans.jpg'), fixture('jeans.jpg')])
  await expect(page.getByText('COVER')).toBeVisible()
  // The second photo is the plain phone photo.
  await page.getByRole('button', { name: 'Photo 2 is the real photo' }).click()
  await expect(page.getByRole('button', { name: 'Photo 2 is the real photo' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'cm', exact: true }).click()
  await page.getByLabel(/^Waist/).fill('82')
  await page.getByLabel(/^Length/).fill('104')
  await page.getByLabel('Name', { exact: true }).fill('Slim Jeans, Dark Wash')
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
  await page.goto('/shop')
  await expect(page.getByRole('heading', { name: 'New in' })).toBeVisible()
  const shirt = page.getByRole('link', { name: /Oxford Shirt, Sky Blue/ })
  await expect(shirt).toBeVisible()
  await expect(shirt).toContainText('58% off')
  // The grid shows the small copy of each photo, and it really loads.
  const thumb = shirt.locator('img')
  await expect(thumb).toHaveAttribute('src', /\.thumb\.webp$/)
  await expect.poll(() => thumb.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0)
  expect(await thumb.evaluate((img) => img.naturalWidth)).toBeLessThanOrEqual(720)
  await expect(page.getByRole('link', { name: /Slim Jeans/ })).toContainText('Only 1 left')
  if (shots) await page.screenshot({ path: `${shots}/shop-phone.png`, fullPage: true })

  await page.getByRole('link', { name: 'Jeans', exact: true }).click()
  await expect(page).toHaveURL(/cat=jeans/)
  await expect(page.getByText('1 piece.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Oxford Shirt/ })).toHaveCount(0)

  // The jeans page shows the real photo label and the measurements.
  await page.getByRole('link', { name: /Slim Jeans/ }).click()
  await expect(page.getByAltText('Slim Jeans, Dark Wash, real photo 2 of 2')).toBeAttached()
  await expect(page.getByText('Real photo')).toBeAttached()
  const sizes = page.getByRole('region', { name: 'Measurements' })
  await expect(sizes).toContainText('Waist82 cm')
  await expect(sizes).toContainText('Length104 cm')
  await expect(sizes.locator('dt')).toHaveText(['Length', 'Waist'])
  await expect(page.getByRole('heading', { name: 'Goes well with' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Goes well with' }).getByRole('link', { name: /Oxford Shirt/ }).first()).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/product-jeans-phone.png`, fullPage: true })

  await page.goto('/shop')
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
  await desktop.goto('http://localhost:5173/shop')
  await expect(desktop.getByRole('link', { name: /Oxford Shirt/ })).toBeVisible()
  await desktop.waitForTimeout(300)
  if (shots) await desktop.screenshot({ path: `${shots}/shop-desktop.png` })
  await desktop.close()
})

test('the home page shows the mannequin photo, new pieces and types; admin changes the photo', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'New in' })).toBeVisible()
  // Until a photo is uploaded, the built-in mannequin photo shows.
  const hero = page.getByRole('region', { name: 'New on the rack' })
  await expect(hero.getByRole('heading', { name: 'Vrack Clothing' })).toBeVisible()
  const heroPhoto = hero.getByAltText("This week's look: sage green shirt with washed black jeans")
  await expect(heroPhoto).toHaveAttribute('src', '/demo/hero-mannequin.webp')
  expect(await heroPhoto.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0)
  await expect(page.getByRole('region', { name: 'On the rack' }).getByRole('link', { name: /Oxford Shirt/ }).first()).toBeVisible()
  const types = page.getByRole('navigation', { name: 'Clothing types' })
  await expect(types.getByRole('link', { name: 'Jeans', exact: true })).toBeVisible()
  await types.getByRole('link', { name: 'Jeans', exact: true }).click()
  await expect(page).toHaveURL(/\/shop\?cat=jeans$/)
  await expect(page.getByRole('heading', { name: 'Jeans' })).toBeVisible()

  await login(page)
  await page.getByRole('link', { name: 'Settings' }).click()
  const card = page.getByRole('region', { name: 'Home page' })
  await expect(card.getByText('No photo yet')).toBeVisible()
  await card.locator('input[type=file]').setInputFiles(fixture('model.png'))
  await expect(card.getByText('Home page photo saved.')).toBeVisible()
  await expect(card.getByAltText('Home page photo')).toBeVisible()

  await page.goto('/')
  await expect(page.getByAltText("This week's look: sage green shirt with washed black jeans")).toHaveAttribute('src', /site\/hero-photo\.webp$/)
  if (shots) await page.screenshot({ path: `${shots}/home-phone.png`, fullPage: true })
})

test('the home page opens with the logo intro, which Skip ends', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto('/')
  const skip = page.getByRole('button', { name: 'Skip' })
  await expect(skip).toBeVisible()
  await skip.click()
  await expect(skip).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Vrack Clothing', level: 1 })).toBeVisible()
  // The hero holds still while scrolling, then the page carries on with no blank gap.
  await page.mouse.wheel(0, 3000)
  await expect(page.getByRole('heading', { name: 'New in' })).toBeVisible()
  // Coming back to the home page later in the visit skips the intro.
  await page.goto('/shop')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Vrack Clothing', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0)
  await context.close()
})

test('shoppers search, filter by size, sort and share', async ({ page }) => {
  // Record what the share sheet would get.
  await page.addInitScript(() => {
    window.__shared = null
    navigator.share = async (data) => {
      window.__shared = data
    }
  })
  await page.goto('/shop')
  const cards = page.locator('a[href^="/p/"]')
  await expect(cards).toHaveCount(2)

  // Search looks at names and descriptions, word by word.
  await page.getByLabel('Search clothes').fill('cotton shirt')
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible()
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toContainText('Oxford Shirt')
  await expect(page).toHaveURL(/q=cotton\+shirt/)
  await page.getByLabel('Search clothes').fill('kurta')
  await expect(page.getByText('Nothing matches “kurta”')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(cards).toHaveCount(2)

  // Size chips only list sizes that are in stock.
  const sizes = page.getByRole('group', { name: 'Filter by size' })
  await expect(sizes.getByRole('button')).toHaveText(['M', 'L', '32'])
  await sizes.getByRole('button', { name: '32' }).click()
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toContainText('Slim Jeans')
  await sizes.getByRole('button', { name: '32' }).click()
  await expect(cards).toHaveCount(2)

  // Sorting.
  await expect(cards.first()).toContainText('Slim Jeans')
  await page.getByLabel('Sort by').selectOption('price')
  await expect(cards.first()).toContainText('Oxford Shirt')
  await page.getByLabel('Sort by').selectOption('discount')
  await expect(cards.first()).toContainText('Slim Jeans')

  // Filters live in the link, so a shared link opens the same view.
  await page.getByLabel('Sort by').selectOption('price-desc')
  await sizes.getByRole('button', { name: 'L' }).click()
  await page.goto('/?cat=shirts&size=L&sort=price-desc')
  await expect(page.getByRole('heading', { name: 'Shirts' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Filter by size' }).getByRole('button', { name: 'L' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Sort by')).toHaveValue('price-desc')
  await expect(cards).toHaveCount(1)
  // Picking another category keeps the sort but drops the size.
  await page.getByRole('link', { name: 'Jeans', exact: true }).click()
  await expect(page).toHaveURL(/\/shop\?cat=jeans&sort=price-desc$/)
  if (shots) await page.screenshot({ path: `${shots}/shop-filters.png` })

  await cards.first().click()
  await page.getByRole('button', { name: 'Share' }).click()
  const shared = await page.evaluate(() => window.__shared)
  expect(shared.text).toBe("Slim Jeans, Dark Wash for ₹799 at Vrack Clothing")
  expect(shared.url).toMatch(/^http:\/\/localhost:5173\/p\/[0-9a-f-]{36}$/)
})
