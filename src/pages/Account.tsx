import { SavedGrid } from '../components/SavedGrid'
import { Link, Navigate, useSearchParams } from 'react-router'
import { Stars } from '../components/Stars'
import { fetchMyReviews } from '../data/reviews'
import { InstallApp } from '../components/InstallApp'
import { Page } from '../components/Page'
import { StatusPill } from '../components/StatusPill'
import { Empty, ErrorBox, Loading } from '../components/States'
import { fetchMyProfile } from '../data/account'
import { fetchMyBookings } from '../data/bookings'
import { useAuth } from '../lib/auth'
import { formatDateTime, formatPrice } from '../lib/format'
import { useAsync } from '../lib/useAsync'

const TABS = [
  { key: '', label: 'My bookings' },
  { key: 'wishlist', label: 'Wishlist' },
  { key: 'reviews', label: 'My reviews' },
] as const

export function Account() {
  const { session, role, loading, signOut } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.key === params.get('tab')) ?? TABS[0]
  const data = useAsync(() => Promise.all([fetchMyProfile(), fetchMyBookings()]), [session?.user.id])

  if (!loading && !session) return <Navigate to="/login" replace />
  if (loading || data.loading) {
    return (
      <Page title="My bookings">
        <Loading />
      </Page>
    )
  }
  if (data.error) {
    return (
      <Page title="My bookings">
        <ErrorBox message={data.error} onRetry={data.reload} />
      </Page>
    )
  }
  const [profile, bookings] = data.data ?? [null, []]

  return (
    <Page title={tab.label}>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
        <span className="flex flex-col">
          <span className="text-sm font-extrabold">{profile?.username}</span>
          {profile?.mobile && <span className="text-[13px] text-muted">+91 {profile.mobile}</span>}
        </span>
        <button type="button" onClick={() => void signOut()} className="min-h-11 text-sm font-extrabold underline underline-offset-4">
          Log out
        </button>
      </div>

      <InstallApp label="Add Vrack to your home screen" />

      {role === 'admin' && (
        <Link to="/admin" className="text-sm font-extrabold underline underline-offset-4">
          Go to the admin
        </Link>
      )}

      <nav aria-label="My account" className="flex border-b-[1.5px] border-ink">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-current={t.key === tab.key ? 'page' : undefined}
            onClick={() => setParams(t.key ? { tab: t.key } : {}, { replace: true })}
            className={`min-h-11 flex-1 px-2 text-sm font-bold ${t.key === tab.key ? 'bg-ink text-white' : 'text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab.key === 'wishlist' ? (
        <SavedGrid />
      ) : tab.key === 'reviews' ? (
        <MyReviews userId={session!.user.id} />
      ) : bookings.length === 0 ? (
        <Empty>
          No bookings yet.{' '}
          <Link to="/shop" className="font-extrabold underline underline-offset-4">
            Browse the shop
          </Link>
        </Empty>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {bookings.map((b) => {
            const pieces = b.booking_items.reduce((n, i) => n + i.quantity, 0)
            return (
              <li key={b.id}>
                <Link to={`/bookings/${b.code}`} className="flex flex-col gap-1.5 rounded-2xl border-[1.5px] border-line p-4 hover:border-ink">
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-display text-lg font-black">{b.code}</span>
                    <StatusPill status={b.status} />
                  </span>
                  <span className="truncate text-sm text-body">{b.booking_items.map((i) => i.product_name).join(', ')}</span>
                  <span className="flex justify-between text-[13px] text-muted">
                    <span>
                      {formatDateTime(b.created_at)} · {pieces} {pieces === 1 ? 'piece' : 'pieces'}
                    </span>
                    <span className="font-bold text-ink">{formatPrice(b.total)}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Page>
  )
}

function MyReviews({ userId }: { userId: string }) {
  const list = useAsync(() => fetchMyReviews(userId), [userId])
  if (list.loading) return <Loading />
  if (list.error) return <ErrorBox message={list.error} onRetry={list.reload} />
  const items = list.data ?? []
  if (items.length === 0) {
    return <Empty>No reviews yet. Once a booking is Completed, you can review its pieces from the booking or the product page.</Empty>
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {items.map((r) => (
        <li key={r.id} className="flex flex-col gap-1.5 border-[1.5px] border-line p-4">
          <span className="flex items-center justify-between gap-3">
            {r.products ? (
              <Link to={`/p/${r.products.id}#reviews`} className="text-sm font-extrabold underline underline-offset-4">
                {r.products.name}
              </Link>
            ) : (
              <span className="text-sm font-extrabold">Piece no longer in the shop</span>
            )}
            <Stars value={r.rating} size={14} />
          </span>
          {r.comment && <p className="m-0 text-sm text-body">{r.comment}</p>}
          {r.is_hidden && <span className="text-xs text-muted">Hidden from the shop by the store.</span>}
          {r.reply && (
            <p className="m-0 border-l-[3px] border-ink bg-surface px-3 py-2 text-sm">
              <span className="block text-xs font-extrabold uppercase">Vrack replied</span>
              {r.reply}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
