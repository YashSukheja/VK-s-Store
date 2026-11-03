import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { discountPercent, formatPrice, LOW_STOCK, productTag, sortedImages, totalStock } from '../lib/format'
import { imageUrl, thumbUrl } from '../lib/supabase'
import type { Product } from '../lib/types'
import { HeartButton } from './HeartButton'
import { Photo } from './Photo'

export function ProductCard({ product, index = 0, colours = [] }: { product: Product; index?: number; colours?: Product[] }) {
  const [cover, second] = sortedImages(product)
  const stock = totalStock(product)
  const off = discountPercent(product.price, product.mrp)
  const tag = productTag(product)

  return (
    <div className={`relative flex flex-col gap-1.5 ${index < 8 ? 'rise' : 'rise-on-scroll'}`} style={{ '--i': index } as CSSProperties}>
      <Link to={`/p/${product.id}`} className="group flex flex-col gap-1.5">
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-photo">
          <Photo src={cover ? thumbUrl(cover.path) : undefined} fallbackSrc={cover ? imageUrl(cover.path) : undefined} alt={product.name} className="transition-transform duration-500 group-hover:scale-[1.04]" />
          {/* The second photo (usually the back) shows on hover. */}
          {second && (
            <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <Photo src={thumbUrl(second.path)} fallbackSrc={imageUrl(second.path)} alt="" className="[&_span]:hidden" />
            </span>
          )}
          <span className="absolute bottom-0 left-0 bg-ink px-2.5 py-1.5 font-display text-[15px] font-black leading-none text-white">{formatPrice(product.price)}</span>
          {stock === 0 && (
            <span className="absolute left-2 top-2 rounded-md bg-ink px-2 py-1 text-[11px] font-extrabold uppercase text-white">Sold out</span>
          )}
          {stock > 0 && stock <= LOW_STOCK && (
            <span className="absolute left-2 top-2 bg-ink px-2 py-1 text-[11px] font-extrabold uppercase text-white">
              Only {stock} left
            </span>
          )}
          {tag && <Tag tag={tag} className="absolute right-2 top-2" />}
        </div>
        <span className="text-sm font-semibold leading-snug">{product.name}</span>
        {off !== null && product.mrp && (
          <span className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-xs text-muted line-through">{formatPrice(product.mrp)}</span>
            <span className="text-xs font-extrabold">{off}% off</span>
          </span>
        )}
      </Link>
      {/* Sits over the photo's bottom corner; outside the link so it doesn't open the product. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[3/4]">
        <HeartButton productId={product.id} name={product.name} className="pointer-events-auto absolute bottom-1.5 right-1.5 !size-10 bg-white/90" />
      </div>
      {colours.length > 1 && <ColourThumbs colours={colours} current={product.id} />}
    </div>
  )
}

const MAX_THUMBS = 4

/** Small photos of each colour under a card, like big shopping apps. Each opens that colour. */
function ColourThumbs({ colours, current }: { colours: Product[]; current: string }) {
  const extra = colours.length - MAX_THUMBS
  return (
    <div className="flex items-center gap-1.5" aria-label={`${colours.length} colours`} role="group">
      {colours.slice(0, MAX_THUMBS).map((c) => {
        const img = sortedImages(c)[0]
        return (
          <Link
            key={c.id}
            to={`/p/${c.id}`}
            aria-label={c.colour ?? 'Other colour'}
            title={c.colour ?? undefined}
            className={`block h-9 w-7 flex-none overflow-hidden rounded-md bg-photo ${c.id === current ? 'ring-2 ring-ink ring-offset-1' : 'ring-1 ring-line'}`}
          >
            <Photo src={img ? thumbUrl(img.path) : undefined} fallbackSrc={img ? imageUrl(img.path) : undefined} alt="" className="[&_span]:hidden" />
          </Link>
        )
      })}
      <span className="text-xs font-bold text-muted">{extra > 0 ? `+${extra}` : `${colours.length} colours`}</span>
    </div>
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
