import { useRef } from 'react'
import { Link } from 'react-router'
import { fetchProductsByIds } from '../data/catalog'
import type { Product } from '../lib/types'
import { useAsync } from '../lib/useAsync'
import { useWishlist } from '../lib/wishlist'
import { ProductCard } from './ProductCard'
import { Empty, ErrorBox, Loading } from './States'

/** The saved pieces, newest first. Un-hearting one fades it out of the grid. */
export function SavedGrid() {
  const { order, ids } = useWishlist()
  // Products already loaded are kept, so removing a heart doesn't reload the grid.
  const known = useRef(new Map<string, Product>())
  const missing = order.filter((id) => !known.current.has(id))
  const list = useAsync(
    async () => {
      if (missing.length) for (const p of await fetchProductsByIds(missing)) known.current.set(p.id, p)
      return true
    },
    [missing.join(',')],
  )
  if (order.length === 0) {
    return (
      <Empty>
        Nothing saved yet. Tap the heart on any piece to keep it here.{' '}
        <Link to="/shop" className="font-extrabold underline underline-offset-4">
          Browse the shop
        </Link>
      </Empty>
    )
  }
  if (list.loading && missing.length) return <Loading />
  if (list.error) return <ErrorBox message={list.error} onRetry={list.reload} />
  const items = order.flatMap((id) => (known.current.has(id) && ids.has(id) ? [known.current.get(id)!] : []))
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6">
      {items.map((p, i) => (
        <div key={p.id} className="saved-in">
          <ProductCard product={p} index={i} />
        </div>
      ))}
    </div>
  )
}
