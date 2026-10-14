import type { CartLine } from '../lib/cart'
import { supabase } from '../lib/supabase'
import type { Booking } from '../lib/types'

export const BOOKING_COLUMNS =
  'id, code, customer_username, customer_mobile, status, fulfilment, delivery_address, payment_method, note, total, created_at, auto_cancelled, customer_id, booking_items(id, product_id, product_name, size, quantity, price)'

export type BookingRequest = {
  lines: CartLine[]
  fulfilment: 'pickup' | 'delivery'
  deliveryAddress: string
  paymentMethod: 'cash' | 'upi'
  note: string
}

/** Places the booking; the database checks stock and sets the prices. Returns the booking code. */
export async function placeBooking(req: BookingRequest): Promise<string> {
  const { data, error } = await supabase.rpc('place_booking', {
    p_items: req.lines.map((l) => ({ product_id: l.productId, size: l.size, quantity: l.quantity })),
    p_fulfilment: req.fulfilment,
    p_delivery_address: req.fulfilment === 'delivery' ? req.deliveryAddress : null,
    p_payment_method: req.paymentMethod,
    p_note: req.note,
  })
  if (error) throw new Error(error.message)
  return (data as { code: string }[])[0].code
}

export async function fetchMyBookings(): Promise<Booking[]> {
  const { data, error } = await supabase.from('bookings').select(BOOKING_COLUMNS).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Booking[]
}

export async function fetchBooking(code: string): Promise<Booking | null> {
  const { data, error } = await supabase.from('bookings').select(BOOKING_COLUMNS).eq('code', code).maybeSingle()
  if (error) throw new Error(error.message)
  return data as Booking | null
}
