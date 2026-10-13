import type { Product } from './types'

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
