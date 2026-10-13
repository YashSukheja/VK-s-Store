import { whatsappLink } from '../lib/format'
import type { StoreSettings } from '../lib/types'
import { ChatIcon } from './Icons'
import { Logo } from './Logo'

export function SiteHeader({ settings }: { settings?: StoreSettings }) {
  const wa = settings?.whatsapp_number
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        {wa && (
          <a
            href={whatsappLink(wa, "Hi VK, I'm looking at your store.")}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-ink px-4 text-sm font-bold"
          >
            <ChatIcon size={18} />
            <span>WhatsApp VK</span>
          </a>
        )}
      </div>
    </header>
  )
}
