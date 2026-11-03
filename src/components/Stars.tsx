/** Read-only stars, e.g. 4 of 5 filled. */
export function Stars({ value, size = 16, light = false }: { value: number; size?: number; light?: boolean }) {
  const rounded = Math.round(value)
  return (
    <span role="img" aria-label={`${Number(value.toFixed(1))} out of 5 stars`} className="inline-flex gap-px leading-none" style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true" className={n <= rounded ? (light ? 'text-white' : 'text-ink') : light ? 'text-[#5a5a55]' : 'text-field'}>
          ★
        </span>
      ))}
    </span>
  )
}
