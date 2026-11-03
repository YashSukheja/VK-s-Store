import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type CartLine = { productId: string; size: string; quantity: number }

/** Most of one item and size a customer can book at once. */
export const MAX_QTY = 5

const STORAGE_KEY = 'vks-cart'

type CartState = {
  lines: CartLine[]
  count: number
  add: (line: CartLine) => void
  setQuantity: (productId: string, size: string, quantity: number) => void
  remove: (productId: string, size: string) => void
  /** Moves a line to another size (merging if that size is already in the cart), up to `limit` pieces. */
  changeSize: (productId: string, from: string, to: string, limit: number) => void
  clear: () => void
}

const CartContext = createContext<CartState | null>(null)

function readStored(): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (l): l is CartLine =>
        typeof l?.productId === 'string' && typeof l?.size === 'string' && Number.isInteger(l?.quantity) && l.quantity > 0,
    )
  } catch {
    return []
  }
}

/** The cart lives on the phone (browser storage) until the customer books. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(readStored)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      // Private browsing or storage full: the cart still works for this visit.
    }
  }, [lines])

  const same = (l: CartLine, productId: string, size: string) => l.productId === productId && l.size === size

  const add = useCallback((line: CartLine) => {
    setLines((prev) => {
      const existing = prev.find((l) => same(l, line.productId, line.size))
      if (!existing) return [...prev, { ...line, quantity: Math.min(line.quantity, MAX_QTY) }]
      return prev.map((l) => (l === existing ? { ...l, quantity: Math.min(l.quantity + line.quantity, MAX_QTY) } : l))
    })
  }, [])

  const setQuantity = useCallback((productId: string, size: string, quantity: number) => {
    setLines((prev) => prev.map((l) => (same(l, productId, size) ? { ...l, quantity: Math.max(1, Math.min(quantity, MAX_QTY)) } : l)))
  }, [])

  const remove = useCallback((productId: string, size: string) => {
    setLines((prev) => prev.filter((l) => !same(l, productId, size)))
  }, [])

  const changeSize = useCallback((productId: string, from: string, to: string, limit: number) => {
    setLines((prev) => {
      const old = prev.find((l) => same(l, productId, from))
      if (!old || from === to) return prev
      const there = prev.find((l) => same(l, productId, to))
      const quantity = Math.max(1, Math.min(old.quantity + (there?.quantity ?? 0), limit, MAX_QTY))
      return prev.filter((l) => l !== there).map((l) => (l === old ? { ...l, size: to, quantity } : l))
    })
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const count = lines.reduce((sum, l) => sum + l.quantity, 0)

  return <CartContext.Provider value={{ lines, count, add, setQuantity, remove, changeSize, clear }}>{children}</CartContext.Provider>
}

export function useCart(): CartState {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
