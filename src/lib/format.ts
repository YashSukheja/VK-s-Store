import type { Booking, BookingStatus, Product } from './types'

const rupee = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function formatPrice(amount: number): string {
  return rupee.format(amount)
}

/** Whole-number discount percentage, or null when there is no saving. */
export function discountPercent(price: number, mrp: number | null): number | null {
  if (!mrp || mrp <= price) return null
  return Math.round((1 - price / mrp) * 100)
}

export function totalStock(product: Pick<Product, 'product_sizes'>): number {
  return product.product_sizes.reduce((sum, s) => sum + s.stock, 0)
}

export function sortedImages(product: Pick<Product, 'product_images'>) {
  return [...product.product_images].sort((a, b) => a.sort_order - b.sort_order)
}

export function sortedSizes(product: Pick<Product, 'product_sizes'>) {
  return [...product.product_sizes].sort((a, b) => a.sort_order - b.sort_order)
}

/** "Only N left" shows when 2 or fewer pieces remain. */
export const LOW_STOCK = 2

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/** Builds a wa.me link that opens WhatsApp with a filled-in message. */
export function whatsappLink(number: string, message: string): string {
  return `https://wa.me/91${number}?text=${encodeURIComponent(message)}`
}

const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Waiting for VK',
  confirmed: 'Confirmed',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

/** The WhatsApp message a customer sends VK after booking. */
export function bookingMessage(b: Booking): string {
  const lines = b.booking_items.map(
    (i, n) => `${n + 1}. ${i.product_name} | Size ${i.size} | Qty ${i.quantity} | ${formatPrice(i.price * i.quantity)}`,
  )
  return [
    `New booking ${b.code}`,
    `Customer: ${b.customer_username} (${b.customer_mobile})`,
    ...lines,
    `Total: ${formatPrice(b.total)}`,
    b.fulfilment === 'pickup' ? 'Pickup from the shop' : `Delivery to: ${b.delivery_address}`,
    `Payment: ${b.payment_method === 'upi' ? 'UPI' : 'Cash'}`,
    ...(b.note ? [`Note: ${b.note}`] : []),
    `Booked: ${formatDateTime(b.created_at)}`,
  ].join('\n')
}

/** What VK sends the customer on WhatsApp after confirming or rejecting. */
export function customerMessage(b: Booking, pickupAddress: string | null): string {
  const hi = `Hi ${b.customer_username}, this is VK's Store about your booking ${b.code} (${formatPrice(b.total)}).`
  switch (b.status) {
    case 'confirmed':
      return b.fulfilment === 'pickup'
        ? `${hi} It's confirmed! Your clothes are kept aside for you. Pick them up at: ${pickupAddress ?? 'the shop'}.`
        : `${hi} It's confirmed! We'll deliver to: ${b.delivery_address}.`
    case 'completed':
      return `${hi} Thank you for shopping with us!`
    case 'rejected':
      return `${hi} Sorry, we couldn't confirm it this time. The items are no longer available.`
    case 'cancelled':
      return `${hi} Your booking has been cancelled.`
    default:
      return `${hi} `
  }
}
