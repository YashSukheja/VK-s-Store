import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { fetchMyReminder, fetchUpcomingDrops, setReminder, type UpcomingDrop } from '../data/drops'
import { useAuth } from '../lib/auth'
import { useAsync } from '../lib/useAsync'
import { useCountdown } from '../lib/useCountdown'

/** The next drop with a live countdown, or the latest one if it just went live. */
export function DropBanner() {
  const drops = useAsync(fetchUpcomingDrops, [], 'drops')
  const list = drops.data ?? []
  const now = Date.now()
  const next = list.find((d) => new Date(d.starts_at).getTime() > now)
  const live = [...list].reverse().find((d) => new Date(d.starts_at).getTime() <= now)
  const drop = next ?? live
  if (!drop || drop.pieces === 0) return null
  return <Banner key={drop.id} drop={drop} />
}

function Banner({ drop }: { drop: UpcomingDrop }) {
  const { done, days, hours, minutes, seconds } = useCountdown(drop.starts_at)
  const when = new Date(drop.starts_at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
  const parts = [
    [days, 'Days'],
    [hours, 'Hrs'],
    [minutes, 'Min'],
    [seconds, 'Sec'],
  ] as const

  return (
    <section aria-label={`Drop: ${drop.name}`} className="border-t border-white/25 bg-ink text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-10 md:flex-row md:items-end md:justify-between md:py-14">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-[#bdbdb8]">{done ? 'Live now' : 'Next drop'}</span>
          <h2 className="m-0 font-display text-[44px] font-black uppercase leading-[0.85] [overflow-wrap:anywhere] md:text-7xl">{drop.name}</h2>
          <span className="text-sm text-[#d9d9d4]">
            {drop.pieces} {drop.pieces === 1 ? 'piece' : 'pieces'} · {done ? 'out now' : when}
          </span>
        </div>
        {done ? (
          <Link to={`/shop?drop=${drop.id}`} className="flex h-12 items-center justify-center bg-white px-6 text-[15px] font-extrabold text-ink">
            Shop the drop
          </Link>
        ) : (
          <div className="flex flex-col gap-4 md:items-end">
            <div className="flex gap-2" role="timer" aria-label={`Starts in ${days} days, ${hours} hours, ${minutes} minutes`}>
              {parts.map(([n, label]) => (
                <span key={label} aria-hidden="true" className="flex w-[4.25rem] flex-col items-center border-[1.5px] border-white/40 py-2">
                  <span className="font-display text-3xl font-black tabular-nums">{String(n).padStart(2, '0')}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#bdbdb8]">{label}</span>
                </span>
              ))}
            </div>
            <RemindMe dropId={drop.id} />
          </div>
        )}
      </div>
    </section>
  )
}

function RemindMe({ dropId }: { dropId: string }) {
  const { session, role } = useAuth()
  const navigate = useNavigate()
  const userId = session?.user.id
  const saved = useAsync(() => (userId ? fetchMyReminder(dropId) : Promise.resolve(false)), [userId, dropId])
  const [on, setOn] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (role === 'admin') return null
  const active = on ?? saved.data ?? false

  async function toggle() {
    if (!userId) return navigate(`/login?next=${encodeURIComponent('/')}`)
    setError(null)
    try {
      await setReminder(dropId, !active)
      setOn(!active)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Try again.')
    }
  }

  return (
    <div className="flex flex-col gap-1.5 md:items-end">
      <button
        type="button"
        aria-pressed={active}
        onClick={() => void toggle()}
        className={`flex h-12 items-center justify-center px-6 text-[15px] font-extrabold ${active ? 'border-[1.5px] border-white' : 'bg-white text-ink'}`}
      >
        {active ? 'We’ll remind you ✓' : 'Remind me'}
      </button>
      {active && <span className="text-xs text-[#bdbdb8]">The store will message you on WhatsApp when it drops.</span>}
      {error && (
        <span role="alert" className="text-xs font-bold">
          {error}
        </span>
      )}
    </div>
  )
}
