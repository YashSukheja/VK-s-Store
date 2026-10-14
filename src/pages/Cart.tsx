import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { fieldClass } from '../components/admin'
import { CloseIcon } from '../components/Icons'
import { Page } from '../components/Page'
import { Photo } from '../components/Photo'
import { Empty, ErrorBox, Loading } from '../components/States'
import { placeBooking } from '../data/bookings'
import { fetchProductsByIds, fetchSettings } from '../data/catalog'
import { useAuth } from '../lib/auth'
import { MAX_QTY, useCart } from '../lib/cart'
import { formatPrice, sortedImages } from '../lib/format'
import { imageUrl, thumbUrl } from '../lib/supabase'
import type { Product } from '../lib/types'
import { useAsync } from '../lib/useAsync'

type Row = {
  productId: string
  size: string
  quantity: number
  product?: Product
  stock: number
  problem: string | null
}

export function Cart() {
  const cart = useCart()
  const { session, role } = useAuth()
  const navigate = useNavigate()
  const ids = [...new Set(cart.lines.map((l) => l.productId))]
  const products = useAsync(() => fetchProductsByIds(ids), [ids.join(',')])
  const settings = useAsync(fetchSettings, [])

  const [fulfilment, setFulfilment] = useState<'pickup' | 'delivery'>('pickup')
  const [address, setAddress] = useState('')
  const [payment, setPayment] = useState<'cash' | 'upi'>('cash')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (cart.lines.length === 0) {
    return (
      <Page title="Your cart">
        <Empty>
          Your cart is empty.{' '}
          <Link to="/" className="font-extrabold underline underline-offset-4">
            Browse the shop
          </Link>
        </Empty>
      </Page>
    )
  }
  if (products.loading && !products.data) {
    return (
      <Page title="Your cart">
        <Loading label="Loading your cart" />
      </Page>
    )
  }
  if (products.error) {
    return (
      <Page title="Your cart">
        <ErrorBox message={products.error} onRetry={products.reload} />
      </Page>
    )
  }

  const rows: Row[] = cart.lines.map((l) => {
    const product = products.data?.find((p) => p.id === l.productId)
    const stock = product?.product_sizes.find((s) => s.size === l.size)?.stock ?? 0
    let problem: string | null = null
    if (!product) problem = 'No longer available. Remove it to continue.'
    else if (stock === 0) problem = `Size ${l.size} is sold out. Remove it to continue.`
    else if (l.quantity > stock) problem = `Only ${stock} left in size ${l.size}. Lower the quantity.`
    return { ...l, product, stock, problem }
  })
  const total = rows.reduce((sum, r) => sum + (r.product ? r.product.price * r.quantity : 0), 0)
  const hasProblem = rows.some((r) => r.problem)
  const pickupAddress = settings.data?.pickup_address
  const upiId = settings.data?.upi_id

  async function book() {
    setError(null)
    if (fulfilment === 'delivery' && address.trim().length < 5) return setError('Add your delivery address.')
    setBusy(true)
    try {
      const code = await placeBooking({ lines: cart.lines, fulfilment, deliveryAddress: address, paymentMethod: payment, note })
      cart.clear()
      navigate(`/bookings/${code}?new=1`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      products.reload()
      setBusy(false)
    }
  }

  return (
    <Page title="Your cart">
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((r) => {
          const cover = r.product ? sortedImages(r.product)[0] : undefined
          const max = Math.max(1, Math.min(r.stock, MAX_QTY))
          return (
            <li key={`${r.productId}-${r.size}`} className="flex gap-3 border-b border-line pb-3">
              <Link to={`/p/${r.productId}`} className="block h-24 w-[72px] flex-none overflow-hidden rounded-lg bg-photo">
                <Photo src={cover ? thumbUrl(cover.path) : undefined} fallbackSrc={cover ? imageUrl(cover.path) : undefined} alt={r.product?.name ?? 'Item'} />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold leading-snug">{r.product?.name ?? 'Unavailable item'}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${r.product?.name ?? 'item'}, size ${r.size}`}
                    onClick={() => cart.remove(r.productId, r.size)}
                    className="-mr-2 -mt-2 flex size-10 flex-none items-center justify-center text-muted"
                  >
                    <CloseIcon size={18} />
                  </button>
                </div>
                <span className="text-[13px] text-muted">Size {r.size}</span>
                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center rounded-[10px] border-[1.5px] border-field">
                    <button
                      type="button"
                      aria-label={`Fewer of ${r.product?.name ?? 'item'}`}
                      onClick={() => cart.setQuantity(r.productId, r.size, r.quantity - 1)}
                      className="size-9 text-lg font-bold"
                    >
                      −
                    </button>
                    <span className="min-w-6 text-center text-sm font-extrabold">{r.quantity}</span>
                    <button
                      type="button"
                      aria-label={`More of ${r.product?.name ?? 'item'}`}
                      disabled={r.quantity >= max}
                      onClick={() => cart.setQuantity(r.productId, r.size, r.quantity + 1)}
                      className="size-9 text-lg font-bold disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                  {r.product && <span className="font-display text-base font-extrabold">{formatPrice(r.product.price * r.quantity)}</span>}
                </div>
                {r.problem && <span className="text-xs font-bold text-danger">{r.problem}</span>}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex items-baseline justify-between">
        <span className="text-sm font-bold">Total</span>
        <span className="font-display text-2xl font-black">{formatPrice(total)}</span>
      </div>

      <Section title="How do you want it?">
        <Choice name="fulfilment" checked={fulfilment === 'pickup'} onChange={() => setFulfilment('pickup')} label="Pickup from the shop">
          {pickupAddress ?? 'VK will share the address.'}
        </Choice>
        <Choice name="fulfilment" checked={fulfilment === 'delivery'} onChange={() => setFulfilment('delivery')} label="Delivery">
          VK will confirm the delivery charge, if any.
        </Choice>
        {fulfilment === 'delivery' && (
          <label className="flex flex-col gap-1.5 text-sm font-extrabold">
            Delivery address
            <textarea
              rows={3}
              maxLength={300}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value)
                setError(null)
              }}
              placeholder="House, street, area, landmark"
              className={`${fieldClass} h-auto py-2.5`}
            />
          </label>
        )}
      </Section>

      <Section title="How will you pay?">
        <Choice name="payment" checked={payment === 'cash'} onChange={() => setPayment('cash')} label="Cash">
          Pay when you get your clothes.
        </Choice>
        <Choice name="payment" checked={payment === 'upi'} onChange={() => setPayment('upi')} label="UPI">
          {upiId ? `Pay to ${upiId} when you get your clothes.` : 'Pay by UPI when you get your clothes.'}
        </Choice>
      </Section>

      <label className="flex flex-col gap-1.5 text-sm font-extrabold">
        Note for VK (optional)
        <input className={fieldClass} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Best time to reach you, etc." />
      </label>

      {error && (
        <p role="alert" className="m-0 rounded-xl bg-warn-bg px-3.5 py-3 text-sm font-semibold text-warn-ink">
          {error}
        </p>
      )}

      {!session ? (
        <Link to="/login?next=/cart" className="flex h-[54px] items-center justify-center rounded-[14px] bg-ink text-base font-extrabold text-white">
          Log in to book
        </Link>
      ) : role === 'admin' ? (
        <p className="m-0 rounded-xl bg-surface px-3.5 py-3 text-sm text-body">You're logged in as the admin. Log in with a customer account to book.</p>
      ) : (
        <button
          type="button"
          disabled={busy || hasProblem}
          onClick={() => void book()}
          className="h-[54px] rounded-[14px] bg-ink text-base font-extrabold text-white disabled:opacity-50"
        >
          {busy ? 'Booking…' : `Book now · ${formatPrice(total)}`}
        </button>
      )}
      <p className="m-0 text-center text-xs text-muted">VK checks and confirms every booking. Nothing is paid now.</p>
    </Page>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-[15px] font-extrabold">{title}</legend>
      {children}
    </fieldset>
  )
}

function Choice({ name, checked, onChange, label, children }: { name: string; checked: boolean; onChange: () => void; label: string; children: ReactNode }) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] px-3.5 py-3 ${checked ? 'border-ink bg-white' : 'border-line bg-surface'}`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-1 size-4 accent-ink" />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-extrabold">{label}</span>
        <span className="whitespace-pre-line text-[13px] text-muted">{children}</span>
      </span>
    </label>
  )
}
