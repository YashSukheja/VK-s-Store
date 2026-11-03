import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { Toaster } from '../lib/toast'

/**
 * Each new shop page fades in. Keyed on the path, so filters like ?cat= don't replay it.
 * New pages open at the top; Back returns to where you were.
 */
export function PageTransition() {
  const { pathname } = useLocation()
  return (
    <>
      <div key={pathname} className="page-enter">
        <Outlet />
      </div>
      <ScrollRestoration />
      <Toaster />
    </>
  )
}
