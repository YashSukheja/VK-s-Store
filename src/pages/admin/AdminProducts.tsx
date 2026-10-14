import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { Link } from 'react-router'
import { fieldClass } from '../../components/admin'
import { PlusIcon } from '../../components/Icons'
import { Photo } from '../../components/Photo'
import { Empty, ErrorBox, Loading } from '../../components/States'
import { adjustStock } from '../../data/admin'
import { fetchOpenRequestCounts } from '../../data/restock'
import { fetchCategories, fetchProducts } from '../../data/catalog'
import { formatPrice, sortedSizes, sortedImages, totalStock } from '../../lib/format'
import type { Product, ProductSize } from '../../lib/types'
import { imageUrl, thumbUrl } from '../../lib/supabase'
import { useAsync } from '../../lib/useAsync'

export function AdminProducts() {
  const { data, error, loading, reload } = useAsync(() => Promise.all([fetchCategories(), fetchProducts(), fetchOpenRequestCounts()]), [])
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const [categories, products, waiting] = data ?? [[], [], new Map<string, number>()]
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
        {shown.map((p) => (
          <ProductRow key={p.id} product={p} categoryName={names.get(p.category_id) ?? 'No category'} waiting={waiting.get(p.id) ?? 0} />
        ))}
      </ul>
    </div>
  )
}

function ProductRow({ product: p, categoryName, waiting }: { product: Product; categoryName: string; waiting: number }) {
  // Sizes live here so the quick +/- buttons and the stock count stay in step.
  const [sizes, setSizes] = useState(() => sortedSizes(p))
  const cover = sortedImages(p)[0]
  const stock = totalStock({ product_sizes: sizes })
  return (
    <li className="flex flex-col rounded-2xl bg-white">
      <Link to={`/admin/products/${p.id}`} className="flex items-center gap-3 p-3">
        <div className="h-[72px] w-14 flex-none overflow-hidden rounded-lg bg-photo">
          <Photo src={cover ? thumbUrl(cover.path) : undefined} fallbackSrc={cover ? imageUrl(cover.path) : undefined} alt="" className="[&_span]:hidden" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-bold">{p.name}</span>
          <span className="text-xs text-muted">{categoryName}</span>
          <span className="flex flex-wrap gap-1.5 text-xs">
            <span className={`rounded-md px-1.5 py-0.5 font-bold ${stock === 0 ? 'bg-[#ececE7] text-[#45453f]' : 'bg-surface'}`}>
              {stock === 0 ? 'Sold out' : `${stock} in stock`}
            </span>
            {waiting > 0 && <span className="rounded-md bg-accent px-1.5 py-0.5 font-bold text-ink">{waiting} waiting</span>}
            {p.on_sale && <span className="rounded-md bg-danger px-1.5 py-0.5 font-bold text-white">Sale</span>}
            {!p.is_visible && <span className="rounded-md bg-warn-bg px-1.5 py-0.5 font-bold text-warn-ink">Hidden</span>}
          </span>
        </div>
        <span className="font-display text-base font-extrabold">{formatPrice(p.price)}</span>
      </Link>
      <QuickStock name={p.name} sizes={sizes} setSizes={setSizes} />
    </li>
  )
}

/** +/- buttons for each size, saved straight away, so VK doesn't need to open the edit page. */
function QuickStock({ name, sizes, setSizes }: { name: string; sizes: ProductSize[]; setSizes: Dispatch<SetStateAction<ProductSize[]>> }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (sizes.length === 0) return null

  async function change(id: string, by: number) {
    setBusy(id)
    setError(null)
    try {
      const stock = await adjustStock(id, by)
      setSizes((rows) => rows.map((r) => (r.id === id ? { ...r, stock } : r)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line px-3 py-2.5">
      <ul aria-label={`Stock for ${name}`} className="m-0 flex list-none flex-wrap gap-2 p-0">
        {sizes.map((s) => (
          <li key={s.id} className={`flex items-center rounded-[10px] border-[1.5px] ${s.stock === 0 ? 'border-dashed border-field' : 'border-field'}`}>
            <button
              type="button"
              aria-label={`One less ${s.size} of ${name}`}
              disabled={busy === s.id || s.stock === 0}
              onClick={() => void change(s.id, -1)}
              className="h-9 w-9 text-lg font-bold disabled:opacity-30"
            >
              −
            </button>
            <span className="flex min-w-12 flex-col items-center leading-none" aria-live="polite">
              <span className="text-[11px] font-bold text-muted">{s.size}</span>
              <span className="text-sm font-extrabold">{s.stock}</span>
            </span>
            <button
              type="button"
              aria-label={`One more ${s.size} of ${name}`}
              disabled={busy === s.id}
              onClick={() => void change(s.id, 1)}
              className="h-9 w-9 text-lg font-bold disabled:opacity-30"
            >
              +
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="m-0 text-xs font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
