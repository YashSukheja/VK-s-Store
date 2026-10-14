/** Grey placeholders shaped like the real content, shown while it loads. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading clothes" className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="shimmer aspect-[3/4] rounded-xl" />
          <div className="shimmer h-3.5 w-4/5 rounded" />
          <div className="shimmer h-4 w-1/3 rounded" />
        </div>
      ))}
    </div>
  )
}

export function ProductPageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="grid gap-6 md:grid-cols-2 md:gap-10 md:pt-6">
      <div className="shimmer -mx-5 aspect-[4/5] md:mx-0 md:rounded-2xl" />
      <div className="flex flex-col gap-3">
        <div className="shimmer h-3 w-20 rounded" />
        <div className="shimmer h-8 w-4/5 rounded" />
        <div className="shimmer h-7 w-1/3 rounded" />
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="shimmer size-12 rounded-[10px]" />
          ))}
        </div>
      </div>
    </div>
  )
}
