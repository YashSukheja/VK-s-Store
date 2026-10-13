import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { fieldClass } from '../../components/admin'
import { PlusIcon } from '../../components/Icons'
import { Photo } from '../../components/Photo'
import { Empty, ErrorBox, Loading } from '../../components/States'
import { fetchCategories, fetchProducts } from '../../data/catalog'
import { formatPrice, sortedImages, totalStock } from '../../lib/format'
import { imageUrl } from '../../lib/supabase'
import { useAsync } from '../../lib/useAsync'

export function AdminProducts() {
  const { data, error, loading, reload } = useAsync(() => Promise.all([fetchCategories(), fetchProducts()]), [])
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const [categories, products] = data ?? [[], []]
  const names = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const shown = products.filter(
    (p) => (!categoryId || p.category_id === categoryId) && p.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="m-0 font-display text-2xl font-black uppercase">Products</h1>
        <Link to="/admin/products/new" className="flex min-h-11 items-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-extrabold text-white">
          <PlusIcon size={18} className="text-accent" />
          Add product
        </Link>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input aria-label="Search products" placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} className={fieldClass} />
        <select aria-label="Filter by category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${fieldClass} w-auto`}>
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!loading && !error && shown.length === 0 && (
        <Empty>{products.length === 0 ? 'No products yet. Tap “Add product” to put your first item in the shop.' : 'No products match.'}</Empty>
      )}

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {shown.map((p) => {
          const cover = sortedImages(p)[0]
          const stock = totalStock(p)
          return (
            <li key={p.id}>
              <Link to={`/admin/products/${p.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                <div className="h-[72px] w-14 flex-none overflow-hidden rounded-lg bg-photo">
                  <Photo src={cover ? imageUrl(cover.path) : undefined} alt="" className="[&_span]:hidden" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-bold">{p.name}</span>
                  <span className="text-xs text-muted">{names.get(p.category_id) ?? 'No category'}</span>
                  <span className="flex flex-wrap gap-1.5 text-xs">
                    <span className={`rounded-md px-1.5 py-0.5 font-bold ${stock === 0 ? 'bg-[#ececE7] text-[#45453f]' : 'bg-surface'}`}>
                      {stock === 0 ? 'Sold out' : `${stock} in stock`}
                    </span>
                    {!p.is_visible && <span className="rounded-md bg-warn-bg px-1.5 py-0.5 font-bold text-warn-ink">Hidden</span>}
                  </span>
                </div>
                <span className="font-display text-base font-extrabold">{formatPrice(p.price)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
