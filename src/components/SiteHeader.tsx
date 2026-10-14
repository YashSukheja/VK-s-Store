import { Link } from 'react-router'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import { whatsappLink } from '../lib/format'
import type { StoreSettings } from '../lib/types'
import { BagIcon, ChatIcon, UserIcon } from './Icons'
import { Logo } from './Logo'

export function SiteHeader({ settings }: { settings?: StoreSettings }) {
  const wa = settings?.whatsapp_number
  const { session } = useAuth()
  const { count } = useCart()
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-5">
        <Logo />
        <div className="flex items-center gap-1.5">
          {wa && (
            <a
              href={whatsappLink(wa, "Hi VK, I'm looking at your store.")}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp VK"
              className="flex size-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-ink text-sm font-bold sm:w-auto sm:px-4"
            >
              <ChatIcon size={18} />
              <span className="hidden sm:inline">WhatsApp VK</span>
            </a>
          )}
          <Link
            to={session ? '/account' : '/login'}
            aria-label={session ? 'My bookings' : 'Log in'}
            className="flex size-11 items-center justify-center rounded-full hover:bg-surface"
          >
            <UserIcon size={22} />
          </Link>
          <CartButton count={count} />
        </div>
      </div>
    </header>
  )
}

export function CartButton({ count, className = '' }: { count: number; className?: string }) {
  return (
    <Link
      to="/cart"
      aria-label={count ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Cart'}
      data-cart-target
      className={`relative flex size-11 items-center justify-center rounded-full hover:bg-surface ${className}`}
    >
      <BagIcon size={22} />
      {count > 0 && (
        <span key={count} className="pop absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-black text-ink">
          {count}
        </span>
      )}
    </Link>
  )
}
