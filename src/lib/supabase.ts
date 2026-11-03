import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.')
}

export const supabase = createClient(url, anonKey)

export const IMAGE_BUCKET = 'product-images'
/** Product photos never change once uploaded (each has a unique name), so phones may keep them for a year. */
export const PHOTO_CACHE = '31536000'

export function imageUrl(path: string): string {
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}

/** The small copy of a photo (see thumbPath in images.ts). */
export function thumbUrl(path: string): string {
  return imageUrl(path.replace(/\.webp$/, '') + '.thumb.webp')
}
