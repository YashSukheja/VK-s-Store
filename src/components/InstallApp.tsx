import { useEffect, useState } from 'react'

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let saved: InstallPrompt | null = null
const listeners = new Set<() => void>()
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  saved = e as InstallPrompt
  listeners.forEach((l) => l())
})

const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** "Add to home screen" help: a button on Android/Chrome, steps on iPhone. Hidden once installed. */
export function InstallApp({ label = 'Install the app' }: { label?: string }) {
  const [, rerender] = useState(0)
  useEffect(() => {
    const l = () => rerender((n) => n + 1)
    listeners.add(l)
    return () => void listeners.delete(l)
  }, [])

  if (isInstalled()) return null
  if (saved) {
    return (
      <button
        type="button"
        onClick={() => {
          const p = saved
          saved = null
          void p?.prompt()
          rerender((n) => n + 1)
        }}
        className="h-11 rounded-xl border-[1.5px] border-ink px-4 text-sm font-extrabold"
      >
        {label}
      </button>
    )
  }
  if (isIos()) {
    return <p className="m-0 text-xs text-muted">To add VK's Store to your home screen: tap Share, then “Add to Home Screen”.</p>
  }
  return null
}
