import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { supabase } from './supabase'

type WishlistState = {
  /** Saved product ids, newest first. */
  order: string[]
  ids: Set<string>
  /** Adds or removes a heart. Returns true when it is now saved. */
  toggle: (productId: string) => Promise<boolean>
}

const WishlistContext = createContext<WishlistState | null>(null)
const GUEST_KEY = 'vrack-wishlist'
const MAX = 100

function readGuest(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(GUEST_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}
function writeGuest(order: string[]) {
  try {
    if (order.length) localStorage.setItem(GUEST_KEY, JSON.stringify(order))
    else localStorage.removeItem(GUEST_KEY)
  } catch {
    // Private mode: hearts just last for this visit.
  }
}

/**
 * The shopper's hearts, shared by every card on the page. Logged out, they are kept on the phone;
 * logged in, in the account. Hearts saved on the phone move into the account at login.
 */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  // Hearts belong to one login (or to the phone when nobody is logged in).
  const [state, setState] = useState<{ owner: string | null; order: string[] }>(() => ({ owner: null, order: readGuest() }))
  const order = useMemo(() => (state.owner === userId ? state.order : userId ? [] : readGuest()), [state, userId])
  const ids = useMemo(() => new Set(order), [order])

  useEffect(() => {
    let live = true
    if (!userId) {
      setState({ owner: null, order: readGuest() })
      return
    }
    void (async () => {
      // Move hearts saved while logged out into the account, then load the account's list.
      const guest = readGuest()
      if (guest.length) {
        const { error } = await supabase.from('wishlist').upsert(
          guest.map((product_id) => ({ product_id })),
          { onConflict: 'customer_id,product_id', ignoreDuplicates: true },
        )
        if (!error) writeGuest([])
      }
      const { data } = await supabase.from('wishlist').select('product_id').order('created_at', { ascending: false })
      // Before setup file 8 there is no wishlist table; hearts just start empty.
      if (live) setState({ owner: userId, order: (data ?? []).map((r) => r.product_id as string) })
    })()
    return () => {
      live = false
    }
  }, [userId])

  const toggle = useCallback(
    async (productId: string) => {
      const had = ids.has(productId)
      const next = had ? order.filter((x) => x !== productId) : [productId, ...order].slice(0, MAX)
      setState({ owner: userId, order: next })
      window.dispatchEvent(new CustomEvent('vrack:wishlist', { detail: { added: !had } }))
      if (!userId) {
        writeGuest(next)
        return !had
      }
      const { error } = had
        ? await supabase.from('wishlist').delete().eq('product_id', productId)
        : await supabase.from('wishlist').insert({ product_id: productId })
      if (error) {
        setState({ owner: userId, order })
        return had
      }
      return !had
    },
    [ids, order, userId],
  )

  const value = useMemo(() => ({ order, ids, toggle }), [order, ids, toggle])
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist(): WishlistState {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist needs WishlistProvider')
  return ctx
}
