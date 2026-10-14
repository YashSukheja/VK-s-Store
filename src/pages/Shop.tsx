import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ProductCard } from '../components/ProductCard'
import { SiteHeader } from '../components/SiteHeader'
import { Empty, ErrorBox, Loading } from '../components/States'
import { fetchCategories, fetchProducts, fetchSettings } from '../data/catalog'
import { totalStock } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { useTitle } from '../lib/useTitle'

export function Shop() {
  const [params] = useSearchParams()
  const activeSlug = params.get('cat') ?? ''

  const catalog = useAsync(() => Promise.all([fetchCategories(), fetchProducts()]), [])
  const settings = useAsync(fetchSettings, [])

  const [categories, products] = catalog.data ?? [[], []]
  const active = categories.find((c) => c.slug === activeSlug)
  useTitle(active?.name)

  const shown = useMemo(() => {
    const list = active ? products.filter((p) => p.category_id === active.id) : products
    // In-stock first, newest first within each group.
    return [...list].sort((a, b) => Number(totalStock(b) > 0) - Number(totalStock(a) > 0))
  }, [products, active])

  const links = [{ slug: '', name: 'All' }, ...categories.map((c) => ({ slug: c.slug, name: c.name }))]

  return (
    <div className="min-h-dvh bg-white">
      <SiteHeader settings={settings.data} />
      <div className="mx-auto max-w-6xl px-5 pb-16">
        <section className="mt-4 flex flex-col gap-2 rounded-2xl bg-ink px-5 py-6 text-white md:flex-row md:items-end md:justify-between md:px-8 md:py-9">
          <h1 className="m-0 font-display text-[28px] font-black leading-[1.02] md:text-5xl">
            FRESH PICKS.
            <br />
            LOCAL PRICES.
          </h1>
          <p className="m-0 max-w-xs text-sm leading-relaxed text-[#d9d9d4] md:text-base">
            Book online. Pay cash or UPI at pickup or delivery.
          </p>
        </section>

        {catalog.loading && <Loading label="Loading clothes" />}
        {catalog.error && <ErrorBox message={catalog.error} onRetry={catalog.reload} />}

        {!catalog.loading && !catalog.error && (
          <div className="mt-5 md:mt-8 md:flex md:gap-10">
            <nav aria-label="Categories" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:w-48 md:flex-none md:flex-col md:gap-1 md:overflow-visible md:px-0">
              {links.map((l) => {
                const selected = l.slug === (active?.slug ?? '')
                return (
                  <Link
                    key={l.slug || 'all'}
                    to={l.slug ? `/?cat=${l.slug}` : '/'}
                    aria-current={selected ? 'page' : undefined}
                    className={`flex h-10 flex-none items-center rounded-full border-[1.5px] px-4 text-sm md:h-11 md:rounded-xl md:border-0 md:px-3 ${
                      selected
                        ? 'border-ink bg-ink font-bold text-white'
                        : 'border-[#e1e1db] font-semibold text-ink hover:bg-surface'
                    }`}
                  >
                    {l.name}
                  </Link>
                )
              })}
            </nav>

            <section className="mt-4 min-w-0 flex-1 md:mt-0">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="m-0 font-display text-xl font-extrabold uppercase">{active ? active.name : 'New in'}</h2>
                <span className="text-[13px] text-muted">
                  {shown.length} {shown.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              {shown.length === 0 ? (
                <Empty>Nothing here right now. New stock arrives every week.</Empty>
              ) : (
                <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
                  {shown.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
