import { useState } from 'react'
import { WORK_DAY } from '../lib/business'
import { fetchClients } from '../lib/data'
import { geocodeAll, rankDays } from '../lib/route'
import { DAYS } from '../lib/types'

type Ranked = ReturnType<typeof rankDays>

/** Suggests the service day whose other yards are closest, so each day stays in one part of town. */
export default function BestDay({ address, clientId, onPick }: { address: string; clientId?: string; onPick: (day: number) => void }) {
  const [ranked, setRanked] = useState<Ranked | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function suggest() {
    setError('')
    setRanked(null)
    if (!address.trim()) return setError('Type the address first.')
    setBusy(true)
    try {
      const others = (await fetchClients()).filter((c) => c.id !== clientId && c.status !== 'cancelled')
      const points = await geocodeAll([address, ...others.map((c) => c.address)])
      const home = points.get(address)
      if (!home) throw new Error('not found')
      setRanked(
        rankDays(
          home,
          WORK_DAY.days,
          others.filter((c) => points.get(c.address)).map((c) => ({ day: c.service_day, point: points.get(c.address)! })),
        ),
      )
    } catch {
      setError('Couldn’t find that address on the map. Check it, or pick a day yourself.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ gap: 6 }}>
      <button type="button" className="btn small" onClick={suggest} disabled={busy}>
        {busy ? 'Checking the map…' : 'Suggest best day'}
      </button>
      {error && <div className="muted">{error}</div>}
      {ranked?.map((r, i) => (
        <button key={r.day} type="button" className={`btn small ${i === 0 ? 'primary' : ''}`} onClick={() => onPick(r.day)}>
          {DAYS[r.day]}
          {r.nearestMiles === null
            ? ' · no yards yet'
            : ` · ${r.nearestMiles.toFixed(1)} mi from nearest yard · ${r.count} yard${r.count === 1 ? '' : 's'}`}
        </button>
      ))}
    </div>
  )
}
