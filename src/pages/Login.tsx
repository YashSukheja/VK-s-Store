import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { fieldClass } from '../components/admin'
import { Page } from '../components/Page'
import { logInCustomer, MIN_PASSWORD, MOBILE_RULE, signUpCustomer, USERNAME_RULE } from '../data/account'
import { useAuth } from '../lib/auth'

const labelClass = 'flex flex-col gap-1.5 text-sm font-extrabold'
const hintClass = 'text-xs font-semibold text-muted'

/** Only same-site paths, so a link can't send people elsewhere after login. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/account'
}

export function Login({ mode }: { mode: 'login' | 'register' }) {
  const { session, loading, refresh } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [login, setLogin] = useState('')
  const [username, setUsername] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')

  if (!loading && session && !busy) return <Navigate to={next} replace />

  const otherMode = mode === 'login' ? '/register' : '/login'
  const keepNext = params.get('next') ? `?next=${encodeURIComponent(next)}` : ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (mode === 'register') {
      if (!USERNAME_RULE.test(username)) return setError('Username: 3 to 20 small letters, numbers, dots or underscores.')
      if (!MOBILE_RULE.test(mobile)) return setError('Mobile number: 10 digits, without +91.')
      if (password.length < MIN_PASSWORD) return setError(`Password: at least ${MIN_PASSWORD} characters.`)
    }
    setBusy(true)
    try {
      if (mode === 'register') await signUpCustomer(username, mobile, password)
      else await logInCustomer(login, password)
      await refresh()
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title={mode === 'login' ? 'Log in' : 'Create account'}>
      <p className="m-0 text-sm text-body">
        {mode === 'login' ? 'Log in to book and see your bookings.' : 'Takes a few seconds. You need an account to book.'}
      </p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === 'login' ? (
          <label className={labelClass}>
            Username or mobile number
            <input className={fieldClass} autoComplete="username" autoCapitalize="none" required value={login} onChange={(e) => setLogin(e.target.value)} />
          </label>
        ) : (
          <>
            <label className={labelClass}>
              Username
              <input
                className={fieldClass}
                autoComplete="username"
                autoCapitalize="none"
                maxLength={20}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
              />
              <span className={hintClass}>Small letters, numbers, dots or underscores.</span>
            </label>
            <label className={labelClass}>
              Mobile number
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-muted">+91</span>
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <span className={hintClass}>VK uses this to reach you about your booking.</span>
            </label>
          </>
        )}
        <label className={labelClass}>
          Password
          <input
            className={fieldClass}
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={mode === 'register' ? MIN_PASSWORD : undefined}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'register' && <span className={hintClass}>At least {MIN_PASSWORD} characters.</span>}
        </label>
        {error && (
          <p role="alert" className="m-0 rounded-xl bg-warn-bg px-3.5 py-3 text-sm font-semibold text-warn-ink">
            {error}
          </p>
        )}
        <button disabled={busy} className="h-[54px] rounded-[14px] bg-ink text-base font-extrabold text-white disabled:opacity-60">
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
      <p className="m-0 text-center text-sm text-body">
        {mode === 'login' ? 'New here? ' : 'Already have an account? '}
        <Link to={`${otherMode}${keepNext}`} className="font-extrabold underline underline-offset-4">
          {mode === 'login' ? 'Create an account' : 'Log in'}
        </Link>
      </p>
      {mode === 'login' && <p className="m-0 text-center text-xs text-muted">Forgot your password? Message VK on WhatsApp.</p>}
    </Page>
  )
}
