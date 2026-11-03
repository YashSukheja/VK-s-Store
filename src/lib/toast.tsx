import { useEffect, useState } from 'react'
import { Link } from 'react-router'

type Toast = { id: number; text: string; link?: { to: string; label: string } }

/** Shows a short message bar at the bottom of the screen, e.g. "Added to bag · View bag". */
export function showToast(text: string, link?: Toast['link']) {
  window.dispatchEvent(new CustomEvent<Omit<Toast, 'id'>>('vrack:toast', { detail: { text, link } }))
}

/** A light tap on phones that can vibrate (most Android phones; iPhones ignore it). */
export function buzz(ms = 25) {
  try {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(ms)
  } catch {
    // Not supported: nothing to do.
  }
}

/** The one message bar. Mounted once, next to the pages. */
export function Toaster() {
  const [toast, setToast] = useState<Toast | null>(null)
  useEffect(() => {
    let n = 0
    let timer = 0
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<Omit<Toast, 'id'>>).detail
      window.clearTimeout(timer)
      setToast({ ...detail, id: ++n })
      timer = window.setTimeout(() => setToast(null), 2600)
    }
    window.addEventListener('vrack:toast', onToast)
    return () => {
      window.removeEventListener('vrack:toast', onToast)
      window.clearTimeout(timer)
    }
  }, [])
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-8">
      {toast && (
        <div key={toast.id} role="status" className="toast-in pointer-events-auto flex min-h-12 w-full max-w-sm items-center justify-between gap-4 bg-ink px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_-12px_rgb(0_0_0/0.6)]">
          <span>{toast.text}</span>
          {toast.link && (
            <Link to={toast.link.to} onClick={() => setToast(null)} className="flex min-h-10 flex-none items-center font-extrabold underline underline-offset-4">
              {toast.link.label}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
