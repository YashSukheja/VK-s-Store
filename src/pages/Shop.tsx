import { useMemo, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CloseIcon, SearchIcon } from '../components/Icons'
import { ProductCard } from '../components/ProductCard'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { ProductGridSkeleton } from '../components/Skeletons'
import { Empty, ErrorBox } from '../components/States'
import { fetchCategories, fetchProducts, fetchSettings } from '../data/catalog'
import { fetchDrop } from '../data/drops'
import { compareSizes, discountPercent, totalStock } from '../lib/format'
import { coloursByGroup, groupKey } from '../lib/colours'
import type { Product } from '../lib/types'
import { useAsync } from '../lib/useAsync'
import { useTitle } from '../lib/useTitle'

const SORTS = [
  { key: '', label: 'Newest' },
  { key: 'price', label: 'Low price' },
  { key: 'price-desc', label: 'High price' },
  { key: 'discount', label: 'Big discount' },
] as const

type SortKey = (typeof SORTS)[number]['key']

const SORTERS: Record<SortKey, ((a: Product, b: Product) => number) | null> = {
  '': null, // The list already comes newest first.
  price: (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  discount: (a, b) => (discountPercent(b.price, b.mrp) ?? 0) - (discountPercent(a.price, a.mrp) ?? 0),
}

/** True when every word typed appears in the name, description or category. */
function matches(p: Product, words: string[], categoryName: string) {
  const text = `${p.name} ${p.colour ?? ''} ${p.description} ${categoryName}`.toLowerCase()
  return words.every((w) => text.includes(w))
}

export function Shop() {
  const [params, setParams] = useSearchParams()
  const activeSlug = params.get('cat') ?? ''
  const query = params.get('q') ?? ''
  const size = params.get('size') ?? ''
  const dropId = params.get('drop') ?? ''
  const drop = useAsync(() => (dropId ? fetchDrop(dropId) : Promise.resolve(null)), [dropId])
  const sort: SortKey = SORTS.find((s) => s.key === params.get('sort'))?.key ?? ''

  /** Changes some filters in the link, keeping the rest. */
  function setFilter(changes: Record<string, string>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true, preventScrollReset: true })
  }

  /** Category links keep the search and sort but drop the size, since sizes differ by category. */
  function categoryLink(slug: string) {
    const next = new URLSearchParams(params)
    next.delete('size')
    if (slug) next.set('cat', slug)
    else next.delete('cat')
    const qs = next.toString()
    return qs ? `/shop?${qs}` : '/shop'
  }

  const catalog = useAsync(() => Promise.all([fetchCategories(), fetchProducts()]), [], 'catalog')
  const settings = useAsync(fetchSettings, [], 'settings')

  const [categories, products] = catalog.data ?? [[], []]
  const active = categories.find((c) => c.slug === activeSlug)
  useTitle(active?.name)

  // Products in this category that match the search, before the size filter.
  const searched = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const categoryName = new Map(categories.map((c) => [c.id, c.name]))
    return products.filter(
      (p) => (!active || p.category_id === active.id) && (!dropId || p.drop_id === dropId) && matches(p, words, categoryName.get(p.category_id) ?? ''),
    )
  }, [products, categories, active, query, dropId])

  // Size chips: every size in stock among those products, plus the picked one so it can be cleared.
  const sizes = useMemo(() => {
    const set = new Set(searched.flatMap((p) => p.product_sizes.filter((s) => s.stock > 0).map((s) => s.size)))
    if (size) set.add(size)
    return [...set].sort(compareSizes)
  }, [searched, size])

  const shown = useMemo(() => {
    const list = size ? searched.filter((p) => p.product_sizes.some((s) => s.size === size && s.stock > 0)) : searched
    const by = SORTERS[sort]
    // In-stock first, then the chosen order (stable, so ties stay newest first).
    const sorted = [...list].sort((a, b) => Number(totalStock(b) > 0) - Number(totalStock(a) > 0) || (by ? by(a, b) : 0))
    // One card per item: the first matching colour stands for its group.
    const seen = new Set<string>()
    return sorted.filter((p) => !seen.has(groupKey(p)) && seen.add(groupKey(p)))
  }, [searched, size, sort])

  // Every colour of each item, for the small photos under its card.
  const colours = useMemo(() => coloursByGroup(products), [products])

  const filtering = !!(query || size || dropId)
  const title = query ? 'Results' : drop.data ? drop.data.name : active ? active.name : 'New in'

  const links = [{ slug: '', name: 'All' }, ...categories.map((c) => ({ slug: c.slug, name: c.name }))]

  return (
    <div className="min-h-dvh bg-white">
      <SiteHeader settings={settings.data} />
      <div className="mx-auto max-w-6xl px-5 pb-16">
        <section className="flex flex-col gap-3 border-b-[1.5px] border-ink pb-5 pt-8 md:flex-row md:items-end md:justify-between md:pt-12">
          <h1 className="m-0 font-display text-[52px] font-black uppercase leading-[0.85] md:text-[112px]">
            <Words key={title} text={title} />
          </h1>
          <p className="m-0 max-w-xs text-sm leading-relaxed text-body md:pb-2 md:text-right">
            {catalog.loading ? 'Book online. Pay cash or UPI on pickup.' : `${shown.length} ${shown.length === 1 ? 'piece' : 'pieces'}. Book online, pay cash or UPI on pickup.`}
          </p>
        </section>

        {catalog.loading && (
          <div className="mt-5 md:mt-8">
            <ProductGridSkeleton />
          </div>
        )}
        {catalog.error && <ErrorBox message={catalog.error} onRetry={catalog.reload} />}

        {!catalog.loading && !catalog.error && (
          <div className="mt-5 md:mt-8 md:flex md:gap-10">
            <nav aria-label="Categories" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:w-48 md:flex-none md:flex-col md:gap-1 md:overflow-visible md:px-0">
              {links.map((l) => {
                const selected = l.slug === (active?.slug ?? '')
                return (
                  <Link
                    key={l.slug || 'all'}
                    to={categoryLink(l.slug)}
                    aria-current={selected ? 'page' : undefined}
                    data-chip
                    className={`flex h-10 flex-none items-center border-[1.5px] px-4 text-sm font-bold uppercase md:h-11 md:border-0 md:px-3 ${
                      selected ? 'border-ink bg-ink text-white' : 'border-line text-ink hover:bg-surface'
                    }`}
                  >
                    {l.name}
                  </Link>
                )
              })}
            </nav>

            <section className="mt-4 min-w-0 flex-1 md:mt-0">
              <div className="mb-4 flex flex-col gap-3">
                <div className="flex gap-2">
                  <label className="relative flex min-w-0 flex-1 items-center">
                    <span className="sr-only">Search clothes</span>
                    <SearchIcon size={18} className="pointer-events-none absolute left-3.5 text-muted" />
                    <input
                      type="search"
                      enterKeyHint="search"
                      value={query}
                      onChange={(e) => setFilter({ q: e.target.value })}
                      placeholder="Search clothes"
                      className="h-11 w-full rounded-xl border-[1.5px] border-field bg-white pl-10 pr-10 text-[15px] outline-none focus:border-ink [&::-webkit-search-cancel-button]:hidden"
                    />
                    {query && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setFilter({ q: '' })}
                        className="absolute right-0 flex size-11 items-center justify-center text-muted"
                      >
                        <CloseIcon size={16} />
                      </button>
                    )}
                  </label>
                  <label className="relative flex-none">
                    <span className="sr-only">Sort by</span>
                    <select
                      value={sort}
                      onChange={(e) => setFilter({ sort: e.target.value })}
                      className="h-11 max-w-36 appearance-none rounded-xl border-[1.5px] border-field bg-white pl-3 pr-8 text-sm font-bold outline-none focus:border-ink"
                    >
                      {SORTS.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs">
                      ▾
                    </span>
                  </label>
                </div>
                {dropId && (
                  <button
                    type="button"
                    onClick={() => setFilter({ drop: '' })}
                    className="flex h-9 items-center gap-2 self-start bg-ink px-3 text-sm font-bold text-white"
                    aria-label="Show everything, not only the drop"
                  >
                    Only this drop
                    <CloseIcon size={14} />
                  </button>
                )}
                {sizes.length > 0 && (
                  <div role="group" aria-label="Filter by size" className="no-scrollbar -mx-5 flex items-center gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
                    <span className="flex-none text-[13px] font-bold text-muted">Size</span>
                    {sizes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={s === size}
                        onClick={() => setFilter({ size: s === size ? '' : s })}
                        className={`h-9 min-w-11 flex-none rounded-lg px-3 text-sm ${
                          s === size ? 'bg-ink font-extrabold text-white' : 'border-[1.5px] border-field bg-white font-bold'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {shown.length === 0 && filtering ? (
                <Empty>
                  Nothing matches{query && <> “{query}”</>}
                  {size && <> in size {size}</>}.{' '}
                  <button type="button" onClick={() => setFilter({ q: '', size: '', drop: '' })} className="font-extrabold underline underline-offset-4">
                    Clear filters
                  </button>
                </Empty>
              ) : shown.length === 0 ? (
                <Empty>Nothing here right now. New stock arrives every week.</Empty>
              ) : (
                <div className="offset-grid grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
                  {shown.map((p, i) => (
                    <ProductCard key={p.id} product={p} index={i} colours={colours.get(groupKey(p))} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
      <SiteFooter settings={settings.data} />
    </div>
  )
}

/** Splits a headline into words that slide up one after another. */
function Words({ text, from = 0 }: { text: string; from?: number }) {
  return (
    <span aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={i} aria-hidden="true" className="word" style={{ '--i': from + i } as CSSProperties}>
          {w}
          {'\u00a0'}
        </span>
      ))}
    </span>
  )
}
