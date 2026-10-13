// Checks the database rules: shoppers can only read, and only the admin with the
// authenticator step can change the catalog. Run: node --test tests/
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { client, makeUser, service, totp } from './helpers.mjs'

const stamp = Date.now()
const PASSWORD = 'test-password-123'

async function signedIn(email) {
  const c = client()
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  assert.ifError(error)
  return c
}

async function adminWithMfa(email) {
  const c = await signedIn(email)
  const { data: f, error } = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: `t${stamp}` })
  assert.ifError(error)
  const { error: vErr } = await c.auth.mfa.challengeAndVerify({ factorId: f.id, code: totp(f.totp.secret) })
  assert.ifError(vErr)
  return c
}

test('visitors can read categories and settings but not write', async () => {
  const anon = client()
  const { data, error } = await anon.from('categories').select('name')
  assert.ifError(error)
  assert.ok(data.length >= 4)
  const { error: insErr } = await anon.from('categories').insert({ name: `x${stamp}`, slug: `x${stamp}` })
  assert.ok(insErr, 'anonymous insert must fail')
  const { data: upd } = await anon.from('store_settings').update({ upi_id: 'evil@bank' }).eq('id', 1).select()
  assert.equal(upd?.length ?? 0, 0, 'anonymous settings update must change nothing')
})

test('a customer cannot change the catalog or make themselves admin', async () => {
  const email = `cust${stamp}@example.com`
  await makeUser(email, PASSWORD, { meta: { username: `cust${stamp}`.slice(0, 20), mobile: '9876500000' } })
  const c = await signedIn(email)
  const { data: role } = await c.rpc('my_role')
  assert.equal(role, 'customer')
  const { error: insErr } = await c.from('categories').insert({ name: `y${stamp}`, slug: `y${stamp}` })
  assert.ok(insErr)
  const { data: self } = await c.from('profiles').update({ role: 'admin' }).eq('username', `cust${stamp}`.slice(0, 20)).select()
  assert.equal(self?.length ?? 0, 0)
  const { data: role2 } = await c.rpc('my_role')
  assert.equal(role2, 'customer')
  const { error: rpcErr } = await c.rpc('admin_save_product', {
    p_id: null, p_category_id: null, p_name: 'x', p_description: '', p_mrp: null, p_price: 1, p_is_visible: true, p_sizes: [],
  })
  assert.ok(rpcErr)
})

test('admin with password only (no authenticator step) cannot write', async () => {
  const email = `adm1${stamp}@example.com`
  await makeUser(email, PASSWORD, { admin: true })
  const c = await signedIn(email)
  const { data: role } = await c.rpc('my_role')
  assert.equal(role, 'admin')
  const { error } = await c.from('categories').insert({ name: `z${stamp}`, slug: `z${stamp}` })
  assert.ok(error, 'aal1 admin insert must fail')
  const { error: upErr } = await c.storage.from('product-images').upload(`t/${stamp}.webp`, new Blob(['x'], { type: 'image/webp' }), { contentType: 'image/webp' })
  assert.ok(upErr, 'aal1 admin upload must fail')
})

test('admin after the authenticator step can manage products, stock and photos', async () => {
  const email = `adm2${stamp}@example.com`
  await makeUser(email, PASSWORD, { admin: true })
  const c = await adminWithMfa(email)
  const { data: cats } = await c.from('categories').select('id, sizes').eq('slug', 'shirts').single()

  const { data: id, error } = await c.rpc('admin_save_product', {
    p_id: null, p_category_id: cats.id, p_name: `Test Shirt ${stamp}`, p_description: 'Cotton', p_mrp: 1299, p_price: 549, p_is_visible: false,
    p_sizes: [{ size: 'S', stock: 0 }, { size: 'M', stock: 1 }, { size: 'L', stock: 3 }],
  })
  assert.ifError(error)

  // Update: drop S, change M, keep order.
  const { error: e2 } = await c.rpc('admin_save_product', {
    p_id: id, p_category_id: cats.id, p_name: `Test Shirt ${stamp}`, p_description: 'Cotton', p_mrp: 1299, p_price: 549, p_is_visible: false,
    p_sizes: [{ size: 'M', stock: 2 }, { size: 'L', stock: 3 }],
  })
  assert.ifError(e2)
  const { data: sizes } = await c.from('product_sizes').select('size, stock, sort_order').eq('product_id', id).order('sort_order')
  assert.deepEqual(sizes, [{ size: 'M', stock: 2, sort_order: 0 }, { size: 'L', stock: 3, sort_order: 1 }])

  // Negative stock and MRP below price are refused.
  const { error: neg } = await c.rpc('admin_save_product', {
    p_id: id, p_category_id: cats.id, p_name: 'x', p_description: '', p_mrp: null, p_price: 100, p_is_visible: false, p_sizes: [{ size: 'M', stock: -1 }],
  })
  assert.ok(neg)
  const { error: mrpErr } = await c.rpc('admin_save_product', {
    p_id: id, p_category_id: cats.id, p_name: 'x', p_description: '', p_mrp: 50, p_price: 100, p_is_visible: false, p_sizes: [],
  })
  assert.ok(mrpErr)

  const path = `${id}/${stamp}.webp`
  const { error: upErr } = await c.storage.from('product-images').upload(path, new Blob(['x'], { type: 'image/webp' }), { contentType: 'image/webp' })
  assert.ifError(upErr)
  const { error: rowErr } = await c.from('product_images').insert({ product_id: id, path, sort_order: 0 })
  assert.ifError(rowErr)

  // Hidden product: invisible to visitors, along with its sizes and photos.
  const anon = client()
  const { data: hidden } = await anon.from('products').select('id').eq('id', id)
  assert.equal(hidden.length, 0)
  const { data: hiddenSizes } = await anon.from('product_sizes').select('id').eq('product_id', id)
  assert.equal(hiddenSizes.length, 0)

  await c.from('products').update({ is_visible: true }).eq('id', id)
  const { data: shown } = await anon.from('products').select('id, product_sizes(size), product_images(path)').eq('id', id)
  assert.equal(shown.length, 1)
  assert.equal(shown[0].product_sizes.length, 2)
  assert.equal(shown[0].product_images.length, 1)

  // A customer can't edit stock even on a visible product.
  const custEmail = `cust2${stamp}@example.com`
  await makeUser(custEmail, PASSWORD, { meta: { username: `c2${stamp}`.slice(0, 20), mobile: '9876500001' } })
  const cust = await signedIn(custEmail)
  const { data: hacked } = await cust.from('product_sizes').update({ stock: 99 }).eq('product_id', id).select()
  assert.equal(hacked?.length ?? 0, 0)

  // Clean up.
  await c.storage.from('product-images').remove([path])
  const { error: delErr } = await c.from('products').delete().eq('id', id)
  assert.ifError(delErr)
  await service().from('products').select('id').eq('id', id)
})
