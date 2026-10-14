import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { discountPercent, formatPrice, LOW_STOCK, productTag, sortedImages, totalStock } from '../lib/format'
import { imageUrl, thumbUrl } from '../lib/supabase'
import type { Product } from '../lib/types'
import { Photo } from './Photo'

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const cover = sortedImages(product)[0]
  const stock = totalStock(product)
  const off = discountPercent(product.price, product.mrp)
  const tag = productTag(product)

  return (
    <Link
      to={`/p/${product.id}`}
      className={`group flex flex-col gap-1.5 ${index < 8 ? 'rise' : 'rise-on-scroll'}`}
      style={{ '--i': index } as CSSProperties}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-photo">
        <Photo src={cover ? thumbUrl(cover.path) : undefined} fallbackSrc={cover ? imageUrl(cover.path) : undefined} alt={product.name} className="transition-transform duration-300 group-hover:scale-[1.03]" />
        {stock === 0 && (
          <span className="absolute left-2 top-2 rounded-md bg-ink px-2 py-1 text-[11px] font-extrabold uppercase text-white">Sold out</span>
        )}
        {stock > 0 && stock <= LOW_STOCK && (
          <span className="absolute left-2 top-2 rounded-md bg-accent px-2 py-1 text-[11px] font-extrabold uppercase text-ink">
            Only {stock} left
          </span>
        )}
        {tag && <Tag tag={tag} className="absolute right-2 top-2" />}
      </div>
      <span className="text-sm font-semibold leading-snug">{product.name}</span>
      <span className="flex flex-wrap items-baseline gap-1.5">
        <span className="font-display text-base font-extrabold">{formatPrice(product.price)}</span>
        {off !== null && product.mrp && (
          <>
            <span className="text-xs text-muted line-through">{formatPrice(product.mrp)}</span>
            <span className="text-xs font-extrabold">{off}% off</span>
          </>
        )}
      </span>
    </Link>
  )
}

export function Tag({ tag, className = '' }: { tag: 'SALE' | 'NEW'; className?: string }) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-[11px] font-extrabold uppercase ${tag === 'SALE' ? 'bg-danger text-white' : 'bg-white text-ink'} ${className}`}
    >
      {tag}
    </span>
  )
}
