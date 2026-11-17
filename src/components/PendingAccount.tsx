import { useEffect, useState } from 'react'
import { BUSINESS, CLEANUP_FEES, monthlyPriceCents, phoneLink, PLANS } from '../lib/business'
import { money } from '../lib/schedule'
import { supabase } from '../lib/supabase'
import { DAYS, type Signup } from '../lib/types'

/** Account page for someone who signed up but isn't on the schedule yet. */
export default function PendingAccount({ email }: { email: string }) {
  const [signup, setSignup] = useState<Signup | null | undefined>(undefined)

  useEffect(() => {
    supabase
      .from('signups')
      .select('*')
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSignup((data as Signup) ?? null))
  }, [email])

  const plan = signup ? PLANS.find((p) => p.value === signup.plan) : undefined
  const monthly = signup && signup.plan !== 'one_time' ? monthlyPriceCents(signup.plan, signup.dog_count) : null
  const fee = signup?.initial_fee_cents ?? 0
  const lastCleaned = CLEANUP_FEES.find((f) => f.value === signup?.last_cleaned)?.label
  const blocked = signup?.blocked_days ?? []

  return (
    <>
      <section className="card">
        <div className="row between">
          <h2>You’re signed up!</h2>
          <span className="pill doing">Picking your day</span>
        </div>
        <ol className="stack" style={{ gap: 6, margin: 0, paddingLeft: 20 }}>
          <li>
            <strong>We pick your service day</strong> based on your area, so our route stays tight
            {blocked.length ? `, and we’ll skip ${blocked.map((d) => DAYS[d]).join(' and ')}` : ''}.
          </li>
          <li>
            <strong>We text and email you your day</strong>, usually within a day.
          </li>
          <li>
            <strong>The night before each visit</strong>, you get a reminder text.
          </li>
          <li>
            <strong>After every visit</strong>, we email you photos of your clean yard and latched gate. They’ll show up on this page too.
          </li>
        </ol>
      </section>

      {signup && (
        <section className="card">
          <h2>Your sign-up</h2>
          <dl className="kv">
            <dt>Plan</dt>
            <dd>
              {plan?.name ?? signup.plan}
              {monthly !== null ? ` · ${money(monthly)}/month` : ' · from $60'}
            </dd>
            <dt>Dogs</dt>
            <dd>{signup.dog_count}</dd>
            <dt>Address</dt>
            <dd>{signup.address}</dd>
            {lastCleaned && (
              <>
                <dt>Yard last cleaned</dt>
                <dd>{lastCleaned}</dd>
              </>
            )}
            {monthly !== null && (
              <>
                <dt>First bill</dt>
                <dd>{fee ? `${money(monthly)} + ${money(fee)} one-time cleanup = ${money(monthly + fee)}` : money(monthly)}</dd>
              </>
            )}
            {blocked.length > 0 && (
              <>
                <dt>Days that don’t work</dt>
                <dd>{blocked.map((d) => DAYS[d]).join(', ')}</dd>
              </>
            )}
            {signup.bag_backup && (
              <>
                <dt>If we can’t reach your bin</dt>
                <dd>{signup.bag_backup}</dd>
              </>
            )}
            {signup.notes && (
              <>
                <dt>Notes</dt>
                <dd>{signup.notes}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      <section className="card">
        <h2>Need to change something?</h2>
        <div className="muted">Call or text us and we’ll update it before your first visit.</div>
        <div className="row">
          <a className="btn primary" href={phoneLink('sms')}>
            Text {BUSINESS.phone}
          </a>
          <a className="btn" href={phoneLink('tel')}>
            Call
          </a>
        </div>
      </section>
    </>
  )
}
