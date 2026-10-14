export type Category = {
  id: string
  name: string
  slug: string
  sizes: string[]
  sort_order: number
  is_visible: boolean
}

export type ProductImage = {
  id: string
  path: string
  sort_order: number
}

export type ProductSize = {
  id: string
  size: string
  stock: number
  sort_order: number
}

export type Product = {
  id: string
  category_id: string
  name: string
  description: string
  mrp: number | null
  price: number
  is_visible: boolean
  /** Missing until setup file 5 has been run. */
  on_sale?: boolean
  created_at: string
  product_images: ProductImage[]
  product_sizes: ProductSize[]
}

export type StoreSettings = {
  whatsapp_number: string | null
  upi_id: string | null
  pickup_address: string | null
}

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'rejected' | 'cancelled'

export type BookingItem = {
  id: string
  product_id: string | null
  product_name: string
  size: string
  quantity: number
  price: number
}

export type Booking = {
  id: string
  code: string
  customer_username: string
  customer_mobile: string
  status: BookingStatus
  fulfilment: 'pickup' | 'delivery'
  delivery_address: string | null
  payment_method: 'cash' | 'upi'
  note: string
  total: number
  created_at: string
  auto_cancelled: boolean
  customer_id: string | null
  booking_items: BookingItem[]
}

export type Customer = {
  id: string
  username: string
  mobile: string | null
  created_at: string
  bookings: { count: number }[]
}
