import { useState, type CSSProperties } from 'react'
import { useWishlist } from '../lib/wishlist'
import { buzz, showToast } from '../lib/toast'
import { HeartIcon } from './Icons'

/** Saves a piece to the wishlist (on the phone, or in the account when logged in). */
export function HeartButton({ productId, name, className = '' }: { productId: string; name: string; className?: string }) {
  const { ids, toggle } = useWishlist()
  const saved = ids.has(productId)
  const [burst, setBurst] = useState(0)

  async function onClick() {
    const now = await toggle(productId)
    if (now) {
      setBurst((b) => b + 1)
      buzz(15)
      showToast('Saved to your wishlist', { to: '/wishlist', label: 'View' })
    }
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={`Save ${name} to wishlist`}
      onClick={() => void onClick()}
      className={`heart flex size-11 items-center justify-center ${saved ? 'is-saved' : ''} ${className}`}
    >
      <span className="relative flex">
        <HeartIcon size={20} filled={saved} />
        {burst > 0 && saved && (
        <span key={burst} aria-hidden="true" className="heart-burst">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <i key={i} style={{ '--a': `${i * 60}deg` } as CSSProperties} />
          ))}
          </span>
        )}
      </span>
    </button>
  )
}
