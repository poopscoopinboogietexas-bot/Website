import { useState } from 'react'
import { money } from '../lib/schedule'
import { supabase } from '../lib/supabase'
import { cleanupPriceText, copyText, phoneDigits, smsLink } from '../lib/texts'
import type { Client } from '../lib/types'

/** First-visit card: the quoted cleanup fee, and a way to text the customer a new price for approval. */
export default function CleanupPrice({ client, onSaved }: { client: Client; onSaved: (cents: number) => void }) {
  const quoted = client.initial_fee_cents ?? 0
  const [open, setOpen] = useState(false)
  const [dollars, setDollars] = useState(String(quoted / 100))
  const [error, setError] = useState('')
  const newCents = Math.max(0, Math.round(Number(dollars) * 100) || 0)
  const message = cleanupPriceText(client, quoted, newCents)
  const canText = Boolean(phoneDigits(client.phone))

  async function save() {
    setError('')
    const { error } = await supabase.from('clients').update({ initial_fee_cents: newCents }).eq('id', client.id)
    if (error) setError('Could not save the new price. Change it on the client page later.')
    else onSaved(newCents)
  }

  return (
    <section className="card" style={{ borderColor: 'var(--warn)' }}>
      <h2>Initial cleanup: +{money(quoted)}</h2>
      <div className="muted">
        First visit. Quoted from the sign-up, added to their first bill. If the yard is a lot worse than that, adjust it before you start.
      </div>
      {!open ? (
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          Adjust cleanup price
        </button>
      ) : (
        <>
          <label className="field">
            New cleanup price ($)
            <input id="new-cleanup" type="number" min="0" step="5" inputMode="decimal" value={dollars} onChange={(e) => setDollars(e.target.value)} />
          </label>
          <div className="text-preview">{message}</div>
          <div className="muted">Take a photo of the yard and attach it in the text. Wait for their YES before you start.</div>
          {canText ? (
            <a className="btn primary" href={smsLink(client.phone, message)} onClick={save}>
              💬 Text new price to {client.name.split(' ')[0]}
            </a>
          ) : (
            <div className="alert warn">No phone number on file. Call or knock instead.</div>
          )}
          <div className="row">
            <button type="button" className="btn small" onClick={() => copyText(message)}>
              Copy message
            </button>
            <button type="button" className="btn small" onClick={save}>
              Save price only
            </button>
          </div>
          {error && <div className="alert bad">{error}</div>}
        </>
      )}
    </section>
  )
}
