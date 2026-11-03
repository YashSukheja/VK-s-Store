import { whatsappLink } from '../../lib/format'
import type { StoreSettings } from '../../lib/types'

/** A last nudge before the footer: where the store is, with directions and WhatsApp. */
export function VisitUs({ settings }: { settings?: StoreSettings }) {
  if (!settings?.pickup_address) return null
  const { pickup_address: address, store_hours: hours, whatsapp_number: wa } = settings
  return (
    <section aria-labelledby="visit" className="mx-auto mt-16 max-w-6xl px-5 md:mt-24">
      <div className="grid gap-6 border-t-2 border-ink pt-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h2 id="visit" className="m-0 font-display text-[28px] font-black uppercase leading-none md:text-5xl">
            Come see it
            <br />
            in person
          </h2>
          <p className="m-0 mt-4 whitespace-pre-line text-base font-semibold">{address}</p>
          {hours && <p className="m-0 mt-1 text-sm text-body">{hours}</p>}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 items-center justify-center bg-ink px-6 text-sm font-extrabold text-white"
          >
            Get directions
          </a>
          {wa && (
            <a
              href={whatsappLink(wa, "Hi Vrack, I'm looking at your store.")}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 items-center justify-center border-[1.5px] border-ink px-6 text-sm font-extrabold"
            >
              WhatsApp us
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
