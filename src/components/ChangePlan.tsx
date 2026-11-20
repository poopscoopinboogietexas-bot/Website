import { useState } from 'react'
import { BUSINESS, DOGS_MAX_PRICED, monthlyPriceCents, PLAN_BASE_CENTS } from '../lib/business'
import { money } from '../lib/schedule'
import { supabase } from '../lib/supabase'

type Plan = 'weekly' | 'biweekly'

/** "Change my plan" on the customer page: weekly / every other week and number of dogs. */
export default function ChangePlan({
  plan,
  dogs,
  hasAutopay,
  onChanged,
}: {
  plan: Plan
  dogs: number
  hasAutopay: boolean
  onChanged: (plan: Plan, dogs: number, monthlyCents: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [next, setNext] = useState({ plan, dogs: Math.min(dogs, DOGS_MAX_PRICED) })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const price = monthlyPriceCents(next.plan, next.dogs)
  const unchanged = next.plan === plan && next.dogs === Math.min(dogs, DOGS_MAX_PRICED)

  async function save() {
    setBusy(true)
    setMessage(null)
    const { data, error } = await supabase.functions.invoke('billing', { body: { action: 'change', plan: next.plan, dog_count: next.dogs } })
    setBusy(false)
    if (error || !data?.ok) {
      return setMessage({ ok: false, text: `That didn’t go through. Call or text us at ${BUSINESS.phone} and we’ll change it for you.` })
    }
    onChanged(next.plan, next.dogs, data.monthly ?? price)
    setOpen(false)
    setMessage({
      ok: true,
      text: `Done! You’re on ${next.plan === 'weekly' ? 'weekly' : 'every other week'} service for ${next.dogs} dog${next.dogs === 1 ? '' : 's'}, ${money(price)}/month${hasAutopay ? ', starting with your next bill' : ''}.`,
    })
  }

  if (!open) {
    return (
      <>
        <button
          className="btn"
          onClick={() => {
            setNext({ plan, dogs: Math.min(dogs, DOGS_MAX_PRICED) })
            setMessage(null)
            setOpen(true)
          }}
        >
          Change my plan
        </button>
        {message && <div className={`alert ${message.ok ? 'ok' : 'bad'}`}>{message.text}</div>}
      </>
    )
  }

  return (
    <div className="card flat stack" style={{ gap: 8 }}>
      <strong>Change my plan</strong>
      {(['weekly', 'biweekly'] as const).map((p) => (
        <label key={p} className="check">
          <input id={`change-${p}`} type="radio" name="change-plan" checked={next.plan === p} onChange={() => setNext({ ...next, plan: p })} />
          <span className="grow">
            {p === 'weekly' ? 'Weekly' : 'Every other week'} <span className="muted">· from {money(PLAN_BASE_CENTS[p])}/month</span>
          </span>
        </label>
      ))}
      <label className="field">
        How many dogs?
        <select id="change-dogs" value={next.dogs} onChange={(e) => setNext({ ...next, dogs: Number(e.target.value) })}>
          {Array.from({ length: DOGS_MAX_PRICED }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n === DOGS_MAX_PRICED ? `${n} or more` : n}
            </option>
          ))}
        </select>
      </label>
      <div className="alert ok">
        New price: <strong>{money(price)}/month</strong>
        {hasAutopay ? ', starting with your next bill. No extra charge today.' : '.'}
        {next.plan === 'biweekly' && plan === 'weekly' ? ' Same service day, every other week.' : ''}
      </div>
      <div className="row">
        <button className="btn primary" onClick={save} disabled={busy || unchanged}>
          {busy ? 'Saving…' : 'Save my new plan'}
        </button>
        <button className="btn" onClick={() => setOpen(false)} disabled={busy}>
          Never mind
        </button>
      </div>
      {message && !message.ok && <div className="alert bad">{message.text}</div>}
    </div>
  )
}
