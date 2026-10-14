import { supabase } from '../lib/supabase'

/** Shown when setup file 6 hasn't been run in Supabase yet. */
const NOT_SET_UP = 'Back-in-stock requests need setup file 6. Run it in Supabase first.'

function missing(message: string) {
  return /stock_requests|request_restock|schema cache/.test(message)
}

/** Sizes of this product the logged-in customer is waiting for. Empty if the feature isn't set up. */
export async function fetchMyRequests(productId: string): Promise<string[]> {
  const { data, error } = await supabase.from('stock_requests').select('size').eq('product_id', productId).is('notified_at', null)
  if (error) return []
  return data.map((r) => r.size as string)
}

export async function requestRestock(productId: string, size: string): Promise<void> {
  const { error } = await supabase.rpc('request_restock', { p_product_id: productId, p_size: size })
  if (error) throw new Error(missing(error.message) ? NOT_SET_UP : error.message)
}

export async function cancelRequest(productId: string, size: string): Promise<void> {
  const { error } = await supabase.from('stock_requests').delete().eq('product_id', productId).eq('size', size)
  if (error) throw new Error(error.message)
}

export type OpenRequest = { id: string; size: string; created_at: string; customer: { username: string; mobile: string | null } | null }

/** How many customers wait for each product. Empty if the feature isn't set up. */
export async function fetchOpenRequestCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('stock_requests').select('product_id').is('notified_at', null)
  const counts = new Map<string, number>()
  if (error) return counts
  for (const r of data) counts.set(r.product_id as string, (counts.get(r.product_id as string) ?? 0) + 1)
  return counts
}

export async function fetchOpenRequests(productId: string): Promise<OpenRequest[]> {
  const { data, error } = await supabase
    .from('stock_requests')
    .select('id, size, created_at, customer:profiles(username, mobile)')
    .eq('product_id', productId)
    .is('notified_at', null)
    .order('created_at')
  if (error) return []
  return data as unknown as OpenRequest[]
}

export async function markTold(id: string): Promise<void> {
  const { error } = await supabase.from('stock_requests').update({ notified_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}
