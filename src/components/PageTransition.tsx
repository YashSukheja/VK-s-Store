import { Outlet, useLocation } from 'react-router'

/** Each new shop page slides in. Keyed on the path, so filters like ?cat= don't replay it. */
export function PageTransition() {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className="page-enter">
      <Outlet />
    </div>
  )
}
