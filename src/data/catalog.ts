import { supabase } from '../lib/supabase'
import type { Category, Product, StoreSettings } from '../lib/types'

/** The home page photo of clothes on a rail, uploaded in admin Settings. */
export const HERO_PHOTO_PATH = 'site/hero-photo.webp'
/** Built-in home page photo, used until one is uploaded in admin. */
export const DEMO_HERO_PHOTO = '/demo/hero-mannequin.webp'

export const PRODUCT_COLUMNS =
  // `*` picks up newer columns like on_sale once their SQL has run, without breaking before.
  '*, product_images(*), product_sizes(id, size, stock, sort_order)'

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  return result.data as T
}

export async function fetchCategories(): Promise<Category[]> {
  return unwrap(await supabase.from('categories').select('*').order('sort_order').order('name'))
}

/** Visible products for shoppers; every product for the admin (row rules decide). */
export async function fetchProducts(): Promise<Product[]> {
  return unwrap(
    await supabase.from('products').select(PRODUCT_COLUMNS).order('created_at', { ascending: false }),
  )
}

export async function fetchProduct(id: string): Promise<Product | null> {
  return unwrap(await supabase.from('products').select(PRODUCT_COLUMNS).eq('id', id).maybeSingle())
}

/** The products in the cart, with live prices and stock. */
export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return []
  return unwrap(await supabase.from('products').select(PRODUCT_COLUMNS).in('id', ids))
}

export async function fetchSettings(): Promise<StoreSettings> {
  return unwrap(
    await supabase.from('store_settings').select('*').eq('id', 1).single(),
  )
}

/** All colours of one item, oldest first so the order stays put. */
export async function fetchColours(groupId: string): Promise<Product[]> {
  return unwrap(await supabase.from('products').select(PRODUCT_COLUMNS).eq('group_id', groupId).order('created_at')) as Product[]
}

/** The logged-in customer's saved pieces, newest heart first. Hidden or deleted pieces drop out. */
export async function fetchWishlist(): Promise<Product[]> {
  const rows = unwrap(
    await supabase.from('wishlist').select(`created_at, products(${PRODUCT_COLUMNS})`).order('created_at', { ascending: false }),
  ) as unknown as { products: Product | null }[]
  return rows.flatMap((r) => (r.products ? [r.products] : []))
}
