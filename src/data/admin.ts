import { makeThumbnail, thumbPath } from '../lib/images'
import { IMAGE_BUCKET, imageUrl, PHOTO_CACHE, supabase, thumbUrl } from '../lib/supabase'
import type { Booking, BookingStatus, Customer, ProductSize } from '../lib/types'
import { BOOKING_COLUMNS } from './bookings'

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  return result.data as T
}

/** Fired after the admin changes a booking, so the tab badge refreshes. */
export const BOOKINGS_CHANGED = 'vks-bookings-changed'

export async function fetchBookingsByStatus(statuses: BookingStatus[], limit = 100): Promise<Booking[]> {
  const pending = statuses.length === 1 && statuses[0] === 'pending'
  return unwrap(
    await supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .in('status', statuses)
      // Waiting: oldest first, so nothing gets forgotten. Others: newest first.
      .order(pending ? 'created_at' : 'status_changed_at', { ascending: pending, nullsFirst: false })
      .limit(limit),
  ) as Booking[]
}

export async function fetchPendingCount(): Promise<number> {
  const { count, error } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** Live stock for the sizes in these bookings. Key: `${productId}|${size}`. */
export async function fetchStockFor(bookings: Booking[]): Promise<Map<string, number>> {
  const ids = [...new Set(bookings.flatMap((b) => b.booking_items.map((i) => i.product_id)).filter((x): x is string => !!x))]
  if (ids.length === 0) return new Map()
  const rows = unwrap(await supabase.from('product_sizes').select('product_id, size, stock').in('product_id', ids)) as (Pick<
    ProductSize,
    'size' | 'stock'
  > & { product_id: string })[]
  return new Map(rows.map((r) => [`${r.product_id}|${r.size}`, r.stock]))
}

export async function setBookingStatus(id: string, status: BookingStatus): Promise<void> {
  const { error } = await supabase.rpc('admin_set_booking_status', { p_booking_id: id, p_status: status })
  if (error) throw new Error(error.message)
  window.dispatchEvent(new Event(BOOKINGS_CHANGED))
}

export async function fetchCustomers(): Promise<Customer[]> {
  return unwrap(
    await supabase
      .from('profiles')
      .select('id, username, mobile, created_at, bookings(count)')
      .eq('role', 'customer')
      .order('created_at', { ascending: false }),
  ) as Customer[]
}

export async function resetCustomerPassword(id: string, password: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reset_customer_password', { p_customer_id: id, p_new_password: password })
  if (error) throw new Error(error.message)
}

export async function fetchAlertTopic(): Promise<string | null> {
  const row = unwrap(await supabase.from('admin_settings').select('ntfy_topic').eq('id', 1).single()) as { ntfy_topic: string | null }
  return row.ntfy_topic
}

export async function saveAlertTopic(topic: string | null): Promise<void> {
  const { error } = await supabase.from('admin_settings').update({ ntfy_topic: topic }).eq('id', 1)
  if (error) throw new Error(error.message)
}

export async function sendTestAlert(): Promise<void> {
  const { error } = await supabase.rpc('admin_test_phone_alert')
  if (error) throw new Error(error.message)
}

const BACKUP_TABLES = [
  'categories',
  'products',
  'product_sizes',
  'product_images',
  'store_settings',
  'profiles',
  'bookings',
  'booking_items',
  'stock_requests',
] as const

/** Tables added by later setup files: skipped if that file hasn't been run yet. */
const OPTIONAL_TABLES: readonly string[] = ['stock_requests']

/** Everything in the database (except logins and passwords), as one JSON file. */
export async function downloadBackup(): Promise<{ rows: number }> {
  const tables: Record<string, unknown[]> = {}
  let rows = 0
  for (const table of BACKUP_TABLES) {
    const all: unknown[] = []
    // Page through in chunks so big tables come back whole.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select('*').range(from, from + 999)
      if (error && OPTIONAL_TABLES.includes(table)) break
      if (error) throw new Error(`${table}: ${error.message}`)
      all.push(...data)
      if (data.length < 1000) break
    }
    tables[table] = all
    rows += all.length
  }
  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([JSON.stringify({ app: "Vrack Clothing", made_at: new Date().toISOString(), tables }, null, 1)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vks-store-backup-${date}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return { rows }
}

/** Photos whose small copy hasn't been made yet (uploaded before small copies existed). */
export async function findPhotosWithoutThumbnails(): Promise<string[]> {
  const rows = unwrap(await supabase.from('product_images').select('path')) as { path: string }[]
  const checks = await Promise.all(
    rows.map(async ({ path }) => {
      const res = await fetch(thumbUrl(path), { method: 'HEAD', cache: 'no-store' }).catch(() => null)
      return res?.ok ? null : path
    }),
  )
  return checks.filter((p): p is string => p !== null)
}

/** Makes the small copy for one photo from the big one. */
export async function makeThumbnailFor(path: string): Promise<void> {
  const res = await fetch(imageUrl(path), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Couldn't download ${path}`)
  const thumb = await makeThumbnail(await res.blob())
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(thumbPath(path), thumb, { contentType: 'image/webp', cacheControl: PHOTO_CACHE })
  if (error) throw new Error(error.message)
}

/** Adds or removes pieces of one size in one step on the server. Returns the new stock. */
export async function adjustStock(sizeId: string, change: number): Promise<number> {
  const { data, error } = await supabase.rpc('admin_adjust_stock', { p_size_id: sizeId, p_change: change })
  if (error) {
    throw new Error(error.message.includes('admin_adjust_stock') ? 'Quick stock needs setup file 5. Run it in Supabase first.' : error.message)
  }
  return data as number
}

export type Sale = { total: number; status_changed_at: string; booking_items: { product_name: string; quantity: number }[] }

/** Finished (collected or delivered) bookings since a date, for the sales summary. */
export async function fetchSalesSince(since: Date): Promise<Sale[]> {
  return unwrap(
    await supabase
      .from('bookings')
      .select('total, status_changed_at, booking_items(product_name, quantity)')
      .eq('status', 'completed')
      .gte('status_changed_at', since.toISOString())
      .limit(2000),
  ) as Sale[]
}

/** The built-in mannequin photos in public/demo, by kind of clothing. Items of one kind take turns through them. */
/** Bump when the demo photo files change, so browsers fetch the new ones. */
const DEMO_VERSION = 3

const DEMO_SETS = {
  tee: ['pink-tee', 'black-tee', 'lavender-tee'],
  shirt: ['shirt', 'plaid-shirt', 'beige-shirt'],
  jeans: ['jeans', 'blue-jeans', 'white-jeans', 'grey-jeans', 'charcoal-jeans', 'grey-wide-jeans'],
  look: ['look', 'beige-shirt-look', 'black-tee-look', 'plaid-shirt-look', 'pink-tee-look', 'lavender-tee-look'],
}
/** Sets that also have a close-up photo. */
const DEMO_CLOSEUPS = new Set(['black-tee', 'blue-jeans', 'beige-shirt', 'white-jeans'])

/** Which kind of demo photo suits a type of clothing. */
function demoKindFor(category: string, name = ''): keyof typeof DEMO_SETS {
  // Full outfits only for combos and sets; everything else shows just its own piece.
  if (/combo|co-?ord|set|look|outfit/i.test(category)) return 'look'
  for (const text of [category, name]) {
    if (/t-?shirt|tee|polo|top/i.test(text)) return 'tee'
    if (/jean|trouser|pant|short|cargo|chino|jogger|bottom|denim/i.test(text)) return 'jeans'
    if (/shirt|jacket|hoodie|sweat|kurta|blazer|coat|overshirt/i.test(text)) return 'shirt'
  }
  return 'shirt'
}

/**
 * Removes every product photo (files and their small copies), then gives each product the built-in
 * mannequin photos (front, back and sometimes a close-up) that suit its type, taking turns through the outfits
 * so items look different. Stock, prices and bookings are not touched.
 */
export async function replaceWithDemoPhotos(onProgress: (done: number, total: number) => void): Promise<{ removed: number; products: number }> {
  const old = unwrap(await supabase.from('product_images').select('id, path')) as { id: string; path: string }[]
  const files = old.flatMap((r) => [r.path, thumbPath(r.path)])
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(files.slice(i, i + 100))
    if (error) throw new Error(error.message)
  }
  for (let i = 0; i < old.length; i += 100) {
    const ids = old.slice(i, i + 100).map((r) => r.id)
    unwrap(await supabase.from('product_images').delete().in('id', ids))
  }

  const categories = unwrap(await supabase.from('categories').select('id, name, slug')) as { id: string; name: string; slug: string }[]
  const products = unwrap(await supabase.from('products').select('id, name, category_id')) as { id: string; name: string; category_id: string }[]
  const typeOf = new Map(categories.map((c) => [c.id, `${c.slug} ${c.name}`]))

  const demo = demoPhotoLoader()

  const turn = { tee: 0, shirt: 0, jeans: 0, look: 0 }
  for (const [i, p] of products.entries()) {
    onProgress(i, products.length)
    const kind = demoKindFor(typeOf.get(p.category_id) ?? '', p.name)
    const sets = DEMO_SETS[kind]
    const set = sets[turn[kind]++ % sets.length]
    await addDemoPhotos(p.id, set, demo)
  }
  onProgress(products.length, products.length)
  return { removed: old.length, products: products.length }
}

/** Downloads each demo photo once (always fresh) and makes its small copy once. */
function demoPhotoLoader() {
  const cache = new Map<string, Promise<{ big: Blob; small: File }>>()
  return (name: string) => {
    let hit = cache.get(name)
    if (!hit) {
      hit = (async () => {
        const res = await fetch(`/demo/${name}.webp?v=${DEMO_VERSION}`, { cache: 'reload' })
        if (!res.ok) throw new Error(`Couldn't load the demo photo ${name}.`)
        const big = await res.blob()
        return { big, small: await makeThumbnail(big) }
      })()
      cache.set(name, hit)
    }
    return hit
  }
}

/** Gives one product the front, back (and close-up, if there is one) of a demo outfit. */
async function addDemoPhotos(productId: string, set: string, demo: ReturnType<typeof demoPhotoLoader>) {
  const views = DEMO_CLOSEUPS.has(set) ? ['front', 'back', 'closeup'] : ['front', 'back']
  for (const [order, side] of views.entries()) {
    const { big, small } = await demo(`${set}-${side}`)
    const path = `${productId}/${crypto.randomUUID()}.webp`
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, big, { contentType: 'image/webp', cacheControl: PHOTO_CACHE })
    if (error) throw new Error(`Photo upload failed: ${error.message}`)
    await supabase.storage.from(IMAGE_BUCKET).upload(thumbPath(path), small, { contentType: 'image/webp', cacheControl: PHOTO_CACHE })
    unwrap(await supabase.from('product_images').insert({ product_id: productId, path, sort_order: order }))
  }
}

/** Marks the sample items, so they can be found and removed later. */
const DEMO_NOTE = 'Demo piece.'

type DemoKind = 'tee' | 'shirt' | 'jeans'
const DEMO_PRODUCTS: { set: string; kind: DemoKind; name: string; colour: string; price: number; mrp: number; about: string }[] = [
  { set: 'blue-jeans', kind: 'jeans', name: 'Mid Blue Baggy Jeans', colour: 'Mid blue', price: 999, mrp: 2199, about: 'Relaxed through the leg with a soft vintage wash.' },
  { set: 'pink-tee', kind: 'tee', name: 'Balloon Print Oversized Tee', colour: 'Pink', price: 499, mrp: 999, about: 'Heavy cotton, dropped shoulders, balloon print on the back.' },
  { set: 'plaid-shirt', kind: 'shirt', name: 'Black and White Check Shirt', colour: 'Black and white', price: 749, mrp: 1499, about: 'Brushed cotton check with one chest pocket.' },
  { set: 'white-jeans', kind: 'jeans', name: 'White Straight Jeans', colour: 'White', price: 949, mrp: 1999, about: 'Clean straight leg in rigid white denim.' },
  { set: 'black-tee', kind: 'tee', name: 'Think Insane Oversized Tee', colour: 'Black', price: 549, mrp: 1099, about: 'Boxy fit with a big splash print on the back.' },
  { set: 'beige-shirt', kind: 'shirt', name: 'Beige Cotton Overshirt', colour: 'Beige', price: 849, mrp: 1699, about: 'Soft textured cotton, wear it open or buttoned.' },
  { set: 'charcoal-jeans', kind: 'jeans', name: 'Charcoal Loose Jeans', colour: 'Charcoal', price: 899, mrp: 1899, about: 'Loose fit with a faded charcoal wash.' },
  { set: 'lavender-tee', kind: 'tee', name: 'Studio Oversized Tee', colour: 'Lavender', price: 499, mrp: 999, about: 'Oversized tee with a Studio print on the back.' },
  { set: 'shirt', kind: 'shirt', name: 'Sage Green Linen Shirt', colour: 'Sage green', price: 799, mrp: 1599, about: 'Light linen blend, sleeves look good rolled.' },
  { set: 'grey-wide-jeans', kind: 'jeans', name: 'Stone Grey Wide Leg Jeans', colour: 'Stone grey', price: 949, mrp: 1999, about: 'Wide leg, sits on the shoe.' },
  { set: 'grey-jeans', kind: 'jeans', name: 'Grey Wash Wide Jeans', colour: 'Grey', price: 899, mrp: 1899, about: 'Washed grey denim with a wide, easy leg.' },
  { set: 'jeans', kind: 'jeans', name: 'Washed Black Relaxed Jeans', colour: 'Washed black', price: 899, mrp: 1999, about: 'Relaxed fit in a washed black.' },
]
const DEMO_CATEGORY: Record<DemoKind, { name: string; slug: string; sizes: string[]; match: RegExp }> = {
  tee: { name: 'T-Shirts', slug: 't-shirts', sizes: ['S', 'M', 'L', 'XL'], match: /t-?shirt|tee/i },
  shirt: { name: 'Shirts', slug: 'shirts', sizes: ['S', 'M', 'L', 'XL'], match: /^(?!.*t-?shirt).*shirt/i },
  jeans: { name: 'Jeans', slug: 'jeans', sizes: ['30', '32', '34', '36'], match: /jean|denim/i },
}

/**
 * Adds a set of sample items (jeans, tees and shirts) with the mannequin photos, prices and a few
 * pieces in each size, so the shop can be shown before real stock is listed. Items already added
 * are skipped, and missing categories are made.
 */
export async function addDemoProducts(onProgress: (done: number, total: number) => void): Promise<{ added: number }> {
  const categories = unwrap(await supabase.from('categories').select('id, name, slug, sizes')) as { id: string; name: string; slug: string; sizes: string[] }[]
  const have = new Set((unwrap(await supabase.from('products').select('name')) as { name: string }[]).map((p) => p.name))
  const demo = demoPhotoLoader()
  const categoryFor = new Map<DemoKind, { id: string; sizes: string[] }>()

  async function category(kind: DemoKind) {
    let hit = categoryFor.get(kind)
    if (hit) return hit
    const want = DEMO_CATEGORY[kind]
    const found = categories.find((c) => want.match.test(c.slug) || want.match.test(c.name))
    if (found) hit = { id: found.id, sizes: found.sizes?.length ? found.sizes : want.sizes }
    else {
      const made = unwrap(await supabase.from('categories').insert({ name: want.name, slug: want.slug, sizes: want.sizes, sort_order: categories.length }).select('id').single()) as { id: string }
      hit = { id: made.id, sizes: want.sizes }
    }
    categoryFor.set(kind, hit)
    return hit
  }

  const todo = DEMO_PRODUCTS.filter((d) => !have.has(d.name))
  for (const [i, d] of todo.entries()) {
    onProgress(i, todo.length)
    const cat = await category(d.kind)
    const product = unwrap(
      await supabase
        .from('products')
        .insert({ name: d.name, category_id: cat.id, price: d.price, mrp: d.mrp, colour: d.colour, description: `${DEMO_NOTE} ${d.about}`, is_visible: true })
        .select('id')
        .single(),
    ) as { id: string }
    unwrap(await supabase.from('product_sizes').insert(cat.sizes.slice(0, 6).map((size, order) => ({ product_id: product.id, size, stock: [2, 3, 3, 1, 2, 1][order], sort_order: order }))))
    await addDemoPhotos(product.id, d.set, demo)
  }
  onProgress(todo.length, todo.length)
  return { added: todo.length }
}

/** Deletes the sample items added by addDemoProducts, with their photos. */
export async function removeDemoProducts(): Promise<{ removed: number }> {
  const rows = unwrap(await supabase.from('products').select('id, product_images(path)').like('description', `${DEMO_NOTE}%`)) as { id: string; product_images: { path: string }[] }[]
  const files = rows.flatMap((r) => r.product_images.flatMap((i) => [i.path, thumbPath(i.path)]))
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(files.slice(i, i + 100))
    if (error) throw new Error(error.message)
  }
  if (rows.length) unwrap(await supabase.from('products').delete().in('id', rows.map((r) => r.id)))
  return { removed: rows.length }
}
