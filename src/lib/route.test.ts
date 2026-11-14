import { describe, expect, it } from 'vitest'
import { arrivalTimes, clock, fullRouteUrl, miles, rankDays, shortestOrder } from './route'

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

describe('times and days', () => {
  it('formats clock times', () => {
    expect(clock(9 * 60)).toBe('9:00 AM')
    expect(clock(12 * 60 + 5)).toBe('12:05 PM')
    expect(clock(17 * 60 + 30)).toBe('5:30 PM')
  })
  it('adds driving and yard time', () => {
    const home = { lat: 32.35, lng: -95.3 }
    const times = arrivalTimes(home, [{ point: home, minutes: 15 }, { point: null, minutes: 15 }], { startMinutes: 540, mph: 25, roadFactor: 1.3 })
    expect(times[0]).toEqual({ arrive: 540, leave: 555 })
    expect(times[1]).toEqual({ arrive: 565, leave: 580 })
  })
  it('suggests the day with a yard nearby', () => {
    const home = { lat: 32.35, lng: -95.3 }
    const near = { lat: 32.351, lng: -95.301 }
    const far = { lat: 32.5, lng: -95.5 }
    const ranked = rankDays(home, [1, 2, 3], [{ day: 1, point: far }, { day: 2, point: near }])
    expect(ranked.map((r) => r.day)).toEqual([2, 3, 1])
  })
})
