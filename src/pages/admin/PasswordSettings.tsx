import { useState, type FormEvent } from 'react'
import { Card, fieldClass, Notice, PrimaryButton } from '../../components/admin'
import { supabase } from '../../lib/supabase'

/** Lets the admin pick a new login password. The authenticator code stays the same. */
export function PasswordSettings() {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (password.length < 10) return setMessage({ kind: 'error', text: 'Use at least 10 characters.' })
    if (password !== repeat) return setMessage({ kind: 'error', text: 'The two passwords don’t match.' })
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      const same = /different from the old/i.test(error.message)
      return setMessage({ kind: 'error', text: same ? 'That’s already your password. Pick a new one.' : error.message })
    }
    setPassword('')
    setRepeat('')
    setMessage({ kind: 'ok', text: 'Password changed. Use the new one next time you log in.' })
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <Card title="Admin password">
        <label className="flex flex-col gap-1.5 text-sm font-extrabold">
          New password
          <input type="password" autoComplete="new-password" className={fieldClass} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-extrabold">
          Type it again
          <input type="password" autoComplete="new-password" className={fieldClass} value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </label>
        <span className="text-xs font-semibold text-muted">Your authenticator app code doesn’t change.</span>
      </Card>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <PrimaryButton type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Change password'}
      </PrimaryButton>
    </form>
  )
}
