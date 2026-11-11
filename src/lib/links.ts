/** Where email links (confirm account, reset password) send people back to. */
export const returnUrl = () => window.location.origin + window.location.pathname

/** Turn Supabase auth errors into plain words. */
export function authErrorText(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'That email and password don’t match. Check them and try again.'
  if (m.includes('email not confirmed'))
    return 'Please confirm your email first. Tap the link in the email we sent you when you signed up.'
  if (m.includes('already registered')) return 'There’s already an account with that email. Log in instead.'
  if (m.includes('password')) return 'Pick a password with at least 8 characters.'
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Too many tries in a row. Wait a few minutes and try again.'
  return 'Something went wrong. Check what you typed and try again in a minute.'
}
