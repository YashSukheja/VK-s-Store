import imageCompression from 'browser-image-compression'
import { useState, type ChangeEvent } from 'react'
import { Card, Notice } from '../../components/admin'
import { HERO_PHOTO_PATH } from '../../data/catalog'
import { IMAGE_BUCKET, imageUrl, supabase } from '../../lib/supabase'

/** The big photo at the top of the home page. */
export function HeroSettings() {
  const [version, setVersion] = useState(() => Date.now())
  const [hasPhoto, setHasPhoto] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMessage(null)
    setBusy(true)
    try {
      const small = await imageCompression(file, { maxSizeMB: 0.6, maxWidthOrHeight: 2000, useWebWorker: true, fileType: 'image/webp', initialQuality: 0.85, preserveExif: false })
      // Replace by removing then adding: an upsert needs read rights on the file list, which the shop does not give out.
      const bucket = supabase.storage.from(IMAGE_BUCKET)
      await bucket.remove([HERO_PHOTO_PATH])
      const { error } = await bucket.upload(HERO_PHOTO_PATH, small, { contentType: 'image/webp', cacheControl: '60' })
      if (error) throw error
      setHasPhoto(true)
      setVersion(Date.now())
      setMessage({ kind: 'ok', text: 'Home page photo saved. It can take a minute to show on phones.' })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Upload failed. Try again.' })
    }
    setBusy(false)
  }

  async function remove() {
    setMessage(null)
    setBusy(true)
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove([HERO_PHOTO_PATH])
    setBusy(false)
    if (error) return setMessage({ kind: 'error', text: error.message })
    setHasPhoto(false)
    setMessage({ kind: 'ok', text: 'Photo removed. The home page shows the built-in mannequin photo now.' })
  }

  return (
    <Card title="Home page">
      <p className="m-0 text-sm text-body">
        The tall photo in the middle of the home page. It looks best as a cut-out (PNG with no background) of a mannequin or model.
        Until you add one, the home page shows the built-in mannequin photo.
      </p>
      <div className="flex items-end gap-4">
        <div className="flex h-40 w-28 flex-none items-center justify-center overflow-hidden bg-surface">
          {hasPhoto ? (
            <img
              key={version}
              src={`${imageUrl(HERO_PHOTO_PATH)}?v=${version}`}
              alt="Home page photo"
              onError={() => setHasPhoto(false)}
              className="h-full w-auto object-contain"
            />
          ) : (
            <span className="p-2 pb-3 text-center text-xs text-muted">No photo yet</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label className={`flex h-12 cursor-pointer items-center justify-center bg-ink px-4 text-sm font-extrabold text-white ${busy ? 'opacity-60' : ''}`}>
            {busy ? 'Saving…' : hasPhoto ? 'Change photo' : 'Upload photo'}
            <input type="file" accept="image/*" disabled={busy} onChange={(e) => void upload(e)} className="sr-only" />
          </label>
          {hasPhoto && (
            <button type="button" disabled={busy} onClick={() => void remove()} className="h-11 border-[1.5px] border-ink text-sm font-bold disabled:opacity-60">
              Remove photo
            </button>
          )}
        </div>
      </div>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
    </Card>
  )
}
