import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchClients, fetchVisitsOn } from '../lib/data'
import { isDueOn, localDate, mapsDirectionsUrl, money, weekdayOf } from '../lib/schedule'
import { cleanupPending } from '../lib/texts'
import { arrivalTimes, clock, fullRouteUrl, geocodeAll, getStartAddress, miles, setStartAddress, shortestOrder, type Point } from '../lib/route'
import { WORK_DAY } from '../lib/business'
import { supabase } from '../lib/supabase'
import { DAYS, type Client, type Visit } from '../lib/types'

export default function Today() {
  const today = localDate()
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Payment problems older than 7 days pause service (they show on the Call list). Needs migration 0009.
    Promise.resolve(supabase.rpc('pause_overdue'))
      .catch(() => null)
      .then(() => Promise.all([fetchClients(), fetchVisitsOn(today)]))
      .then(([c, v]) => {
        setClients(c)
        setVisits(v)
      })
      .catch(() => setError('Could not load today’s jobs. Check your signal and pull to refresh.'))
      .finally(() => setLoading(false))
  }, [today])

  const [start, setStartState] = useState(getStartAddress)
  const [draftStart, setDraftStart] = useState(start)
  const [editingStart, setEditingStart] = useState(false)
  const [points, setPoints] = useState<Map<string, Point | null> | null>(null)

  // Saved order first (big first-time cleanups last so they don't hold up the rest).
  const due = useMemo(
    () =>
      clients
        .filter((c) => isDueOn(c, today))
        .sort((a, b) => Number(cleanupPending(a)) - Number(cleanupPending(b))),
    [clients, today],
  )

  // Look up every address (cached on this phone), then plan the shortest drive.
  useEffect(() => {
    if (due.length === 0) return
    let cancelled = false
    geocodeAll([...(start ? [start] : []), ...due.map((c) => c.address)]).then((m) => {
      if (!cancelled) setPoints(m)
    })
    return () => {
      cancelled = true
    }
  }, [due, start])

  const plan = useMemo(() => {
    if (!points) return { route: due, miles: null as number | null, missing: 0, origin: null as Point | null }
    const origin = (start && points.get(start)) || null
    const located = (cs: Client[]) => cs.filter((c) => points.get(c.address)).map((c) => ({ item: c, point: points.get(c.address)! }))
    const regular = located(due.filter((c) => !cleanupPending(c)))
    const cleanups = located(due.filter((c) => cleanupPending(c)))
    const first = shortestOrder(origin, regular)
    const lastPoint = first.length ? points.get(first[first.length - 1].address)! : origin
    const second = shortestOrder(lastPoint, cleanups)
    const unlocated = due.filter((c) => !points.get(c.address))
    // Addresses the map couldn't find keep their saved order, before the cleanups.
    const route = [...first, ...unlocated.filter((c) => !cleanupPending(c)), ...second, ...unlocated.filter((c) => cleanupPending(c))]
    let total = 0
    let prev = origin
    for (const c of [...first, ...second]) {
      const p = points.get(c.address)!
      if (prev) total += miles(prev, p)
      prev = p
    }
    return { route, miles: total, missing: unlocated.length, origin }
  }, [due, points, start])
  const route = plan.route
  const times = arrivalTimes(
    plan.origin,
    route.map((c) => ({
      point: points?.get(c.address) ?? null,
      minutes: cleanupPending(c) ? WORK_DAY.minutesFirstCleanup : WORK_DAY.minutesPerYard,
    })),
    { startMinutes: WORK_DAY.start, mph: WORK_DAY.mph, roadFactor: WORK_DAY.roadFactor },
  )
  const finish = times.length ? times[times.length - 1].leave : null
  const overflow = times.filter((t) => t.leave > WORK_DAY.end).length
  const callList = clients.filter((c) => c.status === 'paused')
  const visitFor = (id: string) => visits.find((v) => v.client_id === id)
  const doneCount = route.filter((c) => visitFor(c.id)?.status === 'complete').length
  const next = route.find((c) => visitFor(c.id)?.status !== 'complete')

  function goNext() {
    if (!next) return
    window.open(mapsDirectionsUrl(next.address), '_blank', 'noopener')
    navigate(`/app/job/${next.id}`)
  }

  return (
    <main className="page">
      <header className="header">
        <img src="./logo.png" alt="" />
        <div className="grow">
          <h1>Today’s jobs</h1>
          <div className="sub">
            {DAYS[weekdayOf(today)]} · {doneCount} of {route.length} done
          </div>
        </div>
        <button className="btn small" onClick={() => supabase.auth.signOut()}>
          Log out
        </button>
      </header>

      {error && <div className="alert bad">{error}</div>}

      {callList.length > 0 && (
        <section className="card" style={{ borderColor: 'var(--bad)' }}>
          <h2>Call list</h2>
          <div className="muted">Paused for not paying. Give them a call.</div>
          {callList.map((c) => (
            <div className="row between" key={c.id}>
              <Link to={`/app/clients/${c.id}`} className="grow">
                {c.name}
              </Link>
              {c.phone && (
                <a className="btn small denim" href={`tel:${c.phone}`}>
                  Call {c.phone}
                </a>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="card flat stack" style={{ gap: 6 }}>
        {editingStart ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault()
              setStartAddress(draftStart)
              setStartState(draftStart.trim())
              setEditingStart(false)
            }}
          >
            <label className="field">
              Where do you leave from? (saved on this phone only)
              <input id="start-address" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} placeholder="123 Oak St, Tyler, TX" autoComplete="street-address" />
            </label>
            <button className="btn small">Save</button>
          </form>
        ) : (
          <div className="row between">
            <span className="muted grow">
              {route.length > 0 && plan.miles !== null ? `Shortest route: about ${Math.round(plan.miles)} mi` : 'Planning route…'}
              {start ? ` from ${start}` : ''}
              {plan.missing > 0 ? ` · couldn’t find ${plan.missing} address${plan.missing === 1 ? '' : 'es'} on the map` : ''}
            </span>
            <button type="button" className="btn small" onClick={() => setEditingStart(true)}>
              {start ? 'Change start' : 'Set start'}
            </button>
          </div>
        )}
        {finish !== null && (
          <div className={overflow ? 'alert warn' : 'muted'}>
            {overflow
              ? `Runs until about ${clock(finish)}. Move ${overflow} yard${overflow === 1 ? '' : 's'} to another day to finish by ${clock(WORK_DAY.end)}.`
              : `Start ${clock(WORK_DAY.start)}, done about ${clock(finish)}.`}
          </div>
        )}
        {route.length > 1 && (
          <a className="btn small denim" href={fullRouteUrl(start, route.filter((c) => visitFor(c.id)?.status !== 'complete').map((c) => c.address))} target="_blank" rel="noopener">
            Open whole route in Google Maps
          </a>
        )}
      </section>

      {next ? (
        <button className="btn primary big" onClick={goNext}>
          Next house: {next.name} →
        </button>
      ) : (
        !loading &&
        route.length > 0 && <div className="alert ok">All done for today. Great scoopin’! Spray and rinse your tools.</div>
      )}

      <Link to="/app/texts" className="btn">
        💬 Text tomorrow’s customers
      </Link>

      {!loading && route.length === 0 && !error && (
        <div className="card flat">
          <h2>No yards today</h2>
          <div className="muted">Nobody is scheduled for {DAYS[weekdayOf(today)]}. Add clients on the Clients tab.</div>
        </div>
      )}

      <section className="stack">
        {route.map((c, i) => {
          const v = visitFor(c.id)
          return (
            <Link key={c.id} to={`/app/job/${c.id}`} className={`card job ${v?.status === 'complete' ? 'complete' : ''}`}>
              <span className="num">{v?.status === 'complete' ? '✓' : i + 1}</span>
              <span className="grow stack" style={{ gap: 4 }}>
                <strong>
                  {c.name}
                  {times[i] && v?.status !== 'complete' && <span className="muted"> · ~{clock(times[i].arrive)}</span>}
                </strong>
                <span className="muted">{c.address}</span>
                <span className="row" style={{ gap: 6 }}>
                  {(c.dogs ?? []).map((d) => (
                    <span key={d.id} className="pill dog">
                      {d.name}
                    </span>
                  ))}
                  {c.status === 'payment_issue' && <span className="pill payment_issue">Payment issue</span>}
                  {cleanupPending(c) && <span className="pill doing">Initial cleanup +{money(c.initial_fee_cents ?? 0)}</span>}
                  {v?.status === 'in_progress' && <span className="pill doing">In progress</span>}
                </span>
              </span>
            </Link>
          )
        })}
      </section>
    </main>
  )
}
