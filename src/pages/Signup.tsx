import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PublicLayout from '../components/PublicLayout'
import { PLANS as PLAN_INFO } from '../lib/business'
import { supabase } from '../lib/supabase'
import { authErrorText, returnUrl } from '../lib/links'

const PLANS = PLAN_INFO.map((p) => ({
  value: p.value,
  label: p.name,
  price: p.per === '+' ? `from ${p.price}` : `from ${p.price}${p.per}`,
}))

export default function Signup() {
  const [params] = useSearchParams()
  const startPlan = PLANS.some((p) => p.value === params.get('plan')) ? params.get('plan')! : 'weekly'
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', dog_count: 1, plan: startPlan, notes: '' })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  // 'check-email' = account made, waiting on the confirmation link; 'ready' = already logged in
  const [done, setDone] = useState<false | 'check-email' | 'ready'>(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Pick a password with at least 8 characters.')
    if (password !== confirm) return setError('The two passwords don’t match.')
    setBusy(true)
    const email = form.email.trim()

    // 1. Make their login.
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: returnUrl(), data: { name: form.name.trim() } },
    })
    if (authError) {
      setBusy(false)
      return setError(authErrorText(authError.message))
    }
    // Supabase answers an existing email with a user that has no identities.
    if (data.user && data.user.identities?.length === 0) {
      setBusy(false)
      return setError('There’s already an account with that email. Log in instead, or tap “Forgot password?” there.')
    }

    // 2. Send their details to the team (shows up under New sign-ups).
    const { error } = await supabase.from('signups').insert({
      ...form,
      name: form.name.trim(),
      email,
      address: form.address.trim(),
    })
    setBusy(false)
    if (error) return setError('Your login was made, but we couldn’t send your details. Try again, or text us.')
    setDone(data.session ? 'ready' : 'check-email')
  }

  return (
    <PublicLayout>
    <main className="page" style={{ paddingBottom: 32 }}>
      <header className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <img src="./logo.png" alt="Poop Scoopin' Boogie" style={{ width: 180 }} />
        <h1>Let us do the dirty work</h1>
        <div className="muted">Weekly dog poop pickup in Tyler, TX. You get a photo of your clean yard and latched gate after every visit.</div>
      </header>

      {done ? (
        <section className="card">
          <h2>Thanks, {form.name.split(' ')[0]}!</h2>
          {done === 'check-email' ? (
            <div className="alert ok">
              One more step: we sent an email to {form.email.trim()}. Tap the link in it to confirm your account. Check your spam folder if
              you don’t see it.
            </div>
          ) : null}
          <div>We got your info and will reach out within a day to set up your first visit.</div>
          <Link to={done === 'ready' ? '/account' : '/login'} className="btn">
            {done === 'ready' ? 'Go to my account' : 'Log in'}
          </Link>
        </section>
      ) : (
        <form className="stack" onSubmit={submit}>
          <section className="card">
            <h2>Pick a plan</h2>
            {PLANS.map((p) => (
              <label key={p.value} className="check">
                <input id={`plan-${p.value}`} type="radio" name="plan" checked={form.plan === p.value} onChange={() => set('plan', p.value)} />
                <span className="grow">
                  {p.label} <span className="muted">· {p.price}</span>
                </span>
              </label>
            ))}
            <label className="field">
              How many dogs?
              <select id="dog_count" value={form.dog_count} onChange={(e) => set('dog_count', Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n === 6 ? '6 or more' : n}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="card">
            <h2>Your info</h2>
            <label className="field">
              Name
              <input id="su-name" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </label>
            <div className="grid2">
              <label className="field">
                Phone
                <input id="su-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
              </label>
              <label className="field">
                Email
                <input id="su-email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
              </label>
            </div>
            <label className="field">
              Address
              <input
                id="su-address"
                autoComplete="street-address"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="123 Oak St, Tyler, TX"
                required
              />
            </label>
            <div className="grid2">
              <label className="field">
                Create a password
                <input id="su-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>
              <label className="field">
                Type it again
                <input id="su-confirm" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </label>
            </div>
            <div className="muted">At least 8 characters. You’ll use your email and this password to log in and see your visit photos.</div>
            <label className="field">
              Anything we should know? (gate, dog names, sick pups)
              <textarea id="su-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={1000} />
            </label>
          </section>

          {error && <div className="alert bad">{error}</div>}
          <button className="btn primary big" disabled={busy}>
            {busy ? 'Sending…' : 'Sign me up'}
          </button>
          <div className="muted" style={{ textAlign: 'center' }}>
            Already a customer? <Link to="/login">Log in</Link>
          </div>
        </form>
      )}
    </main>
    </PublicLayout>
  )
}
