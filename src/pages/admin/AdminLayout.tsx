import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet } from 'react-router'
import { Logo } from '../../components/Logo'
import { Loading } from '../../components/States'
import { BOOKINGS_CHANGED, fetchPendingCount } from '../../data/admin'
import { useAuth } from '../../lib/auth'

const tabs = [
  { to: '/admin/bookings', label: 'Bookings' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/customers', label: 'Customers' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/settings', label: 'Settings' },
]

/** Admin pages need the admin role and the authenticator step. The database checks this too. */
export function AdminLayout() {
  const { session, role, aal, loading, signOut } = useAuth()
  const waiting = usePendingCount(!loading && role === 'admin' && aal === 'aal2')

  if (loading) return <Loading />
  if (!session || role !== 'admin' || aal !== 'aal2') return <Navigate to="/admin/login" replace />

  return (
    <div className="min-h-dvh bg-surface">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 pt-4">
          <Logo admin dark />
          <button type="button" onClick={() => void signOut()} className="min-h-11 rounded-full px-3 text-sm font-bold text-[#d9d9d4] hover:text-white">
            Log out
          </button>
        </div>
        <nav aria-label="Admin" className="no-scrollbar mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3 pb-2 pt-3">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `flex min-h-11 flex-none items-center rounded-xl px-4 text-sm ${isActive ? 'bg-white font-extrabold text-ink' : 'font-semibold text-[#d9d9d4] hover:text-white'}`
              }
            >
              {t.label}
              {t.to === '/admin/bookings' && waiting > 0 && (
                <span aria-label={`${waiting} waiting`} className="ml-1.5 rounded-full bg-accent px-1.5 text-xs font-black text-ink">
                  {waiting}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-5">
        <Outlet />
      </main>
    </div>
  )
}

/** Waiting bookings, refreshed every minute, when the tab comes back into view, and after changes. */
function usePendingCount(enabled: boolean): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    const load = () =>
      fetchPendingCount()
        .then((n) => alive && setCount(n))
        .catch(() => {})
    void load()
    const timer = window.setInterval(load, 60_000)
    const onVisible = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(BOOKINGS_CHANGED, load)
    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(BOOKINGS_CHANGED, load)
    }
  }, [enabled])
  useEffect(() => {
    document.title = count > 0 ? `(${count}) VK's Store admin` : "VK's Store admin"
  }, [count])
  return count
}
