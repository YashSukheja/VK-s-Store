import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Logo } from '../../components/Logo'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

type Step = 'password' | 'enroll' | 'code'

const inputClass =
  'h-12 w-full rounded-[10px] border-[1.5px] border-field bg-white px-3 text-base outline-none focus:border-ink'

export function AdminLogin() {
  const { session, role, aal, loading, refresh, signOut } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Signed in as admin with password only: go straight to the code step.
  useEffect(() => {
    if (!loading && session && role === 'admin' && aal === 'aal1' && step === 'password') {
      void prepareSecondStep()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, role, aal])

  if (!loading && session && role === 'admin' && aal === 'aal2') {
    return <Navigate to="/admin" replace />
  }

  async function prepareSecondStep() {
    setError(null)
    const { data, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError) return setError(listError.message)

    const verified = data.all.find((f) => f.factor_type === 'totp' && f.status === 'verified')
    if (verified) {
      setFactorId(verified.id)
      setStep('code')
      return
    }

    // First time: clear any half-finished setup, then show a fresh QR code.
    for (const f of data.all.filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) {
      await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'VK Store admin',
      issuer: "VK's Store",
    })
    if (enrollError) return setError(enrollError.message)
    setFactorId(enrolled.id)
    setQr(enrolled.totp.qr_code)
    setSecret(enrolled.totp.secret)
    setStep('enroll')
  }

  async function onPassword(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError) {
      setBusy(false)
      return setError('Wrong email or password.')
    }
    const { data: myRole } = await supabase.rpc('my_role')
    if (myRole !== 'admin') {
      await signOut()
      setBusy(false)
      return setError('This account is not the store admin.')
    }
    await prepareSecondStep()
    setBusy(false)
  }

  async function onCode(e: FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setBusy(true)
    setError(null)
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
    if (verifyError) {
      setBusy(false)
      return setError('That code didn’t work. Use the newest 6-digit code from the app.')
    }
    await refresh()
    setBusy(false)
    navigate('/admin', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="bg-ink px-5 py-5">
        <Logo admin dark />
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 px-5 py-10">
        {step === 'password' && (
          <form onSubmit={onPassword} className="flex flex-col gap-4 rounded-2xl bg-white p-5">
            <h1 className="m-0 font-display text-2xl font-black uppercase">Admin login</h1>
            <label className="flex flex-col gap-1.5 text-sm font-bold">
              Email
              <input className={inputClass} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-bold">
              Password
              <input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && <p role="alert" className="m-0 text-sm font-semibold text-danger">{error}</p>}
            <button disabled={busy} className="h-[54px] rounded-[14px] bg-ink text-base font-extrabold text-white disabled:opacity-60">
              {busy ? 'Checking…' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'enroll' && (
          <form onSubmit={onCode} className="flex flex-col gap-4 rounded-2xl bg-white p-5">
            <h1 className="m-0 font-display text-2xl font-black uppercase">Set up your code app</h1>
            <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed text-body">
              <li>Install Google Authenticator (or any authenticator app) on your phone.</li>
              <li>In the app, tap + and scan this QR code.</li>
              <li>Type the 6-digit code it shows.</li>
            </ol>
            {qr && <img src={qr} alt="QR code for the authenticator app" className="mx-auto size-48" />}
            {secret && (
              <p className="m-0 break-all text-center text-xs text-muted">
                Can't scan? Enter this key: <span className="font-mono font-bold text-ink">{secret}</span>
              </p>
            )}
            <CodeInput value={code} onChange={setCode} />
            {error && <p role="alert" className="m-0 text-sm font-semibold text-danger">{error}</p>}
            <button disabled={busy || code.length !== 6} className="h-[54px] rounded-[14px] bg-ink text-base font-extrabold text-white disabled:opacity-60">
              {busy ? 'Checking…' : 'Finish setup'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={onCode} className="flex flex-col gap-4 rounded-2xl bg-white p-5">
            <h1 className="m-0 font-display text-2xl font-black uppercase">Enter your code</h1>
            <p className="m-0 text-sm text-body">Open your authenticator app and type the 6-digit code for VK's Store.</p>
            <CodeInput value={code} onChange={setCode} />
            {error && <p role="alert" className="m-0 text-sm font-semibold text-danger">{error}</p>}
            <button disabled={busy || code.length !== 6} className="h-[54px] rounded-[14px] bg-ink text-base font-extrabold text-white disabled:opacity-60">
              {busy ? 'Checking…' : 'Log in'}
            </button>
            <button type="button" onClick={() => void signOut().then(() => setStep('password'))} className="min-h-11 text-sm font-bold underline underline-offset-4">
              Use a different account
            </button>
          </form>
        )}
      </main>
    </div>
  )
}

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-bold">
      6-digit code
      <input
        className={`${inputClass} text-center font-display text-2xl tracking-[0.4em]`}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      />
    </label>
  )
}
