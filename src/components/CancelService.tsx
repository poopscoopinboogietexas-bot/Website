import { useState } from 'react'
import { BUSINESS, phoneLink } from '../lib/business'
import { niceDate, setAutopayCancelled } from '../lib/billing'
import { supabase } from '../lib/supabase'

/** "Cancel my service" on the customer page, with a confirm step and an undo. */
export default function CancelService({
  cancelledAt,
  hasAutopay,
  paidThrough,
  what,
  onChange,
}: {
  cancelledAt: string | null
  hasAutopay: boolean
  paidThrough: string | null | undefined
  what: 'service' | 'sign-up'
  onChange: (cancelledAt: string | null) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function change(cancel: boolean) {
    setBusy(true)
    setError('')
    // Stop the payments first, so we never mark them cancelled while autopay keeps charging.
    if (hasAutopay && !(await setAutopayCancelled(cancel))) {
      setBusy(false)
      return setError(`We couldn’t reach the payment system. Call or text us at ${BUSINESS.phone} and we’ll take care of it.`)
    }
    const { error } = await supabase.rpc(cancel ? 'cancel_my_service' : 'keep_my_service')
    setBusy(false)
    setConfirming(false)
    if (error) return setError(`That didn’t go through. Call or text us at ${BUSINESS.phone} and we’ll take care of it.`)
    onChange(cancel ? new Date().toISOString() : null)
  }

  const through = paidThrough ? `through ${niceDate(paidThrough)}` : 'through the month you’ve paid for'

  return (
    <section className="card">
      <h2>{what === 'service' ? 'Cancel service' : 'Cancel sign-up'}</h2>
      {cancelledAt ? (
        <>
          <div className="alert warn">
            {what === 'service'
              ? `You asked to cancel on ${new Date(cancelledAt).toLocaleDateString()}. We’ll keep scooping ${through}, then stop. You won’t be charged again.`
              : `You cancelled your sign-up on ${new Date(cancelledAt).toLocaleDateString()}.${hasAutopay ? ` You won’t be charged again.` : ''}`}
          </div>
          <button className="btn" onClick={() => change(false)} disabled={busy}>
            {busy ? 'Saving…' : what === 'service' ? 'Keep my service' : 'Undo, keep my sign-up'}
          </button>
        </>
      ) : confirming ? (
        <>
          <div>
            {what === 'service'
              ? `Are you sure? We’ll keep scooping ${through}, then stop. You won’t be charged again.`
              : 'Are you sure? We’ll take you off the schedule before your first visit.'}
          </div>
          <div className="row">
            <button className="btn danger" onClick={() => change(true)} disabled={busy}>
              {busy ? 'Cancelling…' : what === 'service' ? 'Yes, cancel my service' : 'Yes, cancel my sign-up'}
            </button>
            <button className="btn" onClick={() => setConfirming(false)} disabled={busy}>
              Never mind
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="muted">
            No contract. {what === 'service' ? 'Cancel anytime and you won’t be charged again.' : 'Changed your mind? No problem.'} Or call or text us at{' '}
            <a href={phoneLink()}>{BUSINESS.phone}</a>.
          </div>
          <button className="btn" onClick={() => setConfirming(true)}>
            {what === 'service' ? 'Cancel my service' : 'Cancel my sign-up'}
          </button>
        </>
      )}
      {error && <div className="alert bad">{error}</div>}
    </section>
  )
}
