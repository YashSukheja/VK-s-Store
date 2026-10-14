import { useState } from 'react'
import { Card } from '../../components/admin'
import { ChatIcon } from '../../components/Icons'
import { fetchOpenRequests, markTold } from '../../data/restock'
import { formatDateTime, whatsappLink } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'

/** Customers who asked to be told when a size of this product is back. */
export function WaitingCustomers({ productId, productName }: { productId: string; productName: string }) {
  const requests = useAsync(() => fetchOpenRequests(productId), [productId])
  const [told, setTold] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const open = (requests.data ?? []).filter((r) => !told.includes(r.id))
  if (open.length === 0) return null

  const link = `${window.location.origin}/p/${productId}`
  async function tell(id: string) {
    setError(null)
    try {
      await markTold(id)
      setTold((t) => [...t, id])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Card title="Waiting for stock" aside={<span className="text-xs font-bold">{open.length} waiting</span>}>
      <p className="m-0 -mt-1 text-xs font-semibold text-muted">Add stock above and save, then tap Tell to message each customer.</p>
      <ul className="m-0 flex list-none flex-col p-0">
        {open.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 border-b border-[#f0f0ec] py-2 last:border-0">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-extrabold">
                {r.customer?.username ?? 'Customer'} · size {r.size}
              </span>
              <span className="text-xs text-muted">Asked {formatDateTime(r.created_at)}</span>
            </span>
            {r.customer?.mobile && (
              <a
                href={whatsappLink(
                  r.customer.mobile,
                  `Hi ${r.customer.username}, good news from VK's Store! ${productName} in size ${r.size} is back in stock: ${link}`,
                )}
                target="_blank"
                rel="noreferrer"
                onClick={() => void tell(r.id)}
                className="flex min-h-11 flex-none items-center gap-1.5 rounded-xl bg-accent px-3 text-sm font-extrabold text-ink"
              >
                <ChatIcon size={16} />
                Tell
              </a>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="m-0 text-xs font-bold text-danger">{error}</p>}
    </Card>
  )
}
