import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { authErrorText } from '../lib/links'

/** Where the "reset your password" email link ends up. */
export default function ResetPassword() {
  const { session, role } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Pick a password with at least 8 characters.')
    if (password !== confirm) return setError('The two passwords don’t match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(authErrorText(error.message))
    else navigate(role === 'staff' ? '/app' : '/account', { replace: true })
  }

  if (session === undefined) return null

  return (
    <div className="center">
      <form className="login" onSubmit={submit}>
        <img src="./logo.png" alt="Poop Scoopin' Boogie" />
        <h2>Set a new password</h2>
        {session ? (
          <>
            <label className="field">
              New password
              <input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <label className="field">
              Type it again
              <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </label>
            {error && <div className="alert bad">{error}</div>}
            <button className="btn primary big" disabled={busy}>
              {busy ? 'Saving…' : 'Save password'}
            </button>
          </>
        ) : (
          <>
            <div className="alert warn">That link has expired or was already used. Ask for a new one from the login page.</div>
            <Link to="/login" className="btn">
              Go to login
            </Link>
          </>
        )}
      </form>
    </div>
  )
}
