import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { ChatIcon } from '../../components/Icons'
import { StatusPill } from '../../components/StatusPill'
import { Empty, ErrorBox, Loading } from '../../components/States'
import { fetchBookingsByStatus, fetchStockFor, setBookingStatus } from '../../data/admin'
import { fetchSettings } from '../../data/catalog'
import { customerMessage, formatDateTime, formatPrice, whatsappLink } from '../../lib/format'
import type { Booking, BookingStatus } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'

const VIEWS = [
  { key: 'waiting', label: 'Waiting', statuses: ['pending'] },
  { key: 'confirmed', label: 'Confirmed', statuses: ['confirmed'] },
  { key: 'closed', label: 'Done', statuses: ['completed', 'rejected', 'cancelled'] },
] as const satisfies readonly { key: string; label: string; statuses: readonly BookingStatus[] }[]

type ViewKey = (typeof VIEWS)[number]['key']

export function AdminBookings() {
  const [params, setParams] = useSearchParams()
  const view = VIEWS.find((v) => v.key === params.get('view')) ?? VIEWS[0]
  const data = useAsync(async () => {
    const bookings = await fetchBookingsByStatus([...view.statuses])
    // Waiting bookings need live stock and how many other waiting bookings want the same piece.
    const stock = view.key === 'waiting' ? await fetchStockFor(bookings) : new Map<string, number>()
    return { bookings, stock }
  }, [view.key])
  const settings = useAsync(fetchSettings, [])

  const demand = new Map<string, number>()
  if (view.key === 'waiting') {
    for (const b of data.data?.bookings ?? []) {
      for (const i of b.booking_items) {
        const key = `${i.product_id}|${i.size}`
        demand.set(key, (demand.get(key) ?? 0) + i.quantity)
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="m-0 font-display text-2xl font-black uppercase">Bookings</h1>
      <div role="tablist" aria-label="Booking status" className="grid grid-cols-3 gap-1 rounded-xl bg-white p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            role="tab"
            type="button"
            aria-selected={v.key === view.key}
            onClick={() => setParams(v.key === 'waiting' ? {} : { view: v.key as ViewKey })}
            className={`min-h-11 rounded-lg text-sm ${v.key === view.key ? 'bg-ink font-extrabold text-white' : 'font-semibold text-body'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {data.loading && !data.data && <Loading />}
      {data.error && <ErrorBox message={data.error} onRetry={data.reload} />}
      {data.data && data.data.bookings.length === 0 && (
        <Empty>{view.key === 'waiting' ? 'No bookings waiting. New ones show up here.' : 'Nothing here yet.'}</Empty>
      )}

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {data.data?.bookings.map((b) => (
          <BookingCard
            key={b.id}
            booking={b}
            stock={data.data!.stock}
            demand={demand}
            pickupAddress={settings.data?.pickup_address ?? null}
            onChanged={data.reload}
          />
        ))}
      </ul>
    </div>
  )
}

function BookingCard({
  booking: b,
  stock,
  demand,
  pickupAddress,
  onChanged,
}: {
  booking: Booking
  stock: Map<string, number>
  demand: Map<string, number>
  pickupAddress: string | null
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Booking | null>(null)
  const waiting = b.status === 'pending'

  const warnings = waiting
    ? b.booking_items.flatMap((i) => {
        const key = `${i.product_id}|${i.size}`
        const left = i.product_id ? stock.get(key) : undefined
        if (left === undefined) return [`${i.product_name} (${i.size}) was removed from the shop.`]
        if (left < i.quantity) return [`${i.product_name} (${i.size}): only ${left} left, this booking needs ${i.quantity}.`]
        if ((demand.get(key) ?? 0) > left) return [`${i.product_name} (${i.size}): ${left} left and other waiting bookings want it too.`]
        return []
      })
    : []
  const cannotConfirm = warnings.some((w) => !w.includes('other waiting bookings'))

  async function change(status: BookingStatus, ask?: string) {
    if (ask && !window.confirm(ask)) return
    setBusy(true)
    setError(null)
    try {
      await setBookingStatus(b.id, status)
      // Keep the card for a moment so VK can message the customer, then refresh.
      setDone({ ...b, status })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const shown = done ?? b
  const ageHours = (Date.now() - new Date(b.created_at).getTime()) / 36e5

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-display text-xl font-black">{b.code}</span>
          <span className="text-xs text-muted">{formatDateTime(b.created_at)}</span>
        </div>
        <span className="flex flex-col items-end gap-1">
          <StatusPill status={shown.status} />
          {shown.auto_cancelled && <span className="text-[11px] font-bold text-muted">Not confirmed in 48 hours</span>}
          {waiting && !done && ageHours > 36 && <span className="text-[11px] font-bold text-danger">Auto-cancels soon</span>}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2.5">
        <span className="flex flex-col">
          <span className="text-sm font-extrabold">{b.customer_username}</span>
          <a href={`tel:+91${b.customer_mobile}`} className="text-sm font-semibold underline underline-offset-4">
            +91 {b.customer_mobile}
          </a>
        </span>
        <a
          href={whatsappLink(b.customer_mobile, customerMessage(shown, pickupAddress))}
          target="_blank"
          rel="noreferrer"
          className={`flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-extrabold ${done ? 'bg-accent text-ink' : 'border-[1.5px] border-ink'}`}
        >
          <ChatIcon size={16} />
          {done ? 'Tell customer' : 'WhatsApp'}
        </a>
      </div>

      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
        {b.booking_items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3">
            <span>
              <span className="font-bold">{i.product_name}</span>
              <span className="text-muted">
                {' '}
                · {i.size} · ×{i.quantity}
              </span>
            </span>
            <span className="font-semibold">{formatPrice(i.price * i.quantity)}</span>
          </li>
        ))}
        <li className="flex justify-between border-t border-line pt-1.5">
          <span className="font-bold">Total</span>
          <span className="font-display font-black">{formatPrice(b.total)}</span>
        </li>
      </ul>

      <p className="m-0 text-sm text-body">
        <span className="font-bold">{b.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</span>
        {b.fulfilment === 'delivery' && <> to {b.delivery_address}</>} · {b.payment_method === 'upi' ? 'UPI' : 'Cash'}
        {b.note && (
          <>
            <br />
            <span className="font-bold">Note:</span> {b.note}
          </>
        )}
      </p>

      {!done &&
        warnings.map((w) => (
          <p key={w} className="m-0 rounded-lg bg-warn-bg px-3 py-2 text-xs font-bold text-warn-ink">
            {w}
          </p>
        ))}
      {error && (
        <p role="alert" className="m-0 rounded-lg bg-warn-bg px-3 py-2 text-sm font-semibold text-warn-ink">
          {error}
        </p>
      )}

      {done ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-body">Saved. Let the customer know on WhatsApp.</span>
          <button type="button" onClick={onChanged} className="min-h-11 font-extrabold underline underline-offset-4">
            OK
          </button>
        </div>
      ) : waiting ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void change('rejected', `Reject ${b.code}? This can't be undone.`)}
            className="h-12 rounded-xl border-[1.5px] border-field font-extrabold disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy || cannotConfirm}
            onClick={() => void change('confirmed')}
            className="h-12 rounded-xl bg-ink font-extrabold text-white disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      ) : b.status === 'confirmed' ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void change('cancelled', `Cancel ${b.code}? The pieces go back into stock.`)}
            className="h-12 rounded-xl border-[1.5px] border-field font-extrabold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void change('completed')}
            className="h-12 rounded-xl bg-ink font-extrabold text-white disabled:opacity-40"
          >
            {busy ? 'Saving…' : b.fulfilment === 'pickup' ? 'Mark collected' : 'Mark delivered'}
          </button>
        </div>
      ) : null}
    </li>
  )
}
