import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { authErrorText, returnUrl } from '../lib/links'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(authErrorText(error.message))
    setBusy(false)
  }

  async function forgot() {
    setError('')
    setNotice('')
    if (!email.trim()) {
      setError('Type your email above first, then tap “Forgot password?” again.')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: returnUrl() })
    setBusy(false)
    if (error) setError(authErrorText(error.message))
    else setNotice('If there’s an account with that email, we just sent a link to set a new password.')
  }

  return (
    <div className="center">
      <form className="login" onSubmit={submit}>
        <Link to="/">
          <img src="./logo.png" alt="Poop Scoopin' Boogie" />
        </Link>
        <h2>Log in</h2>
        <label className="field">
          Email
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          Password
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <div className="alert bad">{error}</div>}
        {notice && <div className="alert ok">{notice}</div>}
        <button className="btn primary big" disabled={busy}>
          {busy ? 'One moment…' : 'Log in'}
        </button>
        <button type="button" className="btn small" onClick={forgot} disabled={busy}>
          Forgot password?
        </button>
        <div className="muted">
          New here? <Link to="/signup">Sign up for scoopin’</Link>
        </div>
      </form>
    </div>
  )
}
