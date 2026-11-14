import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Link, Navigate, RouterProvider, useRouteError } from 'react-router'
import './index.css'
import { PageTransition } from './components/PageTransition'
import { Loading } from './components/States'
import { AuthProvider } from './lib/auth'
import { CartProvider } from './lib/cart'
import { WishlistProvider } from './lib/wishlist'
import { Account } from './pages/Account'
import { BookingDetail } from './pages/BookingDetail'
import { Cart } from './pages/Cart'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { ProductPage } from './pages/Product'
import { Shop } from './pages/Shop'
import { Wishlist } from './pages/Wishlist'

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="m-0 font-display text-3xl font-black uppercase">Page not found</h1>
      <Link to="/shop" className="flex min-h-11 items-center rounded-xl bg-ink px-5 font-bold text-white">
        Go to the shop
      </Link>
    </div>
  )
}

/** Shown instead of a raw error if a page crashes. */
function CrashScreen() {
  const error = useRouteError()
  const message = error instanceof Error ? error.message : String(error)
  // After an update, an old page can ask for files that no longer exist. One reload fixes it.
  const stale = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(message)
  if (stale) {
    try {
      if (!sessionStorage.getItem('vrack-reloaded')) {
        sessionStorage.setItem('vrack-reloaded', '1')
        window.location.reload()
        return null
      }
    } catch {
      // Storage blocked: fall through to the screen below.
    }
  }
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="m-0 font-display text-3xl font-black uppercase">Something went wrong</h1>
      <p className="m-0 max-w-sm text-sm text-body">Sorry, this page hit a problem. Reloading usually fixes it. Your cart and wishlist are safe.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex min-h-12 items-center bg-ink px-6 font-extrabold text-white"
      >
        Reload page
      </button>
      <a href="/" className="text-sm font-extrabold underline underline-offset-4">
        Go to the home page
      </a>
    </div>
  )
}

const router = createBrowserRouter([
  {
    element: <PageTransition />,
    errorElement: <CrashScreen />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/shop', element: <Shop /> },
      { path: '/p/:id', element: <ProductPage /> },
      { path: '/cart', element: <Cart /> },
      { path: '/wishlist', element: <Wishlist /> },
      { path: '/login', element: <Login mode="login" /> },
      { path: '/register', element: <Login mode="register" /> },
      { path: '/account', element: <Account /> },
      { path: '/bookings/:code', element: <BookingDetail /> },
    ],
  },
  // Admin pages load separately so shoppers' phones download less.
  { path: '/admin/login', errorElement: <CrashScreen />, hydrateFallbackElement: <Loading />, lazy: async () => ({ Component: (await import('./pages/admin/AdminLogin')).AdminLogin }) },
  {
    path: '/admin',
    errorElement: <CrashScreen />,
    hydrateFallbackElement: <Loading />,
    lazy: async () => ({ Component: (await import('./pages/admin/AdminLayout')).AdminLayout }),
    children: [
      { index: true, element: <Navigate to="/admin/bookings" replace /> },
      { path: 'bookings', lazy: async () => ({ Component: (await import('./pages/admin/AdminBookings')).AdminBookings }) },
      { path: 'customers', lazy: async () => ({ Component: (await import('./pages/admin/AdminCustomers')).AdminCustomers }) },
      { path: 'products', lazy: async () => ({ Component: (await import('./pages/admin/AdminProducts')).AdminProducts }) },
      { path: 'products/new', lazy: async () => ({ Component: (await import('./pages/admin/AdminProductEdit')).AdminProductEdit }) },
      { path: 'products/:id', lazy: async () => ({ Component: (await import('./pages/admin/AdminProductEdit')).AdminProductEdit }) },
      { path: 'categories', lazy: async () => ({ Component: (await import('./pages/admin/AdminCategories')).AdminCategories }) },
      { path: 'drops', lazy: async () => ({ Component: (await import('./pages/admin/AdminDrops')).AdminDrops }) },
      { path: 'reviews', lazy: async () => ({ Component: (await import('./pages/admin/AdminReviews')).AdminReviews }) },
      { path: 'settings', lazy: async () => ({ Component: (await import('./pages/admin/AdminSettings')).AdminSettings }) },
    ],
  },
  { path: '*', element: <NotFound /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <RouterProvider router={router} />
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  </StrictMode>,
)

// Installable app + quick reopen. Only in the built site, so local development stays simple.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'))
}
