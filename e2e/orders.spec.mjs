// Runs after catalog.spec.mjs and customer.spec.mjs: VK-1001 (Oxford Shirt L ×2,
// Slim Jeans 32 ×1) is waiting, and only one pair of jeans is in stock.
import { expect, test } from '@playwright/test'
import { makeUser, service, totp } from '../tests/helpers.mjs'

test.describe.configure({ mode: 'serial' })

const tail = String(Date.now()).slice(-6)
const admin = { email: `vk-orders${tail}@example.com`, password: 'admin-password-123' }
const buyer = { username: `kiran_${tail}`, mobile: `92${tail}88`, password: 'kiran-pass-123' }
const shots = process.env.SHOTS_DIR
let secret = ''

test.beforeAll(async () => {
  await makeUser(admin.email, admin.password, { admin: true })
})

async function adminLogin(page) {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Password').fill(admin.password)
  await page.getByRole('button', { name: 'Continue' }).click()
  if (!secret) {
    await expect(page.getByRole('heading', { name: 'Set up your code app' })).toBeVisible()
    secret = (await page.locator('.font-mono').textContent()).trim()
    await page.getByLabel('6-digit code').fill(totp(secret))
    await page.getByRole('button', { name: 'Finish setup' }).click()
  } else {
    await page.getByLabel('6-digit code').fill(totp(secret))
    await page.getByRole('button', { name: 'Log in' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible()
}

test('a second customer books the last pair of jeans', async ({ page }) => {
  await page.goto('/register?next=/')
  await page.getByLabel('Username').fill(buyer.username)
  await page.getByLabel('Mobile number').fill(buyer.mobile)
  await page.getByLabel('Password').fill(buyer.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'New in' })).toBeVisible()
  await page.getByRole('link', { name: /Slim Jeans/ }).click()
  await page.getByRole('button', { name: 'Add to cart' }).click()
  await page.getByRole('link', { name: 'Added · View cart' }).click()
  await page.getByRole('button', { name: 'Book now · ₹799' }).click()
  await expect(page.getByText('VK-1002')).toBeVisible()
})

test('VK confirms one booking, the other can no longer be confirmed, and stock drops', async ({ page }) => {
  await adminLogin(page)
  await expect(page.getByLabel('2 waiting')).toBeVisible()
  const first = page.getByRole('listitem').filter({ hasText: 'VK-1001' }).first()
  const second = page.getByRole('listitem').filter({ hasText: 'VK-1002' }).first()
  await expect(first.getByText('Slim Jeans, Dark Wash (32): 1 left and other waiting bookings want it too.')).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/admin-bookings.png`, fullPage: true })

  await first.getByRole('button', { name: 'Confirm' }).click()
  const tell = first.getByRole('link', { name: 'Tell customer' })
  await expect(tell).toBeVisible()
  expect(decodeURIComponent(await tell.getAttribute('href'))).toContain('booking VK-1001 (₹1,897). It\'s confirmed! We\'ll deliver to: 21 Lake View, Sector 9.')
  await first.getByRole('button', { name: 'OK' }).click()

  await expect(page.getByRole('listitem').filter({ hasText: 'VK-1001' })).toHaveCount(0)
  await expect(page.getByLabel('1 waiting')).toBeVisible()
  await expect(second.getByText('only 0 left, this booking needs 1')).toBeVisible()
  await expect(second.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  page.once('dialog', (d) => d.accept())
  await second.getByRole('button', { name: 'Reject' }).click()
  await expect(second.getByText('Rejected')).toBeVisible()
  await second.getByRole('button', { name: 'OK' }).click()
  await expect(page.getByText('No bookings waiting')).toBeVisible()
  await expect(page.getByLabel(/waiting$/)).toHaveCount(0)

  await page.getByRole('tab', { name: 'Confirmed' }).click()
  const sales = page.getByRole('region', { name: 'Sales' })
  await expect(sales).toContainText('Today₹00 pieces')
  await page.getByRole('button', { name: 'Mark delivered' }).click()
  await page.getByRole('button', { name: 'OK' }).click()
  // The delivered booking counts as a sale straight away.
  await expect(sales).toContainText('Today₹1,8973 pieces')
  await sales.getByText('Best sellers this month').click()
  await expect(sales.getByRole('listitem').first()).toHaveText('Oxford Shirt, Sky Blue · 2 sold')
  if (shots) await page.screenshot({ path: `${shots}/admin-sales.png` })
  await page.getByRole('tab', { name: 'Done' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'VK-1001' }).getByText('Completed')).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'VK-1002' }).getByText('Rejected')).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('link', { name: /Slim Jeans/ })).toContainText('Sold out')
  await expect(page.getByRole('link', { name: /Oxford Shirt/ })).toContainText('Only 2 left')
})

test('VK sets a new password for a customer and turns on phone alerts', async ({ page }) => {
  await adminLogin(page)
  await page.getByRole('link', { name: 'Customers' }).click()
  await page.getByLabel('Search customers').fill(buyer.mobile)
  const row = page.getByRole('listitem').filter({ hasText: buyer.username })
  await expect(row).toContainText('1 booking')
  await row.getByRole('button', { name: 'Set a new password' }).click()
  await row.getByLabel(`New password for ${buyer.username}`).fill('fresh-pass-456')
  await row.getByRole('button', { name: 'Save password' }).click()
  await expect(row.getByText(`Done. Send ${buyer.username} the new password.`)).toBeVisible()
  await expect(row.getByRole('link', { name: 'Send on WhatsApp' })).toHaveAttribute('href', /fresh-pass-456/)
  if (shots) await page.screenshot({ path: `${shots}/admin-customers.png` })

  // An older photo without a small copy gets one from Settings.
  const { data: photo } = await service().from('product_images').select('path').limit(1).single()
  await service().storage.from('product-images').remove([photo.path.replace(/\.webp$/, '.thumb.webp')])

  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Make small photos (1)' }).click()
  await expect(page.getByText('Done. 1 small photo made.')).toBeVisible()
  await expect(page.getByText('All photos have a small copy.')).toBeVisible()

  await page.getByRole('button', { name: 'Turn on phone alerts' }).click()
  await expect(page.getByLabel('Alert channel name')).toHaveText(/^vks-[a-z0-9]{30}$/)
  await page.getByRole('button', { name: 'Send test alert' }).click()
  await expect(page.getByText('Test sent.')).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/admin-alerts.png`, fullPage: true })

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download backup' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^vks-store-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const backup = JSON.parse(await (await import('node:fs/promises')).readFile(await file.path(), 'utf8'))
  expect(backup.tables.bookings.map((b) => b.code)).toEqual(expect.arrayContaining(['VK-1001', 'VK-1002']))
  expect(backup.tables.products.length).toBeGreaterThanOrEqual(2)
  expect(JSON.stringify(backup)).not.toContain('encrypted_password')
  await expect(page.getByText(/Backup downloaded \(\d+ records\)/)).toBeVisible()
})

test('the customer logs in with the new password and sees the result', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Username or mobile number').fill(buyer.username)
  await page.getByLabel('Password').fill('fresh-pass-456')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('link', { name: /VK-1002/ })).toContainText('Rejected')
})

test('VK changes stock from the list, tags a product SALE and changes the admin password', async ({ page }) => {
  await adminLogin(page)
  await page.getByRole('link', { name: 'Products' }).click()
  const shirt = page.getByRole('listitem').filter({ hasText: 'Oxford Shirt, Sky Blue' }).first()
  await expect(shirt).toContainText('2 in stock')
  await shirt.getByRole('button', { name: 'One more M of Oxford Shirt, Sky Blue' }).click()
  await expect(shirt).toContainText('3 in stock')
  await expect(shirt.getByRole('button', { name: 'One less S of Oxford Shirt, Sky Blue' })).toBeDisabled()
  if (shots) await page.screenshot({ path: `${shots}/admin-quick-stock.png` })
  await page.reload()
  await expect(page.getByRole('listitem').filter({ hasText: 'Oxford Shirt, Sky Blue' }).first()).toContainText('3 in stock')

  await page.getByRole('link', { name: /Oxford Shirt, Sky Blue/ }).click()
  await page.getByText('Show SALE tag').click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved. It’s live in the shop.')).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('link', { name: /Oxford Shirt/ })).toContainText('SALE')
  // Added today, so the jeans show NEW.
  await expect(page.getByRole('link', { name: /Slim Jeans/ })).toContainText('NEW')
  if (shots) await page.screenshot({ path: `${shots}/shop-tags.png` })

  await page.goto('/admin/settings')
  await page.getByLabel('New password').fill('brand-new-admin-pass')
  await page.getByLabel('Type it again').fill('brand-new-admin-pas')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByText('The two passwords don’t match.')).toBeVisible()
  await page.getByLabel('Type it again').fill('brand-new-admin-pass')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByText('Password changed.')).toBeVisible()
  admin.password = 'brand-new-admin-pass'
  await page.getByRole('button', { name: /Log out/ }).click()
  await adminLogin(page)
})

test('a customer asks to be told when jeans are back; VK sees it and tells them; the footer shows store details', async ({ page, context }) => {
  await adminLogin(page)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByLabel('Instagram').fill('@vks.store')
  await page.getByLabel('Store hours').fill('Mon to Sat, 11 am to 9 pm')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByText('Settings saved.')).toBeVisible()
  await expect(page.getByLabel('Instagram')).toHaveValue('vks.store')
  await page.getByRole('button', { name: 'Log out' }).click()

  // Visitors are asked to log in first.
  await page.goto('/')
  const footer = page.getByRole('contentinfo')
  await expect(footer).toContainText('Mon to Sat, 11 am to 9 pm')
  await expect(footer).toContainText('Shop 4, Main Market')
  await expect(footer.getByRole('link', { name: '@vks.store' })).toHaveAttribute('href', 'https://instagram.com/vks.store')
  await page.getByRole('link', { name: /Slim Jeans/ }).click()
  await page.getByRole('link', { name: 'Log in to get told' }).click()
  await page.getByLabel('Username or mobile number').fill(buyer.username)
  await page.getByLabel('Password').fill('fresh-pass-456')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Slim Jeans, Dark Wash' })).toBeVisible()

  const ask = page.getByRole('group', { name: "Tell me when it's back" })
  await ask.getByRole('button', { name: '32' }).click()
  await expect(page.getByText('Done. VK will message you on WhatsApp when size 32 is back.')).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/restock-request.png`, fullPage: true })
  await page.reload()
  await expect(page.getByRole('group', { name: "Tell me when it's back" }).getByRole('button', { name: '32' })).toHaveAttribute('aria-pressed', 'true')
  await page.goto('/account')
  await page.getByRole('button', { name: 'Log out' }).click()

  await adminLogin(page)
  await page.getByRole('link', { name: 'Products' }).click()
  const jeans = page.getByRole('listitem').filter({ hasText: 'Slim Jeans, Dark Wash' }).first()
  await expect(jeans).toContainText('1 waiting')
  await jeans.getByRole('link', { name: /Slim Jeans/ }).click()
  const waiting = page.getByRole('region', { name: 'Waiting for stock' })
  await expect(waiting).toContainText(`${buyer.username} · size 32`)
  if (shots) await page.screenshot({ path: `${shots}/admin-waiting.png`, fullPage: true })
  const tell = waiting.getByRole('link', { name: 'Tell' })
  const href = decodeURIComponent(await tell.getAttribute('href'))
  expect(href).toContain(`https://wa.me/91${buyer.mobile}?text=Hi ${buyer.username}, good news from VK's Store! Slim Jeans, Dark Wash in size 32 is back in stock: http://localhost:5173/p/`)
  const popup = context.waitForEvent('page')
  await tell.click()
  await (await popup).close()
  await expect(page.getByRole('region', { name: 'Waiting for stock' })).toHaveCount(0)
})
