import { supabase } from '../lib/supabase'
import type { Category, Product, StoreSettings } from '../lib/types'

const PRODUCT_COLUMNS =
  // `*` picks up newer columns like on_sale once their SQL has run, without breaking before.
  '*, product_images(id, path, sort_order), product_sizes(id, size, stock, sort_order)'

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
