import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

type Role = 'customer' | 'admin' | null

type AuthState = {
  session: Session | null
  role: Role
  /** 'aal2' once the authenticator-app step is done in this session. */
  aal: 'aal1' | 'aal2' | null
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role>(null)
  const [aal, setAal] = useState<AuthState['aal']>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (next: Session | null) => {
    setSession(next)
    if (!next) {
      setRole(null)
      setAal(null)
      setLoading(false)
      return
    }
    const [{ data: roleData }, { data: aalData }] = await Promise.all([
      supabase.rpc('my_role'),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ])
    setRole((roleData as Role) ?? null)
    setAal((aalData?.currentLevel as AuthState['aal']) ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      // Defer so Supabase finishes its own state change before we query again.
      setTimeout(() => void load(next), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    await load(data.session)
  }, [load])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    await load(null)
  }, [load])

  return (
    <AuthContext.Provider value={{ session, role, aal, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
