import { useEffect } from 'react'
import { BOOKINGS_CHANGED, fetchSalesSince, type Sale } from '../../data/admin'
import { formatPrice } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'

type Totals = { money: number; pieces: number }

function sum(sales: Sale[]): Totals {
  return sales.reduce(
    (t, s) => ({ money: t.money + s.total, pieces: t.pieces + s.booking_items.reduce((n, i) => n + i.quantity, 0) }),
    { money: 0, pieces: 0 },
  )
}

/** Money and pieces from finished bookings: today, the last 7 days and this month, plus best sellers. */
export function SalesSummary() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(today.getTime() - 6 * 864e5)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const since = weekAgo < monthStart ? weekAgo : monthStart
  const sales = useAsync(() => fetchSalesSince(since), [since.toDateString()])
  const { reload } = sales
  // Refresh when a booking is marked collected or delivered.
  useEffect(() => {
    window.addEventListener(BOOKINGS_CHANGED, reload)
    return () => window.removeEventListener(BOOKINGS_CHANGED, reload)
  }, [reload])

  if (!sales.data) return null
  const after = (d: Date) => sales.data!.filter((s) => new Date(s.status_changed_at) >= d)
  const thisMonth = after(monthStart)
  const tiles: [string, Totals][] = [
    ['Today', sum(after(today))],
    ['Last 7 days', sum(after(weekAgo))],
    [now.toLocaleDateString('en-IN', { month: 'long' }), sum(thisMonth)],
  ]

  const counts = new Map<string, number>()
  for (const s of thisMonth) for (const i of s.booking_items) counts.set(i.product_name, (counts.get(i.product_name) ?? 0) + i.quantity)
  const best = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <section aria-label="Sales" className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {tiles.map(([label, t]) => (
          <div key={label} className="flex min-w-0 flex-col rounded-2xl bg-white px-3 py-2.5">
            <span className="truncate text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted">{label}</span>
            <span className="truncate font-display text-lg font-black">{formatPrice(t.money)}</span>
            <span className="text-xs font-semibold text-muted">
              {t.pieces} {t.pieces === 1 ? 'piece' : 'pieces'}
            </span>
          </div>
        ))}
      </div>
      {best.length > 0 && (
        <details className="rounded-2xl bg-white px-4 py-2.5 text-sm">
          <summary className="min-h-8 cursor-pointer content-center font-extrabold">Best sellers this month</summary>
          <ol className="m-0 mt-1.5 flex flex-col gap-1 pl-5">
            {best.map(([name, n]) => (
              <li key={name}>
                <span className="font-bold">{name}</span> <span className="text-muted">· {n} sold</span>
              </li>
            ))}
          </ol>
        </details>
      )}
      <p className="m-0 text-[11px] font-semibold text-muted">Counts bookings marked collected or delivered.</p>
    </section>
  )
}
