import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackIcon, CheckIcon, ChatIcon, InfoIcon, ShareIcon } from '../components/Icons'
import { Photo } from '../components/Photo'
import { HeartButton } from '../components/HeartButton'
import { RestockRequest } from '../components/RestockRequest'
import { Reviews } from '../components/Reviews'
import { CartButton, SiteHeader, WishButton } from '../components/SiteHeader'
import { RecentlyViewed } from '../components/RecentlyViewed'
import { rememberViewed } from '../lib/recent'
import { buzz } from '../lib/toast'
import { SiteFooter } from '../components/SiteFooter'
import { ProductPageSkeleton } from '../components/Skeletons'
import { ErrorBox } from '../components/States'
import { fetchCategories, fetchColours, fetchProduct, fetchProducts, fetchSettings } from '../data/catalog'
import { displayName, groupKey } from '../lib/colours'
import { filledMeasures } from '../lib/measurements'
import type { Product } from '../lib/types'
import { discountPercent, formatPrice, LOW_STOCK, productTag, sortedImages, sortedSizes, totalStock, whatsappLink } from '../lib/format'
import { ProductCard, Tag } from '../components/ProductCard'
import { MAX_QTY, useCart } from '../lib/cart'
import { imageUrl, thumbUrl } from '../lib/supabase'
import { flyToCart } from '../lib/flyToCart'
import { useAsync } from '../lib/useAsync'
import { useTitle } from '../lib/useTitle'

export function ProductPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  // Back goes to the page you came from; opened from a shared link, it goes to the shop.
  const goBack = () => ((window.history.state as { idx?: number } | null)?.idx ? navigate(-1) : navigate('/shop'))
  const product = useAsync(async () => {
    const [found, categories] = await Promise.all([fetchProduct(id), fetchCategories()])
    const colours = found?.group_id ? await fetchColours(found.group_id) : []
    return [found, categories, colours] as const
  }, [id], 'product')
  const settings = useAsync(fetchSettings, [], 'settings')
  const all = useAsync(fetchProducts, [], 'products')
  const [pickedSize, setPickedSize] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [added, setAdded] = useState<string | null>(null)
  const cart = useCart()
  const galleryRef = useRef<HTMLDivElement>(null)
  useTitle(product.data?.[0] ? displayName(product.data[0]) : undefined)
  const shownId = product.data?.[0]?.id
  // Remember this piece for "Recently viewed" (on this phone only).
  useEffect(() => {
    if (shownId) rememberViewed(shownId)
  }, [shownId])

  if (product.loading) {
    return (
      <Shell settings={settings.data}>
        <ProductPageSkeleton />
      </Shell>
    )
  }
  if (product.error) {
    return (
      <Shell settings={settings.data}>
        <ErrorBox message={product.error} onRetry={product.reload} />
      </Shell>
    )
  }

  const [p, categories, colours] = product.data ?? [null, [], []]
  if (!p) {
    return (
      <Shell settings={settings.data}>
        <div className="py-16 text-center">
          <h1 className="font-display text-2xl font-extrabold">This item isn't available</h1>
          <Link to="/shop" className="mt-4 inline-flex min-h-11 items-center font-bold underline underline-offset-4">
            Back to the shop
          </Link>
        </div>
      </Shell>
    )
  }

  const images = sortedImages(p)
  const sizes = sortedSizes(p)
  const category = categories.find((c) => c.id === p.category_id)
  const off = discountPercent(p.price, p.mrp)
  const tag = productTag(p)
  const firstAvailable = sizes.find((s) => s.stock > 0)
  const current = sizes.find((s) => s.size === pickedSize && s.stock > 0) ?? firstAvailable
  const inCart = current ? (cart.lines.find((l) => l.productId === p.id && l.size === current.size)?.quantity ?? 0) : 0
  const maxQty = current ? Math.max(0, Math.min(current.stock, MAX_QTY) - inCart) : 0
  const quantity = Math.min(qty, Math.max(maxQty, 1))
  const soldOut = !firstAvailable
  const wa = settings.data?.whatsapp_number

  const canAdd = !!current && maxQty > 0
  const measures = filledMeasures(p.measurements)
  const pairs = goesWellWith(p, all.data ?? [])

  function showPhoto(i: number) {
    const el = galleryRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }
  const askText = `Hi Vrack, will ${displayName(p)} come back in stock?`

  function addToCart() {
    if (!current || !canAdd) return
    flyToCart(galleryRef.current?.children[photoIndex] ?? galleryRef.current)
    cart.add({ productId: p!.id, size: current.size, quantity })
    buzz(30)
    setAdded(`${quantity} × size ${current.size}`)
    setQty(1)
  }

  return (
    <Shell settings={settings.data}>
      <div className={`grid gap-6 md:grid-cols-2 md:gap-10 md:pb-16 md:pt-6 ${pairs.length ? 'pb-12' : 'pb-28'}`}>
        {/* Photos: swipe on phones, thumbnails below. */}
        <div className="-mx-5 md:mx-0">
          <div className="relative">
            <div
              ref={galleryRef}
              className="no-scrollbar flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto bg-photo"
              onScroll={(e) => {
                const el = e.currentTarget
                setPhotoIndex(Math.round(el.scrollLeft / el.clientWidth))
              }}
            >
              {images.length === 0 ? (
                <div className="w-full flex-none">
                  <Photo alt={p.name} />
                </div>
              ) : (
                images.map((img, i) => (
                  <div key={img.id} className="relative w-full flex-none snap-center">
                    <Photo src={imageUrl(img.path)} alt={`${p.name}, ${img.is_real ? 'real photo' : 'photo'} ${i + 1} of ${images.length}`} />
                    {img.is_real && (
                      <span className="absolute bottom-10 left-3.5 bg-white px-2 py-1 text-[11px] font-extrabold uppercase md:bottom-3.5">Real photo</span>
                    )}
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="absolute left-3.5 top-3.5 flex size-11 items-center justify-center bg-white md:hidden"
            >
              <BackIcon />
            </button>
            <div className="absolute right-3.5 top-3.5 flex bg-white md:hidden">
              <WishButton />
              <CartButton count={cart.count} />
            </div>
            {images.length > 1 && (
              <div className="absolute bottom-3.5 left-0 right-0 flex justify-center gap-1.5" aria-hidden="true">
                {images.map((img, i) => (
                  <span key={img.id} className={`h-1.5 rounded-full ${i === photoIndex ? 'w-[18px] bg-ink' : 'w-1.5 bg-[#bdbdb5]'}`} />
                ))}
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-2.5 hidden gap-2.5 md:flex" role="group" aria-label="Photos">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  aria-label={`Show photo ${i + 1}`}
                  aria-pressed={i === photoIndex}
                  onClick={() => showPhoto(i)}
                  className={`h-24 w-20 overflow-hidden bg-photo ${i === photoIndex ? 'ring-2 ring-ink ring-offset-2' : 'opacity-70 hover:opacity-100'}`}
                >
                  <Photo src={thumbUrl(img.path)} fallbackSrc={imageUrl(img.path)} alt="" className="[&_span]:hidden" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <div className="flex min-h-11 items-center justify-between gap-3">
              {category ? (
                <Link to={`/shop?cat=${category.slug}`} className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                  {category.name}
                </Link>
              ) : (
                <span />
              )}
              <span className="flex items-center gap-2">
              <HeartButton productId={p.id} name={displayName(p)} className="border-[1.5px] border-field" />
              <button
                type="button"
                onClick={() => void shareProduct(displayName(p), p.price, p.id)}
                className="flex min-h-11 items-center gap-1.5 rounded-xl border-[1.5px] border-field px-3 text-sm font-extrabold"
              >
                <ShareIcon size={16} />
                Share
              </button>
              </span>
            </div>
            <h1 className="m-0 font-display text-[28px] font-black uppercase leading-[0.95] md:text-5xl">{p.name}</h1>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-display text-[26px] font-black">{formatPrice(p.price)}</span>
              {tag && <Tag tag={tag} className={tag === 'NEW' ? 'border-[1.5px] border-ink' : ''} />}
              {off !== null && p.mrp && (
                <>
                  <span className="text-[15px] text-muted line-through">MRP {formatPrice(p.mrp)}</span>
                  <span className="bg-ink px-2 py-1 text-xs font-extrabold text-white">
                    YOU SAVE {formatPrice(p.mrp - p.price)}
                  </span>
                </>
              )}
            </div>
            {p.description && <p className="m-0 whitespace-pre-line text-sm leading-relaxed text-body">{p.description}</p>}
          </div>

          {colours.length > 1 && (
            <section className="flex flex-col gap-3">
              <h2 className="m-0 text-[15px] font-extrabold">
                Colour: <span className="font-semibold text-body">{p.colour ?? 'This one'}</span>
              </h2>
              <div className="no-scrollbar -mx-5 flex gap-2.5 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Choose a colour">
                {colours.map((c) => {
                  const img = sortedImages(c)[0]
                  const current = c.id === p.id
                  return (
                    <Link
                      key={c.id}
                      to={`/p/${c.id}`}
                      replace
                      aria-current={current ? 'true' : undefined}
                      className="flex w-16 flex-none flex-col items-center gap-1"
                    >
                      <span className={`block h-20 w-16 overflow-hidden rounded-lg bg-photo ${current ? 'ring-2 ring-ink ring-offset-2' : 'ring-1 ring-line'}`}>
                        <Photo src={img ? thumbUrl(img.path) : undefined} fallbackSrc={img ? imageUrl(img.path) : undefined} alt="" className="[&_span]:hidden" />
                      </span>
                      <span className={`w-full truncate text-center text-xs ${current ? 'font-extrabold' : 'font-semibold text-muted'}`}>{c.colour ?? 'Other'}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="m-0 text-[15px] font-extrabold">Size</h2>
              {current && (
                <span className="text-[13px] text-muted">
                  {current.stock <= LOW_STOCK ? `Only ${current.stock} left in ${current.size}` : `${current.stock} in stock`}
                </span>
              )}
            </div>
            {sizes.length === 0 ? (
              <p className="m-0 text-sm text-muted">Sizes coming soon.</p>
            ) : (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a size">
                {sizes.map((s) =>
                  s.stock === 0 ? (
                    <button
                      key={s.id}
                      type="button"
                      disabled
                      aria-label={`${s.size}, sold out`}
                      className="h-12 min-w-14 cursor-not-allowed rounded-none border-[1.5px] border-dashed border-[#d6d6cf] bg-[#f7f7f4] px-3 text-[15px] font-semibold text-[#a3a39b] line-through"
                    >
                      {s.size}
                    </button>
                  ) : (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={current?.id === s.id}
                      onClick={() => {
                        setPickedSize(s.size)
                        setQty(1)
                        setAdded(null)
                      }}
                      className={`h-12 min-w-14 rounded-none px-3 text-[15px] ${
                        current?.id === s.id
                          ? 'border-2 border-ink bg-ink font-extrabold text-white'
                          : 'border-[1.5px] border-field bg-white font-bold'
                      }`}
                    >
                      {s.size}
                    </button>
                  ),
                )}
              </div>
            )}
          </section>

          {measures.length > 0 && (
            <section className="flex flex-col gap-2" aria-labelledby="measurements">
              <h2 id="measurements" className="m-0 text-[15px] font-extrabold">
                Measurements
              </h2>
              <dl className="m-0 flex flex-wrap pl-[1.5px] pt-[1.5px]">
                {measures.map((m) => (
                  <div key={m.key} className="-ml-[1.5px] -mt-[1.5px] flex min-w-24 flex-1 flex-col gap-0.5 border-[1.5px] border-ink px-3 py-2.5 sm:flex-none" title={m.hint}>
                    <dt className="text-xs text-muted">{m.label}</dt>
                    <dd className="m-0 font-display text-lg font-black">
                      {m.value} {p.measurements!.unit}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="m-0 text-xs text-muted">
                Measured on this piece, laid flat.
                {measures.some((m) => m.key === 'chest' || m.key === 'waist') && ' Chest and waist are doubled, so they match your body size.'}
              </p>
            </section>
          )}

          <RestockRequest productId={p.id} soldOut={sizes.filter((s) => s.stock === 0).map((s) => s.size)} />

          {!soldOut && canAdd && (
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-[15px] font-extrabold">Quantity</h2>
              <div className="flex items-center rounded-none border-[1.5px] border-field">
                <button type="button" aria-label="Decrease quantity" onClick={() => {
                    setQty(Math.max(quantity - 1, 1))
                    setAdded(null)
                  }} className="size-11 text-xl font-bold">
                  −
                </button>
                <span className="min-w-7 text-center text-base font-extrabold" aria-live="polite">
                  {quantity}
                </span>
                <button type="button" aria-label="Increase quantity" onClick={() => {
                    setQty(Math.min(quantity + 1, maxQty))
                    setAdded(null)
                  }} className="size-11 text-xl font-bold">
                  +
                </button>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-xl bg-surface px-3.5 py-3 text-[13px] leading-normal text-body">
            <InfoIcon size={18} className="mt-px flex-none" />
            <span>Book now and pay cash or UPI at pickup or delivery. We confirm every booking.</span>
          </div>

          {added && (
            <p role="status" className="m-0 flex items-center justify-between gap-3 rounded-xl bg-ink px-3.5 py-3 text-sm font-semibold text-white">
              <span className="flex items-center gap-2">
                <CheckIcon size={18} className="text-white" />
                Added {added} to your cart
              </span>
              <Link to="/cart" className="font-extrabold text-white underline underline-offset-4">
                View cart
              </Link>
            </p>
          )}
          {!added && !soldOut && !canAdd && current && (
            <p className="m-0 text-sm text-muted">
              You have all available size {current.size} pieces in your{' '}
              <Link to="/cart" className="font-bold text-ink underline underline-offset-4">
                cart
              </Link>
              .
            </p>
          )}

          <Reviews productIds={colours.length > 1 ? colours.map((c) => c.id) : [p.id]} />

          {/* Fixed action bar on phones, inline on larger screens. */}
          <div className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-3.5 border-t border-line bg-white px-5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-3 md:static md:border-0 md:p-0">
            {!soldOut && (
              <div className="flex flex-col">
                <span className="text-xs text-muted">Total</span>
                <span className="font-display text-[22px] font-black">{formatPrice(p.price * (canAdd ? quantity : 1))}</span>
              </div>
            )}
            {added ? (
              <Link
                to="/cart"
                className="flex h-[54px] flex-1 items-center justify-center gap-2 border-[1.5px] border-ink bg-white text-base font-extrabold text-ink"
              >
                <CheckIcon size={20} />
                Added · View cart
              </Link>
            ) : !soldOut ? (
              <button
                type="button"
                disabled={!canAdd}
                onClick={addToCart}
                className="flex h-[54px] flex-1 items-center justify-center rounded-none bg-ink text-base font-extrabold text-white disabled:opacity-40"
              >
                Add to cart
              </button>
            ) : wa ? (
              <a
                href={whatsappLink(wa, askText)}
                target="_blank"
                rel="noreferrer"
                className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-none bg-ink text-base font-extrabold text-white"
              >
                <ChatIcon size={20} />
                Ask when it’s back
              </a>
            ) : (
              <span className="flex h-[54px] flex-1 items-center justify-center rounded-none bg-surface text-sm font-bold text-muted">Sold out</span>
            )}
          </div>
        </div>
      </div>
      {pairs.length > 0 && (
        <section aria-labelledby="pairs" className="pb-12 md:pb-6">
          <h2 id="pairs" className="m-0 mb-4 font-display text-2xl font-black uppercase md:text-4xl">
            Goes well with
          </h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 lg:gap-x-5">
            {pairs.map((x, i) => (
              <ProductCard key={x.id} product={x} index={i} />
            ))}
          </div>
        </section>
      )}
      <RecentlyViewed key={p.id} skip={p.id} className="pb-28 md:pb-10" />
    </Shell>
  )
}

/** Up to 4 newest pieces in stock from other types, one per item. */
function goesWellWith(p: Product, all: Product[]): Product[] {
  const seen = new Set<string>()
  return all
    .filter((x) => x.category_id !== p.category_id && totalStock(x) > 0 && !seen.has(groupKey(x)) && seen.add(groupKey(x)))
    .slice(0, 4)
}

/** Opens the phone's share sheet; on computers without one, opens WhatsApp. */
async function shareProduct(name: string, price: number, id: string) {
  const url = `${window.location.origin}/p/${id}`
  const text = `${name} for ${formatPrice(price)} at Vrack Clothing`
  if (navigator.share) {
    try {
      await navigator.share({ title: name, text, url })
    } catch {
      // Closing the share sheet throws; nothing to do.
    }
    return
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener')
}

function Shell({ children, settings }: { children: ReactNode; settings?: Parameters<typeof SiteHeader>[0]['settings'] }) {
  return (
    <div className="min-h-dvh bg-white">
      <div className="hidden md:block">
        <SiteHeader settings={settings} />
      </div>
      <main className="mx-auto max-w-6xl px-5">{children}</main>
      <SiteFooter settings={settings} roomForBar />
    </div>
  )
}
