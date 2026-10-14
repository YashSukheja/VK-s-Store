// Checks confirming, rejecting and cancelling bookings, stock changes, the
// 48-hour auto-cancel, phone alerts and password resets. Run: npm run test:db
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { client, makeUser, psql, service, totp } from './helpers.mjs'

const stamp = Date.now()
const tail = String(stamp).slice(-6)
const PASSWORD = 'test-password-123'
let n = 0

async function customer() {
  n += 1
  const c = client()
  const { data, error } = await c.auth.signUp({
    email: `c-${crypto.randomUUID()}@customers.vks-store.invalid`,
    password: PASSWORD,
    options: { data: { username: `ab${n}_${tail}`, mobile: `9${n}${tail}00`.slice(0, 10) } },
  })
  assert.ifError(error)
  return { c, id: data.user.id, email: data.user.email }
}

async function admin() {
  const email = `boss${stamp}@example.com`
  await makeUser(email, PASSWORD, { admin: true })
  const c = client()
  await c.auth.signInWithPassword({ email, password: PASSWORD })
  const { data: f } = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: `a${stamp}` })
  const { error } = await c.auth.mfa.challengeAndVerify({ factorId: f.id, code: totp(f.totp.secret) })
  assert.ifError(error)
  return c
}

async function product(stock) {
  const svc = service()
  const { data: cat } = await svc.from('categories').select('id').eq('slug', 'jeans').single()
  const { data: p } = await svc.from('products').insert({ category_id: cat.id, name: `Jeans ${stamp} ${n}`, price: 800 }).select().single()
  await svc.from('product_sizes').insert({ product_id: p.id, size: '32', stock })
  return p
}

const stockOf = async (p) => (await service().from('product_sizes').select('stock').eq('product_id', p.id).single()).data.stock

async function book(c, p, quantity = 1) {
  const { data, error } = await c.rpc('place_booking', {
    p_items: [{ product_id: p.id, size: '32', quantity }],
    p_fulfilment: 'pickup',
    p_delivery_address: null,
    p_payment_method: 'cash',
    p_note: '',
  })
  assert.ifError(error)
  return data[0].id
}

const setStatus = (c, id, status) => c.rpc('admin_set_booking_status', { p_booking_id: id, p_status: status })

let boss

test('confirming takes stock off; the last piece cannot be confirmed twice', async () => {
  boss = await admin()
  const p = await product(1)
  const a = await customer()
  const b = await customer()
  const first = await book(a.c, p)
  const second = await book(b.c, p)

  // Customers can't confirm their own bookings.
  const { error: selfErr } = await setStatus(a.c, first, 'confirmed')
  assert.ok(selfErr)

  assert.ifError((await setStatus(boss, first, 'confirmed')).error)
  assert.equal(await stockOf(p), 0)

  const { error: twice } = await setStatus(boss, second, 'confirmed')
  assert.match(twice.message, /Not enough stock: 0 left/)
  assert.ifError((await setStatus(boss, second, 'rejected')).error)

  // Wrong moves are refused.
  const { error: back } = await setStatus(boss, second, 'confirmed')
  assert.match(back.message, /rejected booking can't be marked confirmed/)

  // Cancelling a confirmed booking puts the piece back; completing keeps it sold.
  assert.ifError((await setStatus(boss, first, 'cancelled')).error)
  assert.equal(await stockOf(p), 1)

  const third = await book(a.c, p)
  assert.ifError((await setStatus(boss, third, 'confirmed')).error)
  assert.ifError((await setStatus(boss, third, 'completed')).error)
  assert.equal(await stockOf(p), 0)

  const { data: seen } = await a.c.from('bookings').select('status').eq('id', third).single()
  assert.equal(seen.status, 'completed')
})

test('waiting bookings older than 48 hours cancel themselves', async () => {
  const p = await product(3)
  const a = await customer()
  const old = await book(a.c, p)
  const fresh = await book(a.c, p)
  psql(`update public.bookings set created_at = now() - interval '49 hours' where id = '${old}';`)
  assert.equal(psql('select count(*) from cron.job where jobname = \'vks-auto-cancel-bookings\';'), '1')
  psql('select public.auto_cancel_old_bookings();')
  const { data } = await a.c.from('bookings').select('id, status, auto_cancelled').in('id', [old, fresh])
  const byId = Object.fromEntries(data.map((r) => [r.id, r]))
  assert.deepEqual(byId[old], { id: old, status: 'cancelled', auto_cancelled: true })
  assert.equal(byId[fresh].status, 'pending')
})

test('new bookings send a phone alert once a channel is set; settings stay private', async () => {
  await boss.from('admin_settings').update({ ntfy_topic: null }).eq('id', 1)
  const p = await product(2)
  const a = await customer()
  // pg_net sends from a queue in the background; count queued plus answered requests.
  const sent = () => Number(psql('select (select count(*) from net.http_request_queue) + (select count(*) from net._http_response);'))
  const before = sent()
  await book(a.c, p)
  assert.equal(sent(), before, 'no channel set: no alert')

  const topic = `vks-${crypto.randomUUID()}`
  const { error } = await boss.from('admin_settings').update({ ntfy_topic: topic }).eq('id', 1)
  assert.ifError(error)
  await book(a.c, p)
  assert.equal(sent(), before + 1, 'channel set: one alert per booking')

  const body = JSON.parse(psql("select public.phone_alert_body('New booking VK-1234', 'Total ₹800');"))
  assert.deepEqual(body, { topic, title: 'New booking VK-1234', message: 'Total ₹800', tags: ['shopping_bags'], priority: 4 })

  const { data: peek } = await a.c.from('admin_settings').select('ntfy_topic')
  assert.equal(peek.length, 0)
  const { data: anonPeek } = await client().from('admin_settings').select('ntfy_topic')
  assert.equal(anonPeek?.length ?? 0, 0)
  const { error: testErr } = await a.c.rpc('admin_test_phone_alert')
  assert.ok(testErr)
  assert.ifError((await boss.rpc('admin_test_phone_alert')).error)
  await boss.from('admin_settings').update({ ntfy_topic: null }).eq('id', 1)
})

test('the admin can set a new password for a customer', async () => {
  const a = await customer()
  const { error: selfErr } = await a.c.rpc('admin_reset_customer_password', { p_customer_id: a.id, p_new_password: 'hacked-123' })
  assert.ok(selfErr)
  const { error: short } = await boss.rpc('admin_reset_customer_password', { p_customer_id: a.id, p_new_password: 'short' })
  assert.match(short.message, /at least 8/)
  assert.ifError((await boss.rpc('admin_reset_customer_password', { p_customer_id: a.id, p_new_password: 'brand-new-pass' })).error)

  const { error: oldErr } = await client().auth.signInWithPassword({ email: a.email, password: PASSWORD })
  assert.ok(oldErr, 'old password must stop working')
  const { error: newErr } = await client().auth.signInWithPassword({ email: a.email, password: 'brand-new-pass' })
  assert.ifError(newErr)
})

test('only the admin can change stock quickly or set the SALE tag; stock never goes below zero', async () => {
  const p = await product(1)
  const a = await customer()
  const sizeId = (await service().from('product_sizes').select('id').eq('product_id', p.id).single()).data.id

  const { error: custErr } = await a.c.rpc('admin_adjust_stock', { p_size_id: sizeId, p_change: 5 })
  assert.ok(custErr)
  assert.equal((await boss.rpc('admin_adjust_stock', { p_size_id: sizeId, p_change: 2 })).data, 3)
  assert.equal((await boss.rpc('admin_adjust_stock', { p_size_id: sizeId, p_change: -10 })).data, 0)
  assert.equal(await stockOf(p), 0)

  await a.c.from('products').update({ on_sale: true }).eq('id', p.id)
  const peek = async () => (await service().from('products').select('on_sale').eq('id', p.id).single()).data.on_sale
  assert.equal(await peek(), false, 'customers cannot tag products')
  assert.ifError((await boss.from('products').update({ on_sale: true }).eq('id', p.id)).error)
  assert.equal(await peek(), true)
})

test('customers ask to be told when a sold-out size is back; only they and the admin see it', async () => {
  const p = await product(0)
  const svc = service()
  await svc.from('product_sizes').insert({ product_id: p.id, size: '34', stock: 2 })
  const a = await customer()
  const b = await customer()
  const ask = (c, size) => c.rpc('request_restock', { p_product_id: p.id, p_size: size })

  assert.ifError((await ask(a.c, '32')).error)
  assert.ifError((await ask(a.c, '32')).error, 'asking twice is fine')
  assert.match((await ask(a.c, '34')).error.message, /in stock or no longer/)
  assert.ok((await ask(client(), '32')).error, 'visitors must log in')
  assert.match((await ask(boss, '32')).error.message, /customer account/)

  const { data: own } = await a.c.from('stock_requests').select('id, size')
  assert.deepEqual(own.map((r) => r.size), ['32'])
  assert.equal((await b.c.from('stock_requests').select('id')).data.length, 0, 'others cannot see it')
  await a.c.from('stock_requests').update({ notified_at: new Date().toISOString() }).eq('id', own[0].id)
  await b.c.from('stock_requests').delete().eq('id', own[0].id)

  const { data: seen } = await boss.from('stock_requests').select('id, size, notified_at, customer:profiles(username)').eq('product_id', p.id)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].notified_at, null, 'customers cannot mark themselves as told')
  assert.match(seen[0].customer.username, /^ab\d+_/)
  assert.ifError((await boss.from('stock_requests').update({ notified_at: new Date().toISOString() }).eq('id', seen[0].id)).error)

  // Asking again after being told re-opens it; the customer can withdraw it.
  assert.ifError((await ask(a.c, '32')).error)
  assert.equal((await boss.from('stock_requests').select('notified_at').eq('id', seen[0].id).single()).data.notified_at, null)
  assert.ifError((await a.c.from('stock_requests').delete().eq('product_id', p.id)).error)
  assert.equal((await boss.from('stock_requests').select('id').eq('product_id', p.id)).data.length, 0)

  // Footer settings are public to read, admin-only to write.
  assert.ifError((await boss.from('store_settings').update({ instagram: 'vks.store', store_hours: '11 to 9' }).eq('id', 1)).error)
  assert.equal((await client().from('store_settings').select('instagram').single()).data.instagram, 'vks.store')
  await a.c.from('store_settings').update({ instagram: 'hacked' }).eq('id', 1)
  assert.equal((await client().from('store_settings').select('instagram').single()).data.instagram, 'vks.store')
  assert.ok((await boss.from('store_settings').update({ instagram: 'bad name!' }).eq('id', 1)).error)
  await boss.from('store_settings').update({ instagram: null, store_hours: null }).eq('id', 1)
})
