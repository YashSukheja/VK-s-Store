import { HangerIcon } from './Icons'

/** Marks a photo as loaded (also when it came from the cache before React saw it). */
function markLoaded(img: HTMLImageElement | null) {
  if (img?.complete && img.naturalWidth > 0) img.classList.add('loaded')
}

/**
 * A product photo that fades in over a shimmer, or a calm placeholder when there is none.
 * fallbackSrc is tried if src fails (e.g. a small copy that hasn't been made yet).
 */
export function Photo({ src, fallbackSrc, alt, className = '' }: { src?: string; fallbackSrc?: string; alt: string; className?: string }) {
  if (src) {
    return (
      <div className="shimmer h-full w-full">
        <img
          ref={markLoaded}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={(e) => e.currentTarget.classList.add('loaded')}
          onError={(e) => {
            const img = e.currentTarget
            if (fallbackSrc && !img.src.endsWith(fallbackSrc)) img.src = fallbackSrc
            else img.classList.add('loaded')
          }}
          className={`photo-fade h-full w-full object-cover ${className}`}
        />
      </div>
    )
  }
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-1.5 bg-photo text-xs text-[#77776f] ${className}`}>
      <HangerIcon size={34} className="text-[#9a9a92]" />
      <span>No photo yet</span>
    </div>
  )
}
