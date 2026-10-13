import { Link } from 'react-router'

export function Logo({ admin = false, dark = false }: { admin?: boolean; dark?: boolean }) {
  return (
    <Link
      to={admin ? '/admin' : '/'}
      className={`flex items-center gap-1.5 font-display text-2xl font-black tracking-wide ${dark ? 'text-white' : 'text-ink'}`}
      aria-label={admin ? "VK's Store admin home" : "VK's Store home"}
    >
      <span>VK'S</span>
      <span className="rounded bg-accent px-1.5 text-ink">STORE</span>
      {admin && <span className="ml-1 font-sans text-xs font-bold text-[#bdbdb5]">ADMIN</span>}
    </Link>
  )
}
