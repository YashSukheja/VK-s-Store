// Runs after the other specs: the shop has Oxford Shirt, Sky Blue and Slim Jeans.
// Wishlist hearts, reviews from a customer who collected a piece, and the admin Reviews tab.
import { expect, test } from '@playwright/test'
import { client, makeUser, service, totp } from '../tests/helpers.mjs'

test.describe.configure({ mode: 'serial' })

const tail = String(Date.now()).slice(-6)
const admin = { email: `vk-rev${tail}@example.com`, password: 'admin-password-123' }
const buyer = { username: `arjun_${tail}`, mobile: `94${tail}55`, password: 'arjun-pass-123' }
const shots = process.env.SHOTS_DIR
let secret = ''
const SHIRT = 'Oxford Shirt, Sky Blue'
const JEANS = 'Slim Jeans, Dark Wash'

test.beforeAll(async () => {
  await makeUser(admin.email, admin.password, { admin: true })
  const { data, error } = await client().auth.signUp({
    email: `c-${crypto.randomUUID()}@customers.vks-store.invalid`,
    password: buyer.password,
    options: { data: { username: buyer.username, mobile: buyer.mobile } },
  })
  if (error) throw error
  // A collected booking for the shirt, as if the store marked it Completed.
  const svc = service()
  const { data: shirt } = await svc.from('products').select('id').eq('name', SHIRT).single()
  const { data: booking, error: e1 } = await svc
    .from('bookings')
    .insert({ customer_id: data.user.id, customer_username: buyer.username, customer_mobile: buyer.mobile, status: 'completed', fulfilment: 'pickup', payment_method: 'cash', total: 549 })
    .select()
    .single()
  if (e1) throw e1
  const { error: e2 } = await svc.from('booking_items').insert({ booking_id: booking.id, product_id: shirt.id, product_name: SHIRT, size: 'M', quantity: 1, price: 549 })
  if (e2) throw e2
})

async function customerLogin(page) {
  await page.getByLabel('Username or mobile number').fill(buyer.username)
  await page.getByLabel('Password').fill(buyer.password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

test('logged-out hearts are kept on the phone, then move into the account at login', async ({ page }) => {
  await page.goto('/shop')
  const heart = page.getByRole('button', { name: `Save ${JEANS} to wishlist` })
  await heart.click()
  await expect(heart).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('status').filter({ hasText: 'Saved to your wishlist' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Wishlist, 1 saved' }).first()).toBeVisible()

  // The wishlist page works logged out.
  await page.getByRole('link', { name: 'Wishlist, 1 saved' }).first().click()
  await expect(page.getByRole('heading', { name: 'Your wishlist' })).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(JEANS) })).toBeVisible()
  await expect(page.getByText('Saved on this phone.')).toBeVisible()

  // Logging in moves it into the account.
  await page.getByRole('link', { name: 'Log in', exact: true }).last().click()
  await customerLogin(page)
  await expect(page).toHaveURL(/\/wishlist$/)
  await expect(page.getByRole('link', { name: new RegExp(JEANS) })).toBeVisible()
  await expect(page.getByText('Saved on this phone.')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('vrack-wishlist'))).toBeNull()

  await page.goto('/account?tab=wishlist')
  await expect(page.getByRole('heading', { name: 'Wishlist' })).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(JEANS) })).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/account-wishlist.png`, fullPage: true })

  // Tapping again removes it, also after a reload.
  await page.getByRole('button', { name: `Save ${JEANS} to wishlist` }).click()
  await page.reload()
  await expect(page.getByText('Nothing saved yet.')).toBeVisible()
})

test('recently viewed remembers the pieces a shopper opened', async ({ page }) => {
  await page.goto('/shop')
  await page.getByRole('link', { name: /Oxford Shirt/ }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: /Oxford Shirt/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recently viewed' })).toHaveCount(0)
  await page.goto('/shop')
  await page.getByRole('link', { name: new RegExp(JEANS) }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: /Slim Jeans/ })).toBeVisible()
  const recent = page.getByRole('region', { name: 'Recently viewed' })
  await expect(recent.getByRole('link', { name: /Oxford Shirt/ })).toBeVisible()
  await expect(recent.getByRole('link', { name: new RegExp(JEANS) })).toHaveCount(0)
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Recently viewed' }).getByRole('link', { name: new RegExp(JEANS) })).toBeVisible()
})

test('a customer who collected the shirt reviews it; others only read', async ({ page }) => {
  await page.goto('/shop?cat=jeans')
  await page.getByRole('link', { name: /Slim Jeans/ }).click()
  await expect(page.getByText('No reviews yet.')).toBeVisible()

  await page.goto('/login')
  await customerLogin(page)
  await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible()
  await page.getByRole('link', { name: /VK-/ }).first().click()
  await page.getByRole('link', { name: 'Leave a review' }).click()
  const reviews = page.getByRole('region', { name: 'Reviews' })
  await expect(reviews.getByText('You bought this. How was it?')).toBeVisible()
  await reviews.getByRole('button', { name: 'Post review' }).click()
  await expect(reviews.getByText('Tap 1 to 5 stars first.')).toBeVisible()
  await reviews.getByRole('radio', { name: '2 stars' }).click()
  await reviews.getByLabel('Comment (optional)').fill('A button was loose.')
  await reviews.getByRole('button', { name: 'Post review' }).click()
  await expect(reviews.getByText('Thanks! Your review is up.')).toBeVisible()
  await expect(reviews.getByRole('listitem').getByText('A button was loose.')).toBeVisible()
  await expect(reviews.getByText(`${buyer.username} · Verified buyer`)).toBeVisible()
  await expect(reviews.getByRole('img', { name: '2 out of 5 stars' }).first()).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/product-reviews.png`, fullPage: true })

  await page.goto('/account?tab=reviews')
  await expect(page.getByRole('link', { name: SHIRT })).toBeVisible()
})

test('VK replies to the low review, then hides it', async ({ page, browser }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Password').fill(admin.password)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Set up your code app' })).toBeVisible()
  secret = (await page.locator('.font-mono').textContent()).trim()
  await page.getByLabel('6-digit code').fill(totp(secret))
  await page.getByRole('button', { name: 'Finish setup' }).click()
  await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible()

  await page.getByRole('link', { name: 'Reviews' }).click()
  await page.getByRole('button', { name: '1 and 2 stars' }).click()
  await expect(page.getByText('A button was loose.')).toBeVisible()
  await page.getByLabel('Your reply').fill('Sorry! Bring it in and we will fix it free.')
  await page.getByRole('button', { name: 'Save reply' }).click()
  await expect(page.getByText('Reply saved.')).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/admin-reviews.png`, fullPage: true })

  const shopper = await browser.newPage()
  await shopper.goto('http://localhost:5173/shop')
  // The shop shows the newer Navy colour; reviews cover every colour of the shirt.
  await shopper.getByRole('link', { name: /^Oxford Shirt/ }).first().click()
  await expect(shopper.getByText('Vrack replied')).toBeVisible()
  await expect(shopper.getByText('Sorry! Bring it in')).toBeVisible()

  await page.getByRole('button', { name: 'Hide from shop' }).click()
  await expect(page.getByText('Hidden from the shop.')).toBeVisible()
  await shopper.reload()
  await expect(shopper.getByRole('heading', { name: /^Oxford Shirt/ })).toBeVisible()
  await expect(shopper.getByText('A button was loose.')).toHaveCount(0)
  await shopper.close()
})

const localInput = (ms) => {
  const d = new Date(Date.now() + ms)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

test('VK sets up a drop: hidden with a countdown, Remind me, then live', async ({ page, browser }) => {
  // Admin is still set up from the reviews test.
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Password').fill(admin.password)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('6-digit code').fill(totp(secret))
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible()

  await page.getByRole('link', { name: 'Drops' }).click()
  await page.getByLabel('Drop name').fill('Winter Drop')
  await page.getByLabel('Goes live at').fill(localInput(2 * 86400_000))
  await page.getByRole('button', { name: 'Create drop' }).click()
  await expect(page.getByText('Drop created.')).toBeVisible()
  await page.getByRole('checkbox', { name: new RegExp(JEANS) }).check()
  await expect(page.getByText(/Goes live .* · 1 piece/)).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/admin-drops.png`, fullPage: true })

  // Shoppers see the countdown, not the jeans.
  const shopper = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await shopper.goto('http://localhost:5173/')
  const banner = shopper.getByRole('region', { name: 'Drop: Winter Drop' })
  await expect(banner).toBeVisible()
  await expect(banner.getByRole('timer')).toHaveAttribute('aria-label', /Starts in 1 days, 23 hours/)
  await expect(banner).toContainText('1 piece')
  await banner.scrollIntoViewIfNeeded()
  if (shots) await shopper.screenshot({ path: `${shots}/home-drop.png` })
  await shopper.goto('http://localhost:5173/shop')
  await expect(shopper.getByRole('link', { name: /Oxford Shirt/ }).first()).toBeVisible()
  await expect(shopper.getByRole('link', { name: /Slim Jeans/ })).toHaveCount(0)

  // A customer asks to be reminded.
  await shopper.goto('http://localhost:5173/')
  await banner.getByRole('button', { name: 'Remind me' }).click()
  await customerLogin(shopper)
  await expect(banner.getByRole('button', { name: 'Remind me' })).toBeVisible()
  await banner.getByRole('button', { name: 'Remind me' }).click()
  await expect(banner.getByRole('button', { name: 'We’ll remind you ✓' })).toHaveAttribute('aria-pressed', 'true')

  // VK moves the drop to now: it goes live by itself.
  await page.reload()
  await page.getByRole('button', { name: /Winter Drop/ }).click()
  await expect(page.getByText('Remind me: 1 customer')).toBeVisible()
  await page.getByLabel('Goes live at').last().fill(localInput(-60_000))
  await page.getByRole('button', { name: 'Save drop' }).click()
  await expect(page.getByText('Drop saved.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tell' })).toHaveAttribute('href', /wa\.me\/91/)

  await shopper.reload()
  await banner.getByRole('link', { name: 'Shop the drop' }).click()
  await expect(shopper.getByRole('heading', { name: 'Winter Drop' })).toBeVisible()
  await expect(shopper.getByRole('link', { name: /Slim Jeans/ })).toBeVisible()
  await expect(shopper.getByRole('link', { name: /Oxford Shirt/ })).toHaveCount(0)
  await shopper.close()
})

test('VK swaps every product photo for the mannequin demo photos', async ({ page }) => {
  const svc = service()
  const { data: before } = await svc.from('product_images').select('path')
  expect(before.length).toBeGreaterThan(0)

  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Password').fill(admin.password)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('6-digit code').fill(totp(secret))
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible()

  await page.getByRole('link', { name: 'Settings' }).click()
  const card = page.getByRole('region', { name: 'Demo photos' })
  await card.getByRole('button', { name: 'Use demo photos for every item' }).click()
  await card.getByRole('button', { name: 'Yes, delete and replace' }).click()
  await expect(card.getByText(/^Done\. \d+ old photos removed/)).toBeVisible({ timeout: 30_000 })

  // Old files are gone; every item has at least a front and back photo.
  const { data: after } = await svc.from('product_images').select('path, product_id')
  const { data: products } = await svc.from('products').select('id')
  for (const { id } of products) expect(after.filter((r) => r.product_id === id).length).toBeGreaterThanOrEqual(2)
  const oldPaths = new Set(before.map((r) => r.path))
  expect(after.some((r) => oldPaths.has(r.path))).toBe(false)
  const { data: gone } = await svc.storage.from('product-images').download(before[0].path)
  expect(gone).toBeNull()

  await page.goto('/shop')
  const photo = page.getByRole('link', { name: /Slim Jeans/ }).locator('img').first()
  await expect(photo).toBeVisible()
  expect(await photo.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0)
})

test('VK adds the demo products, shoppers see jeans with photos, then VK removes them', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Password').fill(admin.password)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('6-digit code').fill(totp(secret))
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible()
  await page.getByRole('link', { name: 'Settings' }).click()

  const card = page.getByRole('region', { name: 'Demo products' })
  await card.getByRole('button', { name: 'Add demo products' }).click()
  await expect(card.getByText('Done. 12 demo items added to the shop.')).toBeVisible({ timeout: 60_000 })

  const svc = service()
  const { data: blue } = await svc.from('products').select('id, product_images(path), product_sizes(size, stock)').eq('name', 'Mid Blue Baggy Jeans').single()
  expect(blue.product_images.length).toBe(3)
  expect(blue.product_sizes.map((s) => s.size)).toContain('32')

  await page.goto('/shop?cat=jeans')
  const photo = page.getByRole('link', { name: /Mid Blue Baggy Jeans/ }).locator('img').first()
  await expect(photo).toBeVisible()
  await expect.poll(() => photo.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0)

  await page.goto('/admin/settings')
  await card.getByRole('button', { name: 'Remove demo products' }).click()
  await card.getByRole('button', { name: 'Yes, remove demo items' }).click()
  await expect(card.getByText('Done. 12 demo items removed.')).toBeVisible({ timeout: 30_000 })
  const { data: left } = await svc.from('products').select('id').like('description', 'Demo piece.%')
  expect(left).toHaveLength(0)
  const { data: gone } = await svc.storage.from('product-images').download(blue.product_images[0].path)
  expect(gone).toBeNull()
})
