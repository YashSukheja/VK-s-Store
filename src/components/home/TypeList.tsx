import { Link } from 'react-router'
import type { Category } from '../../lib/types'

/** The clothing types as a row of big names; each opens the shop on that type. */
export function TypeList({ categories }: { categories: Category[] }) {
  return (
    <nav aria-label="Clothing types" className="border-b border-line">
      <ul className="no-scrollbar mx-auto flex max-w-6xl list-none gap-2 overflow-x-auto px-5 py-4 md:flex-wrap md:justify-center md:gap-3 md:py-6">
        {categories.map((c) => (
          <li key={c.id} className="flex-none">
            <Link
              to={`/shop?cat=${c.slug}`}
              className="flex h-11 items-center border-[1.5px] border-ink px-4 font-display text-sm font-black uppercase transition-colors hover:bg-ink hover:text-white md:h-12 md:px-6 md:text-base"
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
