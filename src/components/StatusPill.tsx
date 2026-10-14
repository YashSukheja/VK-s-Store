import { STATUS_LABEL } from '../lib/format'
import type { BookingStatus } from '../lib/types'

const STYLE: Record<BookingStatus, string> = {
  pending: 'bg-warn-bg text-warn-ink',
  confirmed: 'bg-accent text-ink',
  completed: 'bg-ink text-white',
  rejected: 'bg-surface text-muted',
  cancelled: 'bg-surface text-muted',
}

export function StatusPill({ status }: { status: BookingStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${STYLE[status]}`}>{STATUS_LABEL[status]}</span>
}
