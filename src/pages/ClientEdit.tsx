import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { fetchClient } from '../lib/data'
import { localDate, mapsDirectionsUrl, money } from '../lib/schedule'
import { PHOTO_BUCKET, supabase } from '../lib/supabase'
import {
  DAYS,
  STATUS_LABEL,
  TEMPERAMENT_LABEL,
  type Client,
  type ClientNote,
  type ClientStatus,
  type Dog,
  type Signup,
  type Temperament,
  type Visit,
} from '../lib/types'
import { cleanupPending } from '../lib/texts'
import { monthlyPriceCents } from '../lib/business'
import BestDay from '../components/BestDay'
import { phoneDigits, smsLink, welcomeEmailLink, welcomeText } from '../lib/texts'
import { WORK_DAY } from '../lib/business'

type DogDraft = Omit<Dog, 'id' | 'client_id'> & { id?: string }
type ClientDraft = Omit<Client, 'id' | 'dogs'>

const BLANK: ClientDraft = {
  name: '',
  phone: '',
  email: '',
  address: '',
  gate_code: '',
  access_notes: '',
  bag_disposal: 'client_bin',
  instructions: '',
  plan: 'weekly',
  service_day: 2,
  biweekly_anchor: null,
  price_cents: 6000,
  status: 'active',
  payment_issue_since: null,
  paid_through: null,
  route_order: 100,
}

export default function ClientEdit() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const isNew = !clientId
  const signup = (useLocation().state as { signup?: Signup } | null)?.signup
  const [form, setForm] = useState<ClientDraft>(() =>
    signup
      ? {
          ...BLANK,
          name: signup.name,
          phone: signup.phone,
          email: signup.email,
          address: signup.address,
          plan: signup.plan === 'biweekly' ? 'biweekly' : 'weekly',
          price_cents: monthlyPriceCents(signup.plan === 'biweekly' ? 'biweekly' : 'weekly', signup.dog_count),
          ...(signup.bag_backup ? { bag_backup: signup.bag_backup } : {}),
          ...(signup.blocked_days?.length ? { blocked_days: signup.blocked_days } : {}),
          instructions: signup.notes,
          ...((signup.initial_fee_cents ?? 0) > 0 ? { initial_fee_cents: signup.initial_fee_cents, initial_fee_paid: false } : {}),
        }
      : BLANK,
  )
  const [dogs, setDogs] = useState<DogDraft[]>([])
  const [removedDogs, setRemovedDogs] = useState<string[]>([])
  const [notes, setNotes] = useState<ClientNote[]>([])
  const [visits, setVisits] = useState<(Visit & { yardUrl?: string })[]>([])
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  // Day on file when the page opened; a new or changed day offers a welcome message after saving.
  const [savedDay, setSavedDay] = useState<number | null>(null)
  const [welcome, setWelcome] = useState<{ id: string } | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!clientId) return
    fetchClient(clientId)
      .then((c) => {
        const { dogs: d, id: _id, ...rest } = c
        void _id
        setForm(rest)
        setSavedDay(rest.service_day)
        setDogs(d ?? [])
      })
      .catch(() => setError('Could not load this client.'))
    supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setNotes((data as ClientNote[]) ?? []))
    supabase
      .from('visits')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'complete')
      .order('visit_date', { ascending: false })
      .limit(8)
      .then(async ({ data }) => {
        const list = (data as Visit[]) ?? []
        const withUrls = await Promise.all(
          list.map(async (v) => {
            if (!v.yard_photo_path) return v
            const { data: s } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(v.yard_photo_path, 3600)
            return { ...v, yardUrl: s?.signedUrl }
          }),
        )
        setVisits(withUrls)
      })
  }, [clientId])

  function set<K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setStatus(status: ClientStatus) {
    setForm((f) => ({
      ...f,
      status,
      payment_issue_since: status === 'payment_issue' ? (f.payment_issue_since ?? localDate()) : null,
    }))
  }

  function markPaid() {
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setForm((f) => ({
      ...f,
      paid_through: localDate(end),
      status: f.status === 'cancelled' ? f.status : 'active',
      payment_issue_since: null,
      // The one-time cleanup fee rides on the first payment only.
      ...((f.initial_fee_cents ?? 0) > 0 ? { initial_fee_paid: true } : {}),
    }))
    setMessage('Marked paid through the end of this month. Tap Save to keep it.')
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body: Partial<ClientDraft> = {
      ...form,
      biweekly_anchor: form.plan === 'biweekly' ? form.biweekly_anchor || localDate() : null,
    }
    // Text settings only exist once migration 0003 has run; leave them out until they're set.
    if (body.reminder_texts === undefined) delete body.reminder_texts
    if (body.done_texts === undefined) delete body.done_texts
    if (body.initial_fee_cents === undefined) delete body.initial_fee_cents
    if (body.initial_fee_paid === undefined) delete body.initial_fee_paid
    if (body.bag_backup === undefined) delete body.bag_backup
    if (body.blocked_days === undefined) delete body.blocked_days
    const res = isNew
      ? await supabase.from('clients').insert(body).select('id').single()
      : await supabase.from('clients').update(body).eq('id', clientId!).select('id').single()
    if (res.error) {
      setError(
        /reminder_texts|done_texts|initial_fee|bag_backup|blocked_days/.test(res.error.message)
          ? 'Could not save: this needs the database updates on the list in SETUP.md (pending-updates.sql).'
          : 'Could not save. Check that name, address and day are filled in.',
      )
      setSaving(false)
      return
    }
    const id = res.data.id as string
    for (const dogId of removedDogs) await supabase.from('dogs').delete().eq('id', dogId)
    for (const d of dogs.filter((d) => d.name.trim())) {
      const row = { client_id: id, name: d.name.trim(), breed: d.breed, temperament: d.temperament, notes: d.notes }
      if (d.id) await supabase.from('dogs').update(row).eq('id', d.id)
      else await supabase.from('dogs').insert(row)
    }
    if (signup) await supabase.from('signups').update({ handled: true }).eq('id', signup.id)
    setSaving(false)
    if (form.status !== 'cancelled' && form.service_day !== savedDay && (form.phone || form.email)) {
      setSavedDay(form.service_day)
      setWelcome({ id })
      window.scrollTo(0, 0)
    } else navigate('/app/clients')
  }

  async function addNote() {
    if (!clientId || !newNote.trim()) return
    const { data, error } = await supabase
      .from('client_notes')
      .insert({ client_id: clientId, body: newNote.trim() })
      .select()
      .single()
    if (!error && data) {
      setNotes([data as ClientNote, ...notes])
      setNewNote('')
    }
  }

  function updateDog(i: number, patch: Partial<DogDraft>) {
    setDogs((list) => list.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  }

  return (
    <main className="page">
      <div className="row between">
        <Link to="/app/clients" className="btn small">
          ← Clients
        </Link>
        {!isNew && form.address && (
          <a className="btn small denim" href={mapsDirectionsUrl(form.address)} target="_blank" rel="noopener">
            Directions
          </a>
        )}
      </div>
      <h1>{isNew ? 'New client' : form.name || 'Client'}</h1>

      {welcome && (
        <section className="card stack" style={{ borderColor: 'var(--pink)' }}>
          <h2>Saved! Tell {form.name.split(' ')[0]} their day</h2>
          <div className="text-preview">{welcomeText(form, form.service_day)}</div>
          {phoneDigits(form.phone) && (
            <a className="btn primary big" href={smsLink(form.phone, welcomeText(form, form.service_day))}>
              💬 Text welcome message
            </a>
          )}
          {form.email && (
            <a className="btn denim" href={welcomeEmailLink(form, form.service_day)}>
              ✉️ Email welcome message
            </a>
          )}
          <button type="button" className="btn" onClick={() => navigate('/app/clients')}>
            Done
          </button>
        </section>
      )}

      <form className="stack" onSubmit={save}>
        <section className="card">
          <h2>Contact</h2>
          <label className="field">
            Name
            <input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <div className="grid2">
            <label className="field">
              Phone
              <input id="phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </label>
            <label className="field">
              Email (photos go here)
              <input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </label>
          </div>
          <label className="field">
            Address
            <input id="address" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="123 Oak St, Tyler, TX 75701" required />
          </label>
          <label className="check">
            <input id="reminder_texts" type="checkbox" checked={form.reminder_texts !== false} onChange={(e) => set('reminder_texts', e.target.checked)} />
            <span>Reminder text the day before</span>
          </label>
          <label className="check">
            <input id="done_texts" type="checkbox" checked={form.done_texts !== false} onChange={(e) => set('done_texts', e.target.checked)} />
            <span>“Service done” text after each visit</span>
          </label>
        </section>

        <section className="card">
          <h2>Yard access</h2>
          <div className="grid2">
            <label className="field">
              Gate code
              <input id="gate_code" value={form.gate_code} onChange={(e) => set('gate_code', e.target.value)} />
            </label>
            <label className="field">
              If the trash bin isn’t reachable, leave bags
              <input id="bag_backup" value={form.bag_backup ?? ''} onChange={(e) => set('bag_backup', e.target.value)} placeholder="Beside the garage" />
            </label>
          </div>
          <label className="field">
            Which gate / how to get in
            <input id="access_notes" value={form.access_notes} onChange={(e) => set('access_notes', e.target.value)} placeholder="Left side gate, latch sticks" />
          </label>
          <label className="field">
            Special instructions
            <textarea id="instructions" value={form.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder="Sick dog, scoop last. Don't let the cat out." />
          </label>
        </section>

        <section className="card">
          <h2>Dogs</h2>
          {dogs.map((d, i) => (
            <div key={d.id ?? `new-${i}`} className="card flat">
              <div className="grid2">
                <label className="field">
                  Name
                  <input id={`dog-name-${i}`} value={d.name} onChange={(e) => updateDog(i, { name: e.target.value })} />
                </label>
                <label className="field">
                  Breed
                  <input id={`dog-breed-${i}`} value={d.breed} onChange={(e) => updateDog(i, { breed: e.target.value })} />
                </label>
              </div>
              <label className="field">
                Around people
                <select id={`dog-temp-${i}`} value={d.temperament} onChange={(e) => updateDog(i, { temperament: e.target.value as Temperament })}>
                  {Object.entries(TEMPERAMENT_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Notes
                <input id={`dog-notes-${i}`} value={d.notes} onChange={(e) => updateDog(i, { notes: e.target.value })} />
              </label>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  if (d.id) setRemovedDogs((r) => [...r, d.id!])
                  setDogs((list) => list.filter((_, j) => j !== i))
                }}
              >
                Remove dog
              </button>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => setDogs([...dogs, { name: '', breed: '', temperament: 'friendly', notes: '' }])}>
            + Add dog
          </button>
        </section>

        <section className="card">
          <h2>Plan</h2>
          <div className="grid2">
            <label className="field">
              How often
              <select id="plan" value={form.plan} onChange={(e) => set('plan', e.target.value as ClientDraft['plan'])}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every other week</option>
              </select>
            </label>
            <label className="field">
              Day
              <select id="service_day" value={form.service_day} onChange={(e) => set('service_day', Number(e.target.value))}>
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(form.blocked_days ?? []).includes(form.service_day) && (
            <div className="alert warn">{DAYS[form.service_day]} doesn’t work for them. Pick another day.</div>
          )}
          <BestDay address={form.address} clientId={clientId} blockedDays={form.blocked_days ?? []} onPick={(day) => set('service_day', day)} />
          <div className="field">
            Days that don’t work for them
            <div className="row">
              {WORK_DAY.days.map((d) => (
                <label key={d} className="check" style={{ padding: 0 }}>
                  <input
                    type="checkbox"
                    checked={(form.blocked_days ?? []).includes(d)}
                    onChange={(e) =>
                      set(
                        'blocked_days',
                        e.target.checked ? [...(form.blocked_days ?? []), d].sort() : (form.blocked_days ?? []).filter((x) => x !== d),
                      )
                    }
                  />
                  <span>{DAYS[d].slice(0, 3)}</span>
                </label>
              ))}
            </div>
          </div>
          {form.plan === 'biweekly' && (
            <label className="field">
              First visit date (sets which weeks)
              <input id="biweekly_anchor" type="date" value={form.biweekly_anchor ?? ''} onChange={(e) => set('biweekly_anchor', e.target.value || null)} />
            </label>
          )}
          <div className="grid2">
            <label className="field">
              Price per month ($)
              <input
                id="price"
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={form.price_cents / 100}
                onChange={(e) => set('price_cents', Math.round(Number(e.target.value) * 100))}
              />
            </label>
            <label className="field">
              Stop order on route (lower goes first)
              <input id="route_order" type="number" inputMode="numeric" value={form.route_order} onChange={(e) => set('route_order', Number(e.target.value))} />
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Payment</h2>
          <div className="row between">
            <span className={`pill ${form.status}`}>{STATUS_LABEL[form.status]}</span>
            <span className="muted">{form.paid_through ? `Paid through ${form.paid_through}` : 'No payment recorded'}</span>
          </div>
          <label className="field">
            Status
            <select id="status" value={form.status} onChange={(e) => setStatus(e.target.value as ClientStatus)}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="muted">Paused clients drop off the route and show up on the Call list.</div>
          <div className="grid2">
            <label className="field">
              Initial cleanup fee ($, one time)
              <input
                id="initial_fee"
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={(form.initial_fee_cents ?? 0) / 100}
                onChange={(e) => set('initial_fee_cents', Math.round(Number(e.target.value) * 100))}
              />
            </label>
            <label className="check" style={{ alignSelf: 'end' }}>
              <input id="initial_fee_paid" type="checkbox" checked={form.initial_fee_paid === true} onChange={(e) => set('initial_fee_paid', e.target.checked)} />
              <span>Cleanup fee paid</span>
            </label>
          </div>
          {cleanupPending(form) && (
            <div className="alert warn">
              First bill: {money(form.price_cents)} plan + {money(form.initial_fee_cents ?? 0)} cleanup ={' '}
              {money(form.price_cents + (form.initial_fee_cents ?? 0))}
            </div>
          )}
          <button type="button" className="btn" onClick={markPaid}>
            Mark paid for this month
          </button>
          {message && <div className="alert ok">{message}</div>}
        </section>

        {error && <div className="alert bad">{error}</div>}
        <button className="btn primary big" disabled={saving}>
          {saving ? 'Saving…' : 'Save client'}
        </button>
      </form>

      {!isNew && (
        <>
          <section className="card">
            <h2>Notes</h2>
            <div className="row">
              <input id="new-note" className="grow" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Bloody stool, texted owner" />
              <button type="button" className="btn small primary" onClick={addNote}>
                Add
              </button>
            </div>
            {notes.map((n) => (
              <div key={n.id}>
                <span className="muted">{new Date(n.created_at).toLocaleDateString()}</span> {n.body}
              </div>
            ))}
          </section>

          <section className="card">
            <h2>Recent visits</h2>
            {visits.length === 0 && <div className="muted">No completed visits yet.</div>}
            {visits.map((v) => (
              <div key={v.id} className="row">
                {v.yardUrl && <img src={v.yardUrl} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />}
                <div className="grow">
                  <strong>{v.visit_date}</strong>
                  <div className="muted">{v.emailed_at ? 'Photos emailed' : v.email_error ? `Email failed: ${v.email_error}` : 'Not emailed'}</div>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  )
}
