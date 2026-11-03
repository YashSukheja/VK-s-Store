import { supabase } from '../lib/supabase'

export type Review = {
  id: string
  product_id: string
  customer_name: string
  rating: number
  comment: string
  reply: string | null
  replied_at: string | null
  is_hidden: boolean
  created_at: string
}

/** Shoppers may only read these columns (not who wrote it). */
export const REVIEW_COLUMNS = 'id, product_id, customer_name, rating, comment, reply, replied_at, is_hidden, created_at'

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  return result.data as T
}

/** Shown reviews of an item (all its colours), newest first. Empty before setup file 8. */
export async function fetchReviews(productIds: string[]): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_COLUMNS)
    .in('product_id', productIds)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
  if (error) return []
  return data as Review[]
}

/**
 * What the logged-in customer can do here: the colour they collected (so they can review it)
 * and their own review, if any.
 */
export async function fetchMyReviewState(userId: string, productIds: string[]) {
  const [collected, mine] = await Promise.all([
    supabase
      .from('booking_items')
      .select('product_id, bookings!inner(status, customer_id)')
      .in('product_id', productIds)
      .eq('bookings.status', 'completed')
      .eq('bookings.customer_id', userId)
      .limit(1),
    supabase.from('reviews').select(REVIEW_COLUMNS).eq('customer_id', userId).in('product_id', productIds).limit(1),
  ])
  return {
    collectedId: (collected.data?.[0]?.product_id as string | undefined) ?? null,
    mine: ((mine.data ?? [])[0] as Review | undefined) ?? null,
  }
}

export async function submitReview(productId: string, rating: number, comment: string) {
  const { error } = await supabase.rpc('submit_review', { p_product_id: productId, p_rating: rating, p_comment: comment })
  if (error) throw new Error(error.message)
}

export type ReviewWithProduct = Review & { products: { id: string; name: string } | null }

export async function fetchMyReviews(userId: string): Promise<ReviewWithProduct[]> {
  return unwrap<unknown>(
    await supabase
      .from('reviews')
      .select(`${REVIEW_COLUMNS}, products(id, name)`)
      .eq('customer_id', userId)
      .order('created_at', { ascending: false }),
  ) as unknown as ReviewWithProduct[]
}

export async function fetchAllReviews(): Promise<ReviewWithProduct[]> {
  return unwrap<unknown>(
    await supabase.from('reviews').select(`${REVIEW_COLUMNS}, products(id, name)`).order('created_at', { ascending: false }).limit(200),
  ) as unknown as ReviewWithProduct[]
}

/** For the home page: the newest good review with words, and the average over all shown reviews. */
/** The newest good reviews with words (up to 6) and the star average, for the home page. */
export async function fetchReviewWall(): Promise<{ reviews: Review[]; average: number; count: number } | null> {
  const [best, all] = await Promise.all([
    supabase.from('reviews').select(REVIEW_COLUMNS).eq('is_hidden', false).gte('rating', 4).neq('comment', '').order('created_at', { ascending: false }).limit(6),
    supabase.from('reviews').select('rating').eq('is_hidden', false).limit(1000),
  ])
  const reviews = (best.data ?? []) as Review[]
  const ratings = (all.data ?? []) as { rating: number }[]
  if (reviews.length === 0 || ratings.length === 0) return null
  return { reviews, average: ratings.reduce((s, r) => s + r.rating, 0) / ratings.length, count: ratings.length }
}
