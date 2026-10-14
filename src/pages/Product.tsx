import { useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { BackIcon, CheckIcon, ChatIcon, InfoIcon, ShareIcon } from '../components/Icons'
import { Photo } from '../components/Photo'
import { CartButton, SiteHeader } from '../components/SiteHeader'
import { ProductPageSkeleton } from '../components/Skeletons'
import { ErrorBox } from '../components/States'
import { fetchCategories, fetchProduct, fetchSettings } from '../data/catalog'
import { discountPercent, formatPrice, LOW_STOCK, sortedImages, sortedSizes, whatsappLink } from '../lib/format'
import { MAX_QTY, useCart } from '../lib/cart'
import { imageUrl } from '../lib/supabase'
import { flyToCart } from '../lib/flyToCart'
import { useAsync } from '../lib/useAsync'
import { useTitle } from '../lib/useTitle'

export function ProductPage() {
  const { id = '' } = useParams()
  const product = useAsync(() => Promise.all([fetchProduct(id), fetchCategories()]), [id])
  const settings = useAsync(fetchSettings, [])
  const [pickedSize, setPickedSize] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [added, setAdded] = useState<string | null>(null)
  const cart = useCart()
  const galleryRef = useRef<HTMLDivElement>(null)
  useTitle(product.data?.[0]?.name)

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

  const [p, categories] = product.data ?? [null, []]
  if (!p) {
    return (
      <Shell settings={settings.data}>
        <div className="py-16 text-center">
          <h1 className="font-display text-2xl font-extrabold">This item isn't available</h1>
          <Link to="/" className="mt-4 inline-flex min-h-11 items-center font-bold underline underline-offset-4">
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
  const firstAvailable = sizes.find((s) => s.stock > 0)
  const current = sizes.find((s) => s.size === pickedSize && s.stock > 0) ?? firstAvailable
  const inCart = current ? (cart.lines.find((l) => l.productId === p.id && l.size === current.size)?.quantity ?? 0) : 0
  const maxQty = current ? Math.max(0, Math.min(current.stock, MAX_QTY) - inCart) : 0
  const quantity = Math.min(qty, Math.max(maxQty, 1))
  const soldOut = !firstAvailable
  const wa = settings.data?.whatsapp_number

  const canAdd = !!current && maxQty > 0
  const askText = `Hi VK, will ${p.name} come back in stock?`

  function addToCart() {
    if (!current || !canAdd) return
    flyToCart(galleryRef.current?.children[photoIndex] ?? galleryRef.current)
    cart.add({ productId: p!.id, size: current.size, quantity })
    setAdded(`${quantity} × size ${current.size}`)
    setQty(1)
  }

  return (
    <Shell settings={settings.data}>
      <div className="grid gap-6 pb-28 md:grid-cols-2 md:gap-10 md:pb-16 md:pt-6">
        {/* Photos: swipe on phones, thumbnails below. */}
        <div className="-mx-5 md:mx-0">
          <div className="relative">
            <div
              ref={galleryRef}
              className="no-scrollbar flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto bg-photo md:rounded-2xl"
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
                  <div key={img.id} className="w-full flex-none snap-center">
                    <Photo src={imageUrl(img.path)} alt={`${p.name}, photo ${i + 1} of ${images.length}`} />
                  </div>
                ))
              )}
            </div>
            <Link
              to="/"
              aria-label="Back to shop"
              className="absolute left-3.5 top-3.5 flex size-11 items-center justify-center rounded-full bg-white md:hidden"
            >
              <BackIcon />
            </Link>
            <div className="absolute right-3.5 top-3.5 rounded-full bg-white md:hidden">
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
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <div className="flex min-h-11 items-center justify-between gap-3">
              {category ? (
                <Link to={`/?cat=${category.slug}`} className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                  {category.name}
                </Link>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => void shareProduct(p.name, p.price, p.id)}
                className="flex min-h-11 items-center gap-1.5 rounded-xl border-[1.5px] border-field px-3 text-sm font-extrabold"
              >
                <ShareIcon size={16} />
                Share
              </button>
            </div>
            <h1 className="m-0 font-display text-[26px] font-extrabold leading-tight md:text-4xl">{p.name}</h1>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-display text-[26px] font-black">{formatPrice(p.price)}</span>
              {off !== null && p.mrp && (
                <>
                  <span className="text-[15px] text-muted line-through">MRP {formatPrice(p.mrp)}</span>
                  <span className="rounded-md bg-accent px-2 py-1 text-xs font-extrabold">
                    YOU SAVE {formatPrice(p.mrp - p.price)}
                  </span>
                </>
              )}
            </div>
            {p.description && <p className="m-0 whitespace-pre-line text-sm leading-relaxed text-body">{p.description}</p>}
          </div>

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
                      className="h-12 min-w-14 cursor-not-allowed rounded-[10px] border-[1.5px] border-dashed border-[#d6d6cf] bg-[#f7f7f4] px-3 text-[15px] font-semibold text-[#a3a39b] line-through"
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
                      className={`h-12 min-w-14 rounded-[10px] px-3 text-[15px] ${
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

          {!soldOut && canAdd && (
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-[15px] font-extrabold">Quantity</h2>
              <div className="flex items-center rounded-[10px] border-[1.5px] border-field">
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
            <span>Book now and pay cash or UPI at pickup or delivery. VK confirms every booking.</span>
          </div>

          {added && (
            <p role="status" className="m-0 flex items-center justify-between gap-3 rounded-xl bg-ink px-3.5 py-3 text-sm font-semibold text-white">
              <span className="flex items-center gap-2">
                <CheckIcon size={18} className="text-accent" />
                Added {added} to your cart
              </span>
              <Link to="/cart" className="font-extrabold text-accent underline underline-offset-4">
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
                className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-accent text-base font-extrabold text-ink"
              >
                <CheckIcon size={20} />
                Added · View cart
              </Link>
            ) : !soldOut ? (
              <button
                type="button"
                disabled={!canAdd}
                onClick={addToCart}
                className="flex h-[54px] flex-1 items-center justify-center rounded-[14px] bg-ink text-base font-extrabold text-white disabled:opacity-40"
              >
                Add to cart
              </button>
            ) : wa ? (
              <a
                href={whatsappLink(wa, askText)}
                target="_blank"
                rel="noreferrer"
                className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-ink text-base font-extrabold text-white"
              >
                <ChatIcon size={20} className="text-accent" />
                Ask when it’s back
              </a>
            ) : (
              <span className="flex h-[54px] flex-1 items-center justify-center rounded-[14px] bg-surface text-sm font-bold text-muted">Sold out</span>
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}

/** Opens the phone's share sheet; on computers without one, opens WhatsApp. */
async function shareProduct(name: string, price: number, id: string) {
  const url = `${window.location.origin}/p/${id}`
  const text = `${name} for ${formatPrice(price)} at VK's Store`
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
    </div>
  )
}
