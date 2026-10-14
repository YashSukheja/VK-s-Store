import type { ReactNode } from 'react'
import { whatsappLink } from '../lib/format'
import type { StoreSettings } from '../lib/types'
import { ChatIcon, ClockIcon, InstagramIcon, PinIcon } from './Icons'

/** Store hours, address, WhatsApp and Instagram, all from Settings. */
/** roomForBar: leaves space for the product page's fixed bottom bar on phones. */
export function SiteFooter({ settings, roomForBar = false }: { settings?: StoreSettings; roomForBar?: boolean }) {
  if (!settings) return null
  const { store_hours: hours, pickup_address: address, whatsapp_number: wa, instagram } = settings
  return (
    <footer className="mt-10 border-t border-line bg-surface">
      <div className={`mx-auto flex max-w-6xl flex-col gap-4 px-5 pt-6 md:flex-row md:items-start md:justify-between md:pb-10 ${roomForBar ? 'pb-32' : 'pb-10'}`}>
        <div className="flex flex-col gap-1">
          <span className="font-display text-lg font-black">VK'S STORE</span>
          <span className="text-[13px] text-muted">Fresh picks. Local prices.</span>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm text-body">
          {hours && <Row icon={<ClockIcon size={18} />}>{hours}</Row>}
          {address && <Row icon={<PinIcon size={18} />}>{address}</Row>}
          {wa && (
            <Row icon={<ChatIcon size={18} />}>
              <a href={whatsappLink(wa, "Hi VK, I'm looking at your store.")} target="_blank" rel="noreferrer" className="font-bold underline underline-offset-4">
                WhatsApp +91 {wa}
              </a>
            </Row>
          )}
          {instagram && (
            <Row icon={<InstagramIcon size={18} />}>
              <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer" className="font-bold underline underline-offset-4">
                @{instagram}
              </a>
            </Row>
          )}
        </ul>
      </div>
    </footer>
  )
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-px flex-none text-muted">{icon}</span>
      <span className="whitespace-pre-line">{children}</span>
    </li>
  )
}
