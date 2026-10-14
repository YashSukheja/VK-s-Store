// Runs after catalog.spec.mjs, which adds the Oxford Shirt and Slim Jeans.
import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

const tail = String(Date.now()).slice(-6)
const customer = { username: `priya_${tail}`, mobile: `93${tail}77`, password: 'priya-pass-123' }
const shots = process.env.SHOTS_DIR

test('a shopper fills the cart, creates an account and books', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /Oxford Shirt, Sky Blue/ }).click()
  await page.getByRole('button', { name: 'L', exact: true }).click()
  await page.getByRole('button', { name: 'Increase quantity' }).click()
  await page.getByRole('button', { name: 'Add to cart' }).click()
  await expect(page.getByText('Added 2 × size L to your cart')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Cart, 2 items' })).toBeVisible()
  if (shots) await page.screenshot({ path: `${shots}/product-added.png` })

  // Only one pair of jeans in stock: after adding it, there's nothing more to add.
  await page.goto('/')
  await page.getByRole('link', { name: /Slim Jeans/ }).click()
  await page.getByRole('button', { name: 'Add to cart' }).click()
  await expect(page.getByText('Added 1 × size 32 to your cart')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Added · View cart' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeDisabled()
  await expect(page.getByText('You have all available size 32 pieces')).toBeVisible()

  await page.getByRole('link', { name: 'Cart, 3 items' }).click()
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible()
  await expect(page.getByText('₹1,897')).toBeVisible()
  await expect(page.getByText('Shop 4, Main Market')).toBeVisible()
  await page.getByRole('link', { name: 'Log in to book' }).click()

  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible()
  await page.getByLabel('Username').fill('ab')
  await page.getByLabel('Mobile number').fill(customer.mobile)
  await page.getByLabel('Password').fill(customer.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Username: 3 to 20 small letters')).toBeVisible()
  await page.getByLabel('Username').fill(customer.username)
  if (shots) await page.screenshot({ path: `${shots}/register.png` })
  await page.getByRole('button', { name: 'Create account' }).click()

  // Back in the cart, logged in.
  await expect(page).toHaveURL(/\/cart$/)
  await page.getByLabel('Delivery').check()
  await page.getByRole('button', { name: 'Book now · ₹1,897' }).click()
  await expect(page.getByText('Add your delivery address.')).toBeVisible()
  await page.getByLabel('Delivery address').fill('21 Lake View, Sector 9')
  await page.getByLabel('UPI').check()
  await expect(page.getByText('Pay to vkstore@okbank')).toBeVisible()
  await page.getByLabel('Note for VK (optional)').fill('Evening is best')
  if (shots) await page.screenshot({ path: `${shots}/cart.png`, fullPage: true })
  await page.getByRole('button', { name: 'Book now · ₹1,897' }).click()

  await expect(page.getByRole('heading', { name: 'Booked!' })).toBeVisible()
  const code = (await page.getByText(/^VK-\d+$/).textContent()).trim()
  await expect(page.getByText('Waiting for VK')).toBeVisible()
  const wa = page.getByRole('link', { name: 'Send to VK on WhatsApp' }).first()
  const href = decodeURIComponent(await wa.getAttribute('href'))
  expect(href).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/)
  expect(href).toContain(`New booking ${code}`)
  expect(href).toContain(`Customer: ${customer.username} (${customer.mobile})`)
  expect(href).toContain('1. Oxford Shirt, Sky Blue | Size L | Qty 2 | ₹1,098')
  expect(href).toContain('2. Slim Jeans, Dark Wash | Size 32 | Qty 1 | ₹799')
  expect(href).toContain('Total: ₹1,897')
  expect(href).toContain('Delivery to: 21 Lake View, Sector 9')
  expect(href).toContain('Payment: UPI')
  expect(href).toContain('Note: Evening is best')
  if (shots) await page.screenshot({ path: `${shots}/booked.png`, fullPage: true })

  // The cart is empty again and the booking shows in My bookings.
  await expect(page.getByRole('link', { name: 'Cart', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'All my bookings' }).click()
  await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible()
  await expect(page.getByText(`+91 ${customer.mobile}`)).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(code) })).toContainText('3 pieces')
  if (shots) await page.screenshot({ path: `${shots}/my-bookings.png` })
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('customers log in with mobile or username; wrong passwords and duplicate mobiles are refused', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Username or mobile number').fill(customer.mobile)
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('Wrong username, mobile or password.')).toBeVisible()
  await page.getByLabel('Password').fill(customer.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible()
  await page.getByRole('button', { name: 'Log out' }).click()

  await page.getByLabel('Username or mobile number').fill(customer.username.toUpperCase())
  await page.getByLabel('Password').fill(customer.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible()
  await page.getByRole('button', { name: 'Log out' }).click()

  await page.goto('/register')
  await page.getByLabel('Username').fill(`other_${tail}`)
  await page.getByLabel('Mobile number').fill(customer.mobile)
  await page.getByLabel('Password').fill('another-pass-1')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('This mobile number already has an account')).toBeVisible()
})

test('booking pages are private', async ({ page }) => {
  await page.goto('/account')
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/bookings/VK-1001')
  await expect(page).toHaveURL(/\/login\?next=/)
})
