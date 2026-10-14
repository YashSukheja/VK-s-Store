import { useState } from 'react'
import { Card, Notice } from '../../components/admin'
import { ErrorBox, Loading } from '../../components/States'
import { fetchAlertTopic, saveAlertTopic, sendTestAlert } from '../../data/admin'
import { useAsync } from '../../lib/useAsync'

/** A long random channel name nobody can guess. */
function newTopic(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(15))
  return `vks-${Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('')}`
}

/** Phone alerts through the free ntfy app: the database pings the channel on every new booking. */
export function AlertSettings() {
  const { data: topic, error, loading, reload } = useAsync(fetchAlertTopic, [])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function run(action: () => Promise<void>, ok: string) {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      setMessage({ kind: 'ok', text: ok })
      reload()
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  if (loading && topic === undefined) return <Loading />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  return (
    <Card title="Phone alerts">
      {!topic ? (
        <>
          <p className="m-0 text-sm text-body">Get a notification on your phone for every new booking, even when the site is closed. Free, using the ntfy app.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => saveAlertTopic(newTopic()), 'Alerts are on. Now follow the steps below on your phone.')}
            className="h-12 rounded-xl bg-ink font-extrabold text-white disabled:opacity-50"
          >
            Turn on phone alerts
          </button>
        </>
      ) : (
        <>
          <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed text-body">
            <li>Install the free <strong>ntfy</strong> app from the Play Store or App Store.</li>
            <li>Open it, tap <strong>+</strong> (Subscribe to topic) and paste this name:</li>
          </ol>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-surface px-3 py-2.5 font-mono text-sm font-bold" aria-label="Alert channel name">
              {topic}
            </code>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(topic).then(() => setMessage({ kind: 'ok', text: 'Copied.' }))}
              className="h-11 flex-none rounded-xl border-[1.5px] border-ink px-3 text-sm font-extrabold"
            >
              Copy
            </button>
          </div>
          <p className="m-0 text-xs text-muted">Keep this name private: anyone with it could see booking alerts (only the booking code and total, no customer details).</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(sendTestAlert, 'Test sent. It should arrive on your phone in a few seconds.')}
              className="h-11 rounded-xl bg-ink text-sm font-extrabold text-white disabled:opacity-50"
            >
              Send test alert
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => saveAlertTopic(null), 'Phone alerts are off.')}
              className="h-11 rounded-xl border-[1.5px] border-field text-sm font-extrabold disabled:opacity-50"
            >
              Turn off
            </button>
          </div>
        </>
      )}
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
    </Card>
  )
}
