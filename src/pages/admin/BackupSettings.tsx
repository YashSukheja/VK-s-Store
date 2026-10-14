import { useState } from 'react'
import { Card, Notice } from '../../components/admin'
import { InstallApp } from '../../components/InstallApp'
import { downloadBackup } from '../../data/admin'

export function BackupSettings() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function backup() {
    setBusy(true)
    setMessage(null)
    try {
      const { rows } = await downloadBackup()
      setMessage({ kind: 'ok', text: `Backup downloaded (${rows} records). Keep it in Google Drive or email it to yourself.` })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card title="Backup">
        <p className="m-0 text-sm text-body">
          Download all products, stock, customers and bookings as one file. Do it once a week. Photos stay safe in Supabase.
        </p>
        <button type="button" disabled={busy} onClick={() => void backup()} className="h-12 rounded-xl bg-ink font-extrabold text-white disabled:opacity-50">
          {busy ? 'Preparing…' : 'Download backup'}
        </button>
        {message && <Notice kind={message.kind}>{message.text}</Notice>}
      </Card>
      <Card title="Admin app">
        <p className="m-0 text-sm text-body">Put the admin on your home screen to open bookings in one tap.</p>
        <InstallApp label="Install on this phone" />
      </Card>
    </>
  )
}
