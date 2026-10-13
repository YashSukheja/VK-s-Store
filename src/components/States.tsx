import type { ReactNode } from 'react'

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-muted">
      <span className="size-5 animate-spin rounded-full border-2 border-field border-t-ink" aria-hidden="true" />
      {label}…
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto my-8 flex max-w-md flex-col items-start gap-3 rounded-2xl border-[1.5px] border-warn-line bg-warn-bg p-4 text-sm text-warn-ink">
      <p className="m-0 font-bold">Something went wrong</p>
      <p className="m-0">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="min-h-11 rounded-xl bg-ink px-4 font-bold text-white">
          Try again
        </button>
      )}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-surface px-5 py-10 text-center text-sm text-body">{children}</div>
}
