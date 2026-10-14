import { useState } from 'react'
import { Card, Notice } from '../../components/admin'
import { findPhotosWithoutThumbnails, makeThumbnailFor } from '../../data/admin'
import { useAsync } from '../../lib/useAsync'

/** One tap to make small shop-grid copies of photos uploaded before they existed. */
export function ThumbnailSettings() {
  const missing = useAsync(findPhotosWithoutThumbnails, [])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function run(paths: string[]) {
    setMessage(null)
    let failed = 0
    for (const [i, path] of paths.entries()) {
      setProgress({ done: i, total: paths.length })
      try {
        await makeThumbnailFor(path)
      } catch {
        failed += 1
      }
    }
    setProgress(null)
    setMessage(
      failed
        ? { kind: 'error', text: `${paths.length - failed} done, ${failed} couldn't be made. Tap again to retry.` }
        : { kind: 'ok', text: `Done. ${paths.length} small ${paths.length === 1 ? 'photo' : 'photos'} made.` },
    )
    missing.reload()
  }

  const count = missing.data?.length ?? 0

  return (
    <Card title="Small photos">
      <p className="m-0 text-sm text-body">
        The shop list uses small copies of your photos so it loads fast and saves data. New photos get one automatically.
      </p>
      {missing.loading && !progress ? (
        <p className="m-0 text-sm text-muted">Checking your photos…</p>
      ) : missing.error ? (
        <Notice kind="error">{missing.error}</Notice>
      ) : count === 0 && !progress ? (
        <p className="m-0 text-sm font-bold">All photos have a small copy. ✓</p>
      ) : (
        <button
          type="button"
          disabled={!!progress}
          onClick={() => void run(missing.data ?? [])}
          className="h-12 rounded-xl bg-ink font-extrabold text-white disabled:opacity-60"
        >
          {progress ? `Making ${progress.done + 1} of ${progress.total}…` : `Make small photos (${count})`}
        </button>
      )}
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
    </Card>
  )
}
