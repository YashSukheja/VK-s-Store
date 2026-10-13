import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Link, Navigate, RouterProvider } from 'react-router'
import './index.css'
import { AuthProvider } from './lib/auth'
import { ProductPage } from './pages/Product'
import { Shop } from './pages/Shop'

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="m-0 font-display text-3xl font-black uppercase">Page not found</h1>
      <Link to="/" className="flex min-h-11 items-center rounded-xl bg-ink px-5 font-bold text-white">
        Go to the shop
      </Link>
    </div>
  )
}

const router = createBrowserRouter([
  { path: '/', element: <Shop /> },
  { path: '/p/:id', element: <ProductPage /> },
  // Admin pages load separately so shoppers' phones download less.
  { path: '/admin/login', lazy: async () => ({ Component: (await import('./pages/admin/AdminLogin')).AdminLogin }) },
  {
    path: '/admin',
    lazy: async () => ({ Component: (await import('./pages/admin/AdminLayout')).AdminLayout }),
    children: [
      { index: true, element: <Navigate to="/admin/products" replace /> },
      { path: 'products', lazy: async () => ({ Component: (await import('./pages/admin/AdminProducts')).AdminProducts }) },
      { path: 'products/new', lazy: async () => ({ Component: (await import('./pages/admin/AdminProductEdit')).AdminProductEdit }) },
      { path: 'products/:id', lazy: async () => ({ Component: (await import('./pages/admin/AdminProductEdit')).AdminProductEdit }) },
      { path: 'categories', lazy: async () => ({ Component: (await import('./pages/admin/AdminCategories')).AdminCategories }) },
      { path: 'settings', lazy: async () => ({ Component: (await import('./pages/admin/AdminSettings')).AdminSettings }) },
    ],
  },
  { path: '*', element: <NotFound /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
