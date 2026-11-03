import { useState } from 'react'
import { fetchProductsByIds } from '../data/catalog'
import { recentIds } from '../lib/recent'
import { useAsync } from '../lib/useAsync'
import { ProductCard } from './ProductCard'

/**
 * A sideways row of the pieces this shopper opened last (kept on the phone), newest first.
 * Shows nothing until they have looked at something. `skip` leaves out the piece on screen.
 */
export function RecentlyViewed({ skip, className = '' }: { skip?: string; className?: string }) {
  const [ids] = useState(() => recentIds().filter((id) => id !== skip))
  const list = useAsync(() => (ids.length ? fetchProductsByIds(ids) : Promise.resolve([])), [ids.join(',')])
  const items = ids.flatMap((id) => list.data?.filter((p) => p.id === id) ?? [])
  if (items.length === 0) return null
  return (
    <section aria-labelledby="recent" className={className}>
      <h2 id="recent" className="m-0 mb-4 font-display text-2xl font-black uppercase md:text-4xl">
        Recently viewed
      </h2>
      <ul className="no-scrollbar -mx-5 flex list-none snap-x gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0 lg:gap-5">
        {items.map((p, i) => (
          <li key={p.id} className="w-[40vw] max-w-52 flex-none snap-start">
            <ProductCard product={p} index={i} />
          </li>
        ))}
      </ul>
    </section>
  )
}
