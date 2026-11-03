import { useState } from 'react'
import { Card, Notice } from '../../components/admin'
import { addDemoProducts, removeDemoProducts, replaceWithDemoPhotos } from '../../data/admin'

/** One tap to swap every product photo for the built-in mannequin photos, for showing the shop before real photos exist. */
export function DemoPhotoSettings() {
  const [confirming, setConfirming] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function run() {
    setConfirming(false)
    setMessage(null)
    setProgress({ done: 0, total: 0 })
    try {
      const { removed, products } = await replaceWithDemoPhotos((done, total) => setProgress({ done, total }))
      setMessage({ kind: 'ok', text: `Done. ${removed} old ${removed === 1 ? 'photo' : 'photos'} removed, ${products} ${products === 1 ? 'item' : 'items'} now show the mannequin photos.` })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Something went wrong. Tap again to retry.' })
    }
    setProgress(null)
  }

  return (
    <Card title="Demo photos">
      <p className="m-0 text-sm text-body">
        Deletes every product photo and gives each item the mannequin photos instead: shirts and tops get the shirt, jeans and trousers get the
        jeans, combos and sets get the full outfit. Prices, sizes and bookings stay as they are. Deleted photos can't be brought back.
      </p>
      {progress ? (
        <p className="m-0 text-sm font-bold">{progress.total ? `Adding photos to item ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : 'Removing old photos…'}</p>
      ) : confirming ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => void run()} className="h-12 flex-1 bg-ink text-sm font-extrabold text-white">
            Yes, delete and replace
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="h-12 flex-1 border-[1.5px] border-ink text-sm font-bold">
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="h-12 bg-ink text-sm font-extrabold text-white">
          Use demo photos for every item
        </button>
      )}
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
    </Card>
  )
}

/** Adds (or later removes) a set of sample items with the mannequin photos, for showing the shop before real stock is listed. */
export function DemoProductSettings() {
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function add() {
    setMessage(null)
    setBusy('Starting…')
    try {
      const { added } = await addDemoProducts((done, total) => setBusy(total ? `Adding item ${Math.min(done + 1, total)} of ${total}…` : 'Starting…'))
      setMessage({ kind: 'ok', text: added ? `Done. ${added} demo ${added === 1 ? 'item' : 'items'} added to the shop.` : 'The demo items are already in the shop.' })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Something went wrong. Tap again to retry.' })
    }
    setBusy(null)
  }
  async function remove() {
    setConfirmRemove(false)
    setMessage(null)
    setBusy('Removing demo items…')
    try {
      const { removed } = await removeDemoProducts()
      setMessage({ kind: 'ok', text: `Done. ${removed} demo ${removed === 1 ? 'item' : 'items'} removed.` })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Something went wrong. Tap again to retry.' })
    }
    setBusy(null)
  }

  return (
    <Card title="Demo products">
      <p className="m-0 text-sm text-body">
        Adds 12 sample items with the mannequin photos: 6 jeans, 3 tees and 3 shirts, with prices and a few pieces in each size. Use it to show
        the shop before your real stock is listed, then remove them in one tap. Your own items are never touched.
      </p>
      {busy ? (
        <p className="m-0 text-sm font-bold">{busy}</p>
      ) : confirmRemove ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => void remove()} className="h-12 flex-1 bg-ink text-sm font-extrabold text-white">
            Yes, remove demo items
          </button>
          <button type="button" onClick={() => setConfirmRemove(false)} className="h-12 flex-1 border-[1.5px] border-ink text-sm font-bold">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={() => void add()} className="h-12 flex-1 bg-ink text-sm font-extrabold text-white">
            Add demo products
          </button>
          <button type="button" onClick={() => setConfirmRemove(true)} className="h-12 flex-1 border-[1.5px] border-ink text-sm font-bold">
            Remove demo products
          </button>
        </div>
      )}
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
    </Card>
  )
}
