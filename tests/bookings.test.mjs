// Checks customer sign-up, login lookup and the booking rules. Run: npm run test:db
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { client, makeUser, service } from './helpers.mjs'

const stamp = Date.now()
const tail = String(stamp).slice(-6)
const PASSWORD = 'test-password-123'

async function signUp(username, mobile) {
  const c = client()
  const { data: check, error: checkErr } = await c.rpc('signup_check', { p_username: username, p_mobile: mobile })
  assert.ifError(checkErr)
  assert.deepEqual(check, [{ username_taken: false, mobile_taken: false }])
  const { data, error } = await c.auth.signUp({
    email: `c-${crypto.randomUUID()}@customers.vks-store.invalid`,
    password: PASSWORD,
    options: { data: { username, mobile } },
  })
  assert.ifError(error)
  assert.ok(data.session, 'sign-up must log the customer in straight away')
  return c
}

async function makeProduct(name, stock) {
  const svc = service()
  const { data: cat } = await svc.from('categories').select('id').eq('slug', 'shirts').single()
  const { data: p, error } = await svc.from('products').insert({ category_id: cat.id, name, price: 500, mrp: 900 }).select().single()
  assert.ifError(error)
  const { error: e2 } = await svc.from('product_sizes').insert([
    { product_id: p.id, size: 'M', stock, sort_order: 0 },
    { product_id: p.id, size: 'L', stock: 0, sort_order: 1 },
  ])
  assert.ifError(e2)
  return p
}

const book = (c, items, extra = {}) =>
  c.rpc('place_booking', {
    p_items: items,
    p_fulfilment: 'pickup',
    p_delivery_address: null,
    p_payment_method: 'cash',
    p_note: '',
    ...extra,
  })

test('customers sign up, are found by username or mobile, and duplicates are caught', async () => {
  const username = `ravi_${tail}`
  const mobile = `98${tail}11`
  await signUp(username, mobile)

  const anon = client()
  const { data: taken } = await anon.rpc('signup_check', { p_username: username.toUpperCase(), p_mobile: mobile })
  assert.deepEqual(taken, [{ username_taken: true, mobile_taken: true }])

  const { data: byName } = await anon.rpc('customer_login_email', { p_login: username.toUpperCase() })
  const { data: byMobile } = await anon.rpc('customer_login_email', { p_login: mobile })
  assert.match(byName, /@customers\.vks-store\.invalid$/)
  assert.equal(byName, byMobile)
  const { error } = await anon.auth.signInWithPassword({ email: byMobile, password: PASSWORD })
  assert.ifError(error)

  // The admin's email is never handed out.
  const adminEmail = `admin${stamp}@example.com`
  const admin = await makeUser(adminEmail, PASSWORD, { admin: true })
  const { data: prof } = await service().from('profiles').select('username').eq('id', admin.id).single()
  const { data: adminLookup } = await anon.rpc('customer_login_email', { p_login: prof.username })
  assert.equal(adminLookup, null)
})

test('a customer books; prices and stock come from the database', async () => {
  const shirt = await makeProduct(`Booking Shirt ${stamp}`, 2)
  const c = await signUp(`asha_${tail}`, `97${tail}22`)

  const { error: tooMany } = await book(c, [{ product_id: shirt.id, size: 'M', quantity: 3 }])
  assert.match(tooMany.message, /Only 2 left/)
  const { error: soldOut } = await book(c, [{ product_id: shirt.id, size: 'L', quantity: 1 }])
  assert.match(soldOut.message, /Only 0 left/)
  const { error: noAddress } = await book(c, [{ product_id: shirt.id, size: 'M', quantity: 1 }], { p_fulfilment: 'delivery' })
  assert.match(noAddress.message, /delivery address/)

  // Same line twice is merged; the price sent from the phone is ignored.
  const { data, error } = await book(
    c,
    [
      { product_id: shirt.id, size: 'M', quantity: 1, price: 1 },
      { product_id: shirt.id, size: 'M', quantity: 1 },
    ],
    { p_fulfilment: 'delivery', p_delivery_address: '12 Gandhi Road, Sector 5', p_payment_method: 'upi' },
  )
  assert.ifError(error)
  assert.match(data[0].code, /^VK-\d+$/)

  const { data: mine } = await c.from('bookings').select('code, status, total, fulfilment, payment_method, booking_items(product_name, size, quantity, price)')
  assert.equal(mine.length, 1)
  assert.equal(mine[0].status, 'pending')
  assert.equal(mine[0].total, 1000)
  assert.deepEqual(mine[0].booking_items, [{ product_name: shirt.name, size: 'M', quantity: 2, price: 500 }])

  // Stock is not taken until VK confirms.
  const { data: size } = await service().from('product_sizes').select('stock').eq('product_id', shirt.id).eq('size', 'M').single()
  assert.equal(size.stock, 2)
})

test('customers only see their own bookings and cannot write them directly', async () => {
  const shirt = await makeProduct(`Private Shirt ${stamp}`, 5)
  const a = await signUp(`neha_${tail}`, `96${tail}33`)
  const b = await signUp(`arun_${tail}`, `95${tail}44`)
  const { error } = await book(a, [{ product_id: shirt.id, size: 'M', quantity: 1 }])
  assert.ifError(error)

  const { data: seen } = await b.from('bookings').select('id')
  assert.equal(seen.length, 0)
  const { data: items } = await b.from('booking_items').select('id')
  assert.equal(items.length, 0)

  const { error: insErr } = await b.from('bookings').insert({ customer_username: 'x', customer_mobile: '9999999999', fulfilment: 'pickup', payment_method: 'cash', total: 1 })
  assert.ok(insErr)
  const { data: upd } = await a.from('bookings').update({ status: 'confirmed', total: 1 }).neq('status', 'x').select()
  assert.equal(upd?.length ?? 0, 0)

  const anon = client()
  const { error: anonErr } = await book(anon, [{ product_id: shirt.id, size: 'M', quantity: 1 }])
  assert.ok(anonErr, 'visitors must log in to book')
})

test('a customer can have at most 3 bookings waiting', async () => {
  const shirt = await makeProduct(`Limit Shirt ${stamp}`, 5)
  const c = await signUp(`limit_${tail}`, `94${tail}55`)
  for (let i = 0; i < 3; i++) {
    const { error } = await book(c, [{ product_id: shirt.id, size: 'M', quantity: 1 }])
    assert.ifError(error)
  }
  const { error } = await book(c, [{ product_id: shirt.id, size: 'M', quantity: 1 }])
  assert.match(error.message, /3 bookings waiting/)
})
