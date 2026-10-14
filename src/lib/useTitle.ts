import { useEffect } from 'react'

/** Sets the browser tab title, e.g. "Your cart · VK's Store". */
export function useTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · VK's Store` : "VK's Store"
  }, [title])
}
