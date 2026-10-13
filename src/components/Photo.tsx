import { HangerIcon } from './Icons'

/** A product photo, or a calm placeholder when there is none. */
export function Photo({ src, alt, className = '' }: { src?: string; alt: string; className?: string }) {
  if (src) {
    return <img src={src} alt={alt} loading="lazy" decoding="async" className={`h-full w-full object-cover ${className}`} />
  }
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-1.5 bg-photo text-xs text-[#77776f] ${className}`}>
      <HangerIcon size={34} className="text-[#9a9a92]" />
      <span>No photo yet</span>
    </div>
  )
}
