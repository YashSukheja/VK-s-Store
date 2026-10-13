import type { ReactNode } from 'react'

export const fieldClass =
  'h-11 w-full min-w-0 rounded-[10px] border-[1.5px] border-field bg-white px-3 text-[15px] outline-none focus:border-ink'

export function Card({ title, children, aside }: { title?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-4">
      {(title || aside) && (
        <div className="flex items-baseline justify-between gap-3">
          {title && <h2 className="m-0 text-xs font-extrabold uppercase tracking-[0.08em] text-muted">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center rounded-[10px] border-[1.5px] border-field bg-white">
      <button type="button" aria-label={`Remove one ${label}`} onClick={() => onChange(Math.max(0, value - 1))} className="h-10 w-11 text-lg font-bold">
        −
      </button>
      <input
        aria-label={`Stock for ${label}`}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0))}
        className="w-10 bg-transparent text-center font-extrabold outline-none"
      />
      <button type="button" aria-label={`Add one ${label}`} onClick={() => onChange(value + 1)} className="h-10 w-11 text-lg font-bold">
        +
      </button>
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-bold">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-7 w-12 flex-none rounded-full bg-field transition-colors peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  )
}

export function PrimaryButton({ children, disabled, type = 'button', onClick }: { children: ReactNode; disabled?: boolean; type?: 'button' | 'submit'; onClick?: () => void }) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className="h-[52px] rounded-[14px] bg-ink px-5 text-base font-extrabold text-white disabled:opacity-60">
      {children}
    </button>
  )
}

export function Notice({ kind, children }: { kind: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className={`m-0 rounded-xl px-3.5 py-3 text-sm font-semibold ${kind === 'error' ? 'bg-warn-bg text-warn-ink' : 'bg-ink text-white'}`}
    >
      {children}
    </p>
  )
}
