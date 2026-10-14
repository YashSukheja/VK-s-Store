import { useState } from 'react'
import { Link } from 'react-router'
import { cancelRequest, fetchMyRequests, requestRestock } from '../data/restock'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { CheckIcon } from './Icons'

/** "Tell me when it's back" for sold-out sizes. VK then messages the customer on WhatsApp. */
export function RestockRequest({ productId, soldOut }: { productId: string; soldOut: string[] }) {
  const { session, role } = useAuth()
  const mine = useAsync(() => (session && role === 'customer' ? fetchMyRequests(productId) : Promise.resolve([])), [productId, session?.user.id, role])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  if (soldOut.length === 0 || role === 'admin') return null

  async function toggle(size: string, waiting: boolean) {
    setBusy(size)
    setMessage(null)
    try {
      if (waiting) {
        await cancelRequest(productId, size)
        setMessage({ kind: 'ok', text: `Okay, you won't be told about size ${size}.` })
      } else {
        await requestRestock(productId, size)
        setMessage({ kind: 'ok', text: `Done. VK will message you on WhatsApp when size ${size} is back.` })
      }
      mine.reload()
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="flex flex-col gap-2.5 rounded-xl border-[1.5px] border-dashed border-field px-3.5 py-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 text-sm font-extrabold">Size sold out?</h2>
        <p className="m-0 text-[13px] text-muted">Tap your size and VK will tell you when it's back.</p>
      </div>
      {!session ? (
        <Link to={`/login?next=/p/${productId}`} className="text-sm font-extrabold underline underline-offset-4">
          Log in to get told
        </Link>
      ) : (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tell me when it's back">
          {soldOut.map((size) => {
            const waiting = mine.data?.includes(size) ?? false
            return (
              <button
                key={size}
                type="button"
                aria-pressed={waiting}
                disabled={busy !== null || mine.loading}
                onClick={() => void toggle(size, waiting)}
                className={`flex h-10 min-w-12 items-center justify-center gap-1 rounded-[10px] px-3 text-sm disabled:opacity-60 ${
                  waiting ? 'bg-ink font-extrabold text-white' : 'border-[1.5px] border-field bg-white font-bold'
                }`}
              >
                {waiting && <CheckIcon size={14} className="text-accent" />}
                {size}
              </button>
            )
          })}
        </div>
      )}
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`m-0 text-[13px] font-bold ${message.kind === 'error' ? 'text-danger' : 'text-body'}`}>
          {message.text}
        </p>
      )}
    </section>
  )
}
