import { supabase } from '../lib/supabase'

export const USERNAME_RULE = /^[a-z0-9._]{3,20}$/
export const MOBILE_RULE = /^[6-9]\d{9}$/
export const MIN_PASSWORD = 8

/**
 * Creates a customer account. Supabase needs an email per login, so each
 * customer gets a private placeholder address they never see or use.
 */
export async function signUpCustomer(username: string, mobile: string, password: string): Promise<void> {
  const { data: check, error: checkError } = await supabase.rpc('signup_check', { p_username: username, p_mobile: mobile })
  if (checkError) throw new Error(checkError.message)
  const taken = (check as { username_taken: boolean; mobile_taken: boolean }[])[0]
  if (taken?.mobile_taken) throw new Error('This mobile number already has an account. Log in instead.')
  if (taken?.username_taken) throw new Error('That username is taken. Try another.')

  const { data, error } = await supabase.auth.signUp({
    email: `c-${crypto.randomUUID()}@customers.vks-store.invalid`,
    password,
    options: { data: { username, mobile } },
  })
  if (error) throw new Error(error.message)
  if (!data.session) {
    // Happens only if "Confirm email" is still on in Supabase.
    throw new Error('Sign-up is not ready yet. Please ask VK on WhatsApp.')
  }
}

/** Logs a customer in with their username or mobile number. */
export async function logInCustomer(login: string, password: string): Promise<void> {
  const wrong = new Error('Wrong username, mobile or password.')
  const { data: email, error } = await supabase.rpc('customer_login_email', { p_login: login.trim() })
  if (error) throw new Error(error.message)
  if (!email) throw wrong
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: email as string, password })
  if (signInError) throw wrong
}

export async function fetchMyProfile(): Promise<{ username: string; mobile: string | null } | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await supabase.from('profiles').select('username, mobile').eq('id', auth.user.id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}
