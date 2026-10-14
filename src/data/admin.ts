import { supabase } from '../lib/supabase'
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
