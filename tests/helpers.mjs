// Shared helpers for tests that run against the local Supabase stack (npx supabase start).
import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
// Local-only demo keys printed by `supabase start`; never real secrets.
export const ANON =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
export const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

export const client = () => createClient(URL, ANON, { auth: { persistSession: false } })
export const service = () => createClient(URL, SERVICE, { auth: { persistSession: false } })

/** RFC 6238 TOTP code for a base32 secret, like an authenticator app shows. */
export function totp(secret, at = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const ch of secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0')
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)))
  const h = createHmac('sha1', key).update(counter).digest()
  const o = h[h.length - 1] & 0xf
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(n % 1e6).padStart(6, '0')
}

/** Creates a confirmed user with the service key; optionally makes them admin. */
export async function makeUser(email, password, { admin = false, meta = {} } = {}) {
  const svc = service()
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta })
  if (error) throw error
  if (admin) {
    const { error: e2 } = await svc.from('profiles').update({ role: 'admin' }).eq('id', data.user.id)
    if (e2) throw e2
  }
  return data.user
}
