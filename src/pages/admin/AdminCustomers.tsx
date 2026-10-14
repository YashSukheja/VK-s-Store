import { useState, type FormEvent } from 'react'
import { fieldClass } from '../../components/admin'
import { ChatIcon } from '../../components/Icons'
import { Empty, ErrorBox, Loading } from '../../components/States'
import { fetchCustomers, resetCustomerPassword } from '../../data/admin'
import { formatDateTime, whatsappLink } from '../../lib/format'
import type { Customer } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'

export function AdminCustomers() {
  const { data, error, loading, reload } = useAsync(fetchCustomers, [])
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = (data ?? []).filter((c) => !q || c.username.includes(q) || (c.mobile ?? '').includes(q))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="m-0 font-display text-2xl font-black uppercase">Customers</h1>
        {data && <span className="text-sm text-muted">{data.length} total</span>}
      </div>
      <input aria-label="Search customers" placeholder="Search by username or mobile" value={query} onChange={(e) => setQuery(e.target.value)} className={fieldClass} />
      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && shown.length === 0 && <Empty>{data.length === 0 ? 'No customers yet.' : 'No customers match.'}</Empty>}
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {shown.map((c) => (
          <CustomerRow key={c.id} customer={c} />
        ))}
      </ul>
    </div>
  )
}

function CustomerRow({ customer: c }: { customer: Customer }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const count = c.bookings[0]?.count ?? 0

  async function reset(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (password.length < 8) return setMessage({ kind: 'error', text: 'Use at least 8 characters.' })
    setBusy(true)
    try {
      await resetCustomerPassword(c.id, password)
      setMessage({ kind: 'ok', text: `Done. Send ${c.username} the new password.` })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  const resetText = `Hi ${c.username}, your new VK's Store password is: ${password}\nLog in with your username or mobile number.`

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-extrabold">{c.username}</span>
          {c.mobile && (
            <a href={`tel:+91${c.mobile}`} className="text-sm font-semibold underline underline-offset-4">
              +91 {c.mobile}
            </a>
          )}
          <span className="text-xs text-muted">
            Joined {formatDateTime(c.created_at)} · {count} {count === 1 ? 'booking' : 'bookings'}
          </span>
        </span>
        {c.mobile && (
          <a
            href={whatsappLink(c.mobile, `Hi ${c.username}, this is VK's Store.`)}
            target="_blank"
            rel="noreferrer"
            aria-label={`WhatsApp ${c.username}`}
            className="flex size-11 flex-none items-center justify-center rounded-full border-[1.5px] border-ink"
          >
            <ChatIcon size={18} />
          </a>
        )}
      </div>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="self-start text-sm font-bold underline underline-offset-4">
          Set a new password
        </button>
      ) : (
        <form onSubmit={reset} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5 text-sm font-extrabold">
            New password for {c.username}
            <input className={fieldClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" minLength={8} required />
          </label>
          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className={`m-0 text-sm font-semibold ${message.kind === 'error' ? 'text-danger' : 'text-ink'}`}>
              {message.text}
            </p>
          )}
          <div className="flex gap-2">
            <button disabled={busy} className="h-11 flex-1 rounded-xl bg-ink text-sm font-extrabold text-white disabled:opacity-50">
              {busy ? 'Saving…' : 'Save password'}
            </button>
            {message?.kind === 'ok' && c.mobile && (
              <a
                href={whatsappLink(c.mobile, resetText)}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-extrabold text-ink"
              >
                <ChatIcon size={16} />
                Send on WhatsApp
              </a>
            )}
          </div>
        </form>
      )}
    </li>
  )
}
