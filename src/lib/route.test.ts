import { describe, expect, it } from 'vitest'
import { fullRouteUrl, miles, shortestOrder } from './route'

describe('route', () => {
  it('measures miles', () => {
    // Tyler to Whitehouse is about 9 miles as the crow flies
    const d = miles({ lat: 32.3513, lng: -95.3011 }, { lat: 32.2268, lng: -95.2255 })
    expect(d).toBeGreaterThan(8)
    expect(d).toBeLessThan(11)
  })

  it('visits stops in a line in order instead of zigzagging', () => {
    const start = { lat: 0, lng: 0 }
    const stops = [3, 1, 4, 2].map((n) => ({ item: n, point: { lat: 0, lng: n / 100 } }))
    expect(shortestOrder(start, stops)).toEqual([1, 2, 3, 4])
  })

  it('finds the shortest order for a small random route', () => {
    const start = { lat: 32.35, lng: -95.3 }
    const rnd = (n: number) => Math.sin(n * 9301 + 49297) / 20
    const stops = Array.from({ length: 7 }, (_, n) => ({ item: n, point: { lat: 32.35 + rnd(n), lng: -95.3 + rnd(n + 50) } }))
    const len = (order: number[]) => {
      let total = 0
      let prev = start
      for (const n of order) {
        total += miles(prev, stops[n].point)
        prev = stops[n].point
      }
      return total
    }
    const perms = (xs: number[]): number[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])))
    const best = Math.min(...perms(stops.map((s) => s.item)).map(len))
    expect(len(shortestOrder(start, stops))).toBeLessThanOrEqual(best * 1.05)
  })

  it('builds a full-day Google Maps link', () => {
    const url = fullRouteUrl('1 Home St, Tyler, TX', ['A St', 'B St', 'C St'])
    expect(url).toContain('origin=1+Home+St')
    expect(url).toContain('destination=C+St')
    expect(url).toContain('waypoints=A+St%7CB+St')
  })
})
