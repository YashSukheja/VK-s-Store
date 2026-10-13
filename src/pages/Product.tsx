import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { BackIcon, ChatIcon, InfoIcon } from '../components/Icons'
import { Photo } from '../components/Photo'
import { SiteHeader } from '../components/SiteHeader'
import { ErrorBox, Loading } from '../components/States'
import { fetchCategories, fetchProduct, fetchSettings } from '../data/catalog'
import { discountPercent, formatPrice, LOW_STOCK, sortedImages, sortedSizes, whatsappLink } from '../lib/format'
import { imageUrl } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'

const MAX_QTY = 5

export function ProductPage() {
  const { id = '' } = useParams()
  const product = useAsync(() => Promise.all([fetchProduct(id), fetchCategories()]), [id])
  const settings = useAsync(fetchSettings, [])
  const [pickedSize, setPickedSize] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [photoIndex, setPhotoIndex] = useState(0)

  if (product.loading) {
    return (
      <Shell settings={settings.data}>
        <Loading />
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
  const maxQty = current ? Math.min(current.stock, MAX_QTY) : 0
  const quantity = Math.min(qty, Math.max(maxQty, 1))
  const soldOut = !firstAvailable
  const wa = settings.data?.whatsapp_number

  const askText = current
    ? `Hi VK, I'd like to book ${p.name}, size ${current.size}, quantity ${quantity} (${formatPrice(p.price * quantity)}). Is it available?`
    : `Hi VK, will ${p.name} come back in stock?`

  return (
    <Shell settings={settings.data}>
      <div className="grid gap-6 pb-28 md:grid-cols-2 md:gap-10 md:pb-16 md:pt-6">
        {/* Photos: swipe on phones, thumbnails below. */}
        <div className="-mx-5 md:mx-0">
          <div className="relative">
            <div
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
            {category && (
              <Link to={`/?cat=${category.slug}`} className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                {category.name}
              </Link>
            )}
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

          {!soldOut && (
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-[15px] font-extrabold">Quantity</h2>
              <div className="flex items-center rounded-[10px] border-[1.5px] border-field">
                <button type="button" aria-label="Decrease quantity" onClick={() => setQty(Math.max(quantity - 1, 1))} className="size-11 text-xl font-bold">
                  −
                </button>
                <span className="min-w-7 text-center text-base font-extrabold" aria-live="polite">
                  {quantity}
                </span>
                <button type="button" aria-label="Increase quantity" onClick={() => setQty(Math.min(quantity + 1, maxQty))} className="size-11 text-xl font-bold">
                  +
                </button>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-xl bg-surface px-3.5 py-3 text-[13px] leading-normal text-body">
            <InfoIcon size={18} className="mt-px flex-none" />
            <span>Online booking opens soon. Until then, message VK on WhatsApp to book. Pay cash or UPI at pickup or delivery.</span>
          </div>

          {/* Fixed action bar on phones, inline on larger screens. */}
          <div className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-3.5 border-t border-line bg-white px-5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-3 md:static md:border-0 md:p-0">
            {!soldOut && (
              <div className="flex flex-col">
                <span className="text-xs text-muted">Total</span>
                <span className="font-display text-[22px] font-black">{formatPrice(p.price * quantity)}</span>
              </div>
            )}
            {wa ? (
              <a
                href={whatsappLink(wa, askText)}
                target="_blank"
                rel="noreferrer"
                className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-ink text-base font-extrabold text-white"
              >
                <ChatIcon size={20} className="text-accent" />
                {soldOut ? 'Ask when it’s back' : 'Book on WhatsApp'}
              </a>
            ) : (
              <span className="flex h-[54px] flex-1 items-center justify-center rounded-[14px] bg-surface text-sm font-bold text-muted">
                {soldOut ? 'Sold out' : 'Booking opens soon'}
              </span>
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
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
