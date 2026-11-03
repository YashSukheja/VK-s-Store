import { Link } from 'react-router'

/**
 * The Vrack mark: a heavy V with a hanger across it. `halo` is the colour
 * behind the mark; it cuts a thin gap around the hanger so it reads at small sizes.
 */
export function VrackMark({ size = 28, halo = '#ffffff', className = '' }: { size?: number; halo?: string; className?: string }) {
  const hanger = 'M50 36 V27 A7 7 0 1 0 43 20 M50 36 L12 60 L88 60 Z'
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <path d="M14 20 L34 20 L50 76 L66 20 L86 20 L56 98 L44 98 Z" fill="currentColor" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={hanger} stroke={halo} strokeWidth={10} />
        <path d={hanger} stroke="currentColor" strokeWidth={4.5} />
      </g>
    </svg>
  )
}

export function Logo({ admin = false, dark = false }: { admin?: boolean; dark?: boolean }) {
  return (
    <Link
      to={admin ? '/admin' : '/'}
      className={`flex items-center gap-1.5 ${dark ? 'text-white' : 'text-ink'}`}
      aria-label={admin ? 'Vrack admin home' : 'Vrack Clothing home'}
    >
      <VrackMark size={38} halo={dark ? '#000000' : '#ffffff'} />
      <span className="font-brand text-[18px] font-semibold tracking-[0.14em]">VRACK</span>
      {admin && <span className="ml-1 text-xs font-bold text-[#bdbdb5]">ADMIN</span>}
    </Link>
  )
}
