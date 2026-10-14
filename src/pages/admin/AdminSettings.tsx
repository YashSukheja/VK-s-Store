import { useState, type FormEvent } from 'react'
import { Card, fieldClass, Notice, PrimaryButton } from '../../components/admin'
import { ErrorBox, Loading } from '../../components/States'
import { fetchSettings } from '../../data/catalog'
import { supabase } from '../../lib/supabase'
import type { StoreSettings } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'
import { AlertSettings } from './AlertSettings'
import { BackupSettings } from './BackupSettings'
import { PasswordSettings } from './PasswordSettings'
import { ThumbnailSettings } from './ThumbnailSettings'

export function AdminSettings() {
  const { data, error, loading, reload } = useAsync(fetchSettings, [])
  if (loading) return <Loading />
  if (error || !data) return <ErrorBox message={error ?? 'Settings not found.'} onRetry={reload} />
  return (
    <div className="flex flex-col gap-6">
      <SettingsForm initial={data} />
      <AlertSettings />
      <ThumbnailSettings />
      <BackupSettings />
      <PasswordSettings />
    </div>
  )
}

function SettingsForm({ initial }: { initial: StoreSettings }) {
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp_number ?? '')
  const [upi, setUpi] = useState(initial.upi_id ?? '')
  const [pickup, setPickup] = useState(initial.pickup_address ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (whatsapp && !/^[6-9]\d{9}$/.test(whatsapp)) return setMessage({ kind: 'error', text: 'WhatsApp number must be 10 digits, without +91.' })
    const upiId = upi.trim()
    if (upiId && (upiId.length > 100 || !/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(upiId))) return setMessage({ kind: 'error', text: 'UPI ID looks wrong. It should look like name@bank.' })
    setSaving(true)
    const { error } = await supabase
      .from('store_settings')
      .update({ whatsapp_number: whatsapp || null, upi_id: upiId || null, pickup_address: pickup.trim() || null })
      .eq('id', 1)
    setSaving(false)
    setMessage(error ? { kind: 'error', text: error.message } : { kind: 'ok', text: 'Settings saved.' })
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <h1 className="m-0 font-display text-2xl font-black uppercase">Settings</h1>
      <Card>
        <label className="flex flex-col gap-1.5 text-sm font-extrabold">
          WhatsApp number for bookings
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-muted">+91</span>
            <input className={fieldClass} inputMode="numeric" maxLength={10} placeholder="10-digit number" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))} />
          </div>
          <span className="text-xs font-semibold text-muted">Shown to customers so they can message you.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-extrabold">
          UPI ID
          <input className={fieldClass} placeholder="name@bank" value={upi} onChange={(e) => setUpi(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-extrabold">
          Pickup address
          <textarea rows={3} maxLength={300} placeholder="Where customers collect their clothes" value={pickup} onChange={(e) => setPickup(e.target.value)} className={`${fieldClass} h-auto py-2.5`} />
        </label>
      </Card>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <PrimaryButton type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save settings'}
      </PrimaryButton>
    </form>
  )
}
