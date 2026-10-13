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
  created_at: string
  product_images: ProductImage[]
  product_sizes: ProductSize[]
}

export type StoreSettings = {
  whatsapp_number: string | null
  upi_id: string | null
  pickup_address: string | null
}
