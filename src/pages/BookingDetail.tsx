import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { CheckIcon, ChatIcon } from '../components/Icons'
import { Page } from '../components/Page'
import { StatusPill } from '../components/StatusPill'
import { ErrorBox, Loading } from '../components/States'
import { fetchBooking } from '../data/bookings'
import { fetchSettings } from '../data/catalog'
import { useAuth } from '../lib/auth'
import { bookingMessage, formatDateTime, formatPrice, whatsappLink } from '../lib/format'
import { useAsync } from '../lib/useAsync'

export function BookingDetail() {
  const { code = '' } = useParams()
  const [params] = useSearchParams()
  const isNew = params.get('new') === '1'
  const { session, loading: authLoading } = useAuth()
  const booking = useAsync(() => fetchBooking(code), [code, session?.user.id])
  const settings = useAsync(fetchSettings, [])

  if (!authLoading && !session) return <Navigate to={`/login?next=${encodeURIComponent(`/bookings/${code}`)}`} replace />
  if (authLoading || booking.loading) {
    return (
      <Page title="Booking">
        <Loading />
      </Page>
    )
  }
  if (booking.error) {
    return (
      <Page title="Booking">
        <ErrorBox message={booking.error} onRetry={booking.reload} />
      </Page>
    )
  }
  const b = booking.data
  if (!b) {
    return (
      <Page title="Booking">
        <p className="m-0 text-sm text-body">We couldn't find this booking on your account.</p>
        <Link to="/account" className="font-extrabold underline underline-offset-4">
          See my bookings
        </Link>
      </Page>
    )
  }

  const wa = settings.data?.whatsapp_number
  const waButton = wa && (
    <a
      href={whatsappLink(wa, bookingMessage(b))}
      target="_blank"
      rel="noreferrer"
      className="flex h-[54px] items-center justify-center gap-2 rounded-[14px] bg-ink text-base font-extrabold text-white"
    >
      <ChatIcon size={20} className="text-accent" />
      Send to VK on WhatsApp
    </a>
  )

  return (
    <Page title={isNew ? 'Booked!' : `Booking ${b.code}`}>
      {isNew && (
        <div className="flex flex-col gap-3 rounded-2xl bg-ink p-5 text-white">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent text-ink">
            <CheckIcon size={22} />
          </span>
          <p className="m-0 font-display text-2xl font-black">{b.code}</p>
          <p className="m-0 text-sm leading-relaxed text-[#d9d9d4]">
            Your booking is saved. Tap below to send the details to VK on WhatsApp so he sees it straight away. He'll confirm it
            soon.
          </p>
        </div>
      )}
      {isNew && waButton}

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{formatDateTime(b.created_at)}</span>
        <StatusPill status={b.status} />
      </div>
      {b.auto_cancelled && (
        <p className="m-0 rounded-xl bg-surface px-3.5 py-3 text-sm text-body">
          This booking was cancelled because it wasn't confirmed within 48 hours. Message VK if you still want these clothes.
        </p>
      )}

      <ul className="m-0 flex list-none flex-col gap-2 rounded-2xl bg-surface p-4">
        {b.booking_items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3 text-sm">
            <span>
              {i.product_id ? (
                <Link to={`/p/${i.product_id}`} className="font-bold">
                  {i.product_name}
                </Link>
              ) : (
                <span className="font-bold">{i.product_name}</span>
              )}
              <span className="block text-[13px] text-muted">
                Size {i.size} · Qty {i.quantity}
              </span>
            </span>
            <span className="font-bold">{formatPrice(i.price * i.quantity)}</span>
          </li>
        ))}
        <li className="flex justify-between border-t border-line pt-2 text-sm">
          <span className="font-bold">Total</span>
          <span className="font-display text-lg font-black">{formatPrice(b.total)}</span>
        </li>
      </ul>

      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="font-bold">{b.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</dt>
        <dd className="m-0 whitespace-pre-line text-body">
          {b.fulfilment === 'pickup' ? (settings.data?.pickup_address ?? 'From the shop') : b.delivery_address}
        </dd>
        <dt className="font-bold">Payment</dt>
        <dd className="m-0 text-body">
          {b.payment_method === 'upi' ? `UPI${settings.data?.upi_id ? ` to ${settings.data.upi_id}` : ''}` : 'Cash'}, when you get your clothes
        </dd>
        {b.note && (
          <>
            <dt className="font-bold">Note</dt>
            <dd className="m-0 text-body">{b.note}</dd>
          </>
        )}
      </dl>

      {!isNew && waButton}
      <Link to="/account" className="text-center text-sm font-extrabold underline underline-offset-4">
        All my bookings
      </Link>
    </Page>
  )
}
