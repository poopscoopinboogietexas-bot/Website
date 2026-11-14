import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchClients } from '../lib/data'
import { isDueOn, localDate, nextDate, weekdayOf } from '../lib/schedule'
import { copyText, phoneDigits, reminderText, smsLink, wantsReminder } from '../lib/texts'
import { DAYS, type Client } from '../lib/types'

/** Walk through tomorrow's route one customer at a time, with each reminder text filled in. */
export default function Texts() {
  const tomorrow = nextDate(localDate())
  const weekday = weekdayOf(tomorrow)
  const storeKey = `textsSent:${tomorrow}`
  const [clients, setClients] = useState<Client[] | null>(null)
  const [error, setError] = useState('')
  const [sent, setSent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storeKey) ?? '[]')
    } catch {
      return []
    }
  })
  const [copied, setCopied] = useState('')

  useEffect(() => {
    fetchClients()
      .then(setClients)
      .catch(() => setError('Could not load tomorrow’s route. Check your signal and try again.'))
  }, [])

  const route = (clients ?? []).filter((c) => isDueOn(c, tomorrow))
  const toText = route.filter((c) => wantsReminder(c) && phoneDigits(c.phone))
  const skipped = route.filter((c) => !toText.includes(c))
  const current = toText.find((c) => !sent.includes(c.id))

  function markSent(id: string) {
    const next = sent.includes(id) ? sent : [...sent, id]
    setSent(next)
    try {
      localStorage.setItem(storeKey, JSON.stringify(next))
    } catch {
      /* storage blocked */
    }
  }

  return (
    <main className="page">
      <div className="row between">
        <Link to="/app" className="btn small">
          ← Today
        </Link>
      </div>
      <header className="stack" style={{ gap: 4 }}>
        <h1>Text tomorrow’s customers</h1>
        <div className="muted">
          {DAYS[weekday]} · {toText.filter((c) => sent.includes(c.id)).length} of {toText.length} texted
        </div>
      </header>

      {error && <div className="alert bad">{error}</div>}
      {clients && route.length === 0 && <div className="card flat">Nobody is on the route for {DAYS[weekday]}.</div>}

      {current ? (
        <section className="card stack">
          <h2>{current.name}</h2>
          <div className="muted">{current.phone}</div>
          <div className="text-preview">{reminderText(current, weekday)}</div>
          <a className="btn primary big" href={smsLink(current.phone, reminderText(current, weekday))} onClick={() => setCopied('')}>
            Open text to {current.name.split(' ')[0]}
          </a>
          <div className="row">
            <button
              type="button"
              className="btn small"
              onClick={async () => setCopied((await copyText(reminderText(current, weekday))) ? 'Message copied.' : 'Could not copy on this phone.')}
            >
              Copy message
            </button>
            <button
              type="button"
              className="btn small"
              onClick={async () => setCopied((await copyText(current.phone)) ? 'Number copied.' : 'Could not copy on this phone.')}
            >
              Copy number
            </button>
          </div>
          {copied && <div className="muted">{copied}</div>}
          <button type="button" className="btn big denim" onClick={() => markSent(current.id)}>
            Sent. Next →
          </button>
        </section>
      ) : (
        toText.length > 0 && <div className="alert ok">Everyone on tomorrow’s route has been texted. 🎉</div>
      )}

      {toText.length > 0 && (
        <section className="stack">
          {toText.map((c) => (
            <div key={c.id} className="row between card flat">
              <span className="grow">
                {sent.includes(c.id) ? '✓ ' : ''}
                {c.name}
              </span>
              {sent.includes(c.id) && (
                <button type="button" className="btn small" onClick={() => setSent(sent.filter((id) => id !== c.id))}>
                  Text again
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {skipped.length > 0 && (
        <section className="card flat">
          <h2>Not texting</h2>
          {skipped.map((c) => (
            <div key={c.id} className="muted">
              {c.name}: {!wantsReminder(c) ? 'turned reminder texts off' : 'no phone number on file'}
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
