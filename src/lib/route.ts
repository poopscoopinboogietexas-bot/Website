// Free route planning: look up each address on OpenStreetMap (cached on this phone),
// then order the stops so the total drive is as short as possible.
// Distances are straight-line, which is close enough inside Tyler and nearby towns.

export interface Point {
  lat: number
  lng: number
}

const CACHE_KEY = 'geocodeCache:v1'
const START_KEY = 'routeStartAddress'

function readCache(): Record<string, Point | null> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeCache(cache: Record<string, Point | null>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* storage blocked */
  }
}

/** The address you leave from each day. Kept on this phone only. */
export function getStartAddress(): string {
  try {
    return localStorage.getItem(START_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setStartAddress(address: string) {
  try {
    if (address.trim()) localStorage.setItem(START_KEY, address.trim())
    else localStorage.removeItem(START_KEY)
  } catch {
    /* storage blocked */
  }
}

const normalize = (address: string) => address.trim().toLowerCase().replace(/\s+/g, ' ')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Look up many addresses. OpenStreetMap asks for at most one lookup a second, so new ones are spaced out. */
export async function geocodeAll(addresses: string[]): Promise<Map<string, Point | null>> {
  const cache = readCache()
  const out = new Map<string, Point | null>()
  let first = true
  for (const address of new Set(addresses)) {
    const key = normalize(address)
    if (key in cache) {
      out.set(address, cache[key])
      continue
    }
    if (!first) await sleep(1100)
    first = false
    let point: Point | null = null
    try {
      const q = /\btx\b|texas/i.test(address) ? address : `${address}, TX`
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } },
      )
      const data = (await res.json()) as { lat: string; lon: string }[]
      if (data[0]) point = { lat: Number(data[0].lat), lng: Number(data[0].lon) }
    } catch {
      out.set(address, null)
      continue // network trouble: don't cache, try again next time
    }
    cache[key] = point
    writeCache(cache)
    out.set(address, point)
  }
  return out
}

/** Straight-line distance in miles. */
export function miles(a: Point, b: Point): number {
  const R = 3958.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function pathLength(start: Point | null, pts: Point[]): number {
  let total = 0
  let prev = start
  for (const p of pts) {
    if (prev) total += miles(prev, p)
    prev = p
  }
  return total
}

/**
 * Shortest order to visit every stop, starting from `start` (or anywhere, if no start).
 * Nearest-neighbor first, then 2-opt swaps until nothing improves. Plenty for a day's route.
 */
export function shortestOrder<T>(start: Point | null, stops: { item: T; point: Point }[]): T[] {
  if (stops.length <= 1) return stops.map((s) => s.item)
  // Nearest neighbor
  const left = [...stops]
  const order: typeof stops = []
  let here = start ?? left[0].point
  while (left.length) {
    let best = 0
    for (let i = 1; i < left.length; i++) if (miles(here, left[i].point) < miles(here, left[best].point)) best = i
    const [next] = left.splice(best, 1)
    order.push(next)
    here = next.point
  }
  // 2-opt
  let improved = true
  while (improved) {
    improved = false
    for (let i = 0; i < order.length - 1; i++) {
      for (let k = i + 1; k < order.length; k++) {
        const candidate = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)]
        if (pathLength(start, candidate.map((s) => s.point)) + 1e-9 < pathLength(start, order.map((s) => s.point))) {
          order.splice(0, order.length, ...candidate)
          improved = true
        }
      }
    }
  }
  return order.map((s) => s.item)
}

/** Google Maps link for the whole day: start → every stop in order. Phones handle up to about 9 stops in one link. */
export function fullRouteUrl(start: string, addresses: string[]): string {
  const stops = addresses.slice(0, 10)
  const destination = stops[stops.length - 1]
  const waypoints = stops.slice(0, -1)
  const params = new URLSearchParams({ api: '1', destination, travelmode: 'driving' })
  if (start) params.set('origin', start)
  if (waypoints.length) params.set('waypoints', waypoints.join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
