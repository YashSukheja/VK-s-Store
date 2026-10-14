import { Link, Navigate } from 'react-router'
import { Page } from '../components/Page'
import { StatusPill } from '../components/StatusPill'
import { Empty, ErrorBox, Loading } from '../components/States'
import { fetchMyProfile } from '../data/account'
import { fetchMyBookings } from '../data/bookings'
import { useAuth } from '../lib/auth'
import { formatDateTime, formatPrice } from '../lib/format'
import { useAsync } from '../lib/useAsync'

export function Account() {
  const { session, role, loading, signOut } = useAuth()
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
    <Page title="My bookings">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
        <span className="flex flex-col">
          <span className="text-sm font-extrabold">{profile?.username}</span>
          {profile?.mobile && <span className="text-[13px] text-muted">+91 {profile.mobile}</span>}
        </span>
        <button type="button" onClick={() => void signOut()} className="min-h-11 text-sm font-extrabold underline underline-offset-4">
          Log out
        </button>
      </div>

      {role === 'admin' && (
        <Link to="/admin" className="text-sm font-extrabold underline underline-offset-4">
          Go to the admin
        </Link>
      )}

      {bookings.length === 0 ? (
        <Empty>
          No bookings yet.{' '}
          <Link to="/" className="font-extrabold underline underline-offset-4">
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
