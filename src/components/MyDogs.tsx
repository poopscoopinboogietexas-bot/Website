import { useState, type FormEvent } from 'react'
import { BUSINESS, DOGS_MAX_PRICED, monthlyPriceCents } from '../lib/business'
import { dogsFromPrice } from '../lib/billing'
import { money } from '../lib/schedule'
import { supabase } from '../lib/supabase'
import { TEMPERAMENT_LABEL, type Client, type Dog, type Temperament } from '../lib/types'

const BLANK = { name: '', breed: '', temperament: 'friendly' as Temperament, notes: '' }

/** "Your dogs" on the customer page: add a new dog or remove one, and the monthly price follows. */
export default function MyDogs({ client, onChange }: { client: Client; onChange: (client: Client) => void }) {
  const dogs = client.dogs ?? []
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(BLANK)
  const [removing, setRemoving] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const fail = { ok: false, text: `That didn’t go through. Call or text us at ${BUSINESS.phone} and we’ll update it.` }

  /** How many dogs they pay for now: their list, or what their price says if that's higher. */
  const billedDogs = Math.max(dogs.length, dogsFromPrice(client.plan, client.price_cents), 1)

  // A price you set by hand (a special deal) isn't changed automatically; you get a note instead.
  const standardPrice = monthlyPriceCents(client.plan, billedDogs) === client.price_cents
  const newPrice = (count: number) => (standardPrice ? monthlyPriceCents(client.plan, Math.min(count, DOGS_MAX_PRICED)) : client.price_cents)

  /** Moves the monthly price to match the new dog count (autopay changes from the next bill). */
  async function reprice(count: number): Promise<string> {
    if (!standardPrice) return ' We’ll check your price and text you if it changes.'
    const monthly = monthlyPriceCents(client.plan, count)
    if (monthly === client.price_cents) return ''
    const { data, error } = await supabase.functions.invoke('billing', { body: { action: 'change', plan: client.plan, dog_count: count } })
    if (error || !data?.ok) return ` Text us at ${BUSINESS.phone} so we can update your price.`
    return ` Your price is now ${money(monthly)}/month${client.stripe_subscription_id ? ', starting with your next bill' : ''}.`
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const { data: id, error } = await supabase.rpc('add_my_dog', {
      p_name: draft.name.trim(),
      p_breed: draft.breed.trim(),
      p_temperament: draft.temperament,
      p_notes: draft.notes.trim(),
    })
    if (error || typeof id !== 'string') {
      setBusy(false)
      return setMessage(fail)
    }
    const dog: Dog = { id, client_id: client.id, name: draft.name.trim(), breed: draft.breed.trim(), temperament: draft.temperament, notes: draft.notes.trim() }
    const count = Math.min(billedDogs + 1, DOGS_MAX_PRICED)
    const priceNote = await reprice(count)
    setBusy(false)
    onChange({ ...client, dogs: [...dogs, dog], price_cents: priceNote.includes('Text us') ? client.price_cents : newPrice(count) })
    setAdding(false)
    setDraft(BLANK)
    setMessage({ ok: true, text: `Welcome, ${dog.name}! We’ll say hi on your next visit.${priceNote}` })
  }

  async function remove(dog: Dog) {
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.rpc('remove_my_dog', { p_id: dog.id })
    if (error) {
      setBusy(false)
      return setMessage(fail)
    }
    const count = Math.max(billedDogs - 1, 1)
    const priceNote = await reprice(count)
    setBusy(false)
    setRemoving(null)
    onChange({ ...client, dogs: dogs.filter((d) => d.id !== dog.id), price_cents: priceNote.includes('Text us') ? client.price_cents : newPrice(count) })
    setMessage({ ok: true, text: `${dog.name} is off your list.${priceNote}` })
  }

  return (
    <section className="card">
      <h2>Your dogs</h2>
      {dogs.length === 0 && <div className="muted">Add your dogs so we know who we’re saying hi to.</div>}
      {dogs.map((d) => (
        <div key={d.id} className="stack" style={{ gap: 6 }}>
          <div className="row between">
            <span>
              <strong>{d.name}</strong> {d.breed && <span className="muted">· {d.breed}</span>}
            </span>
            <span className="row" style={{ gap: 6 }}>
              <span className="pill dog">{TEMPERAMENT_LABEL[d.temperament]}</span>
              {removing !== d.id && (
                <button className="btn small" onClick={() => setRemoving(d.id)} disabled={busy}>
                  Remove
                </button>
              )}
            </span>
          </div>
          {removing === d.id && (
            <div className="row">
              <span className="grow">Take {d.name} off your list?</span>
              <button className="btn small danger" onClick={() => remove(d)} disabled={busy}>
                {busy ? 'Removing…' : 'Yes, remove'}
              </button>
              <button className="btn small" onClick={() => setRemoving(null)} disabled={busy}>
                Never mind
              </button>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <form className="card flat stack" style={{ gap: 8 }} onSubmit={add}>
          <strong>Add a dog</strong>
          <div className="grid2">
            <label className="field">
              Name
              <input id="dog-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} required />
            </label>
            <label className="field">
              Breed (optional)
              <input id="dog-breed" value={draft.breed} onChange={(e) => setDraft({ ...draft, breed: e.target.value })} maxLength={80} />
            </label>
          </div>
          <label className="field">
            Around people they don’t know, they’re…
            <select id="dog-temperament" value={draft.temperament} onChange={(e) => setDraft({ ...draft, temperament: e.target.value as Temperament })}>
              <option value="friendly">Friendly</option>
              <option value="shy">Shy</option>
              <option value="jumpy">A jumper</option>
              <option value="keep_out">Not safe to be around loose</option>
            </select>
          </label>
          <label className="field">
            Anything we should know? (optional)
            <input id="dog-notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} maxLength={500} />
          </label>
          {standardPrice && billedDogs >= 3 && billedDogs < DOGS_MAX_PRICED && (
            <div className="muted">
              Adding a dog makes your plan {money(monthlyPriceCents(client.plan, billedDogs + 1))}/month
              {client.stripe_subscription_id ? ', starting with your next bill' : ''}.
            </div>
          )}
          <div className="row">
            <button className="btn primary" disabled={busy}>
              {busy ? 'Adding…' : 'Add dog'}
            </button>
            <button type="button" className="btn" onClick={() => setAdding(false)} disabled={busy}>
              Never mind
            </button>
          </div>
        </form>
      ) : (
        <button className="btn" onClick={() => setAdding(true)} disabled={busy}>
          + Add a dog
        </button>
      )}
      {message && <div className={`alert ${message.ok ? 'ok' : 'bad'}`}>{message.text}</div>}
    </section>
  )
}
