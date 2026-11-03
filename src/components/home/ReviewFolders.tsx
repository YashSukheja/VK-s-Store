import { useState, type CSSProperties } from 'react'
import type { Review } from '../../data/reviews'
import { Stars } from '../Stars'

/**
 * Reviews as folders: each card shows the stars and name on a folder; tapping it (or hovering on desktop)
 * slides the review up out of the folder.
 */
export function ReviewFolders({ reviews, average, count }: { reviews: Review[]; average: number; count: number }) {
  const [open, setOpen] = useState<string | null>(reviews[0]?.id ?? null)
  return (
    <section aria-labelledby="reviews" className="mx-auto max-w-6xl px-5 pt-16 md:pt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="reviews" className="m-0 font-display text-[28px] font-black uppercase leading-none md:text-5xl">
          What buyers
          <br />
          say about us
        </h2>
        <p className="m-0 flex items-center gap-2 text-sm font-bold">
          <Stars value={Math.round(average)} size={16} />
          {average.toFixed(1)} from {count} {count === 1 ? 'review' : 'reviews'}
        </p>
      </div>
      <ul className="m-0 mt-8 grid list-none grid-cols-1 gap-x-4 gap-y-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((r, i) => {
          const shown = open === r.id
          return (
            <li key={r.id} className="rise-on-scroll" style={{ '--i': i } as CSSProperties}>
              <button
                type="button"
                aria-expanded={shown}
                onClick={() => setOpen(shown ? null : r.id)}
                onMouseEnter={() => setOpen(r.id)}
                className="group relative block w-full pt-20 text-left"
              >
                {/* The folder's back with its tab. */}
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 top-3 bg-ink [clip-path:polygon(0_0,38%_0,44%_14px,100%_14px,100%_100%,0_100%)]" />
                {/* The review, half tucked in the folder. */}
                <span
                  className={`absolute inset-x-3 top-4 block bg-white px-3 pb-14 pt-3 text-[13px] leading-snug shadow-md transition-transform duration-500 ease-out ${shown ? '-translate-y-2' : 'translate-y-10'}`}
                >
                  “{r.comment}”
                </span>
                {/* The folder's front. */}
                <span className="relative flex h-24 flex-col justify-between bg-[#e9e9e6] px-3 py-2.5 shadow-[0_-6px_14px_-8px_rgb(0_0_0/0.35)]">
                  <Stars value={r.rating} size={14} />
                  <span className="font-display text-base font-black">{r.customer_name} <span className="text-xs font-semibold text-muted">· Verified buyer</span></span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
