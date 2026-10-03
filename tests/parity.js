import { expect, vi } from 'vitest'
import points from './fixtures/nws-points.json'
import grid from './fixtures/nws-forecastGridData.json'
import forecast12h from './fixtures/nws-forecast.json'
import hourly from './fixtures/nws-forecastHourly.json'
import stations from './fixtures/nws-stations.json'
import observation from './fixtures/nws-observation.json'

// Shared helpers for comparing engine output with astro-cli (skyfield) fixtures.

export const BIG_BEND = { name: 'Big Bend National Park, TX', latitude: 29.33, longitude: -103.21,
                          elevationM: 1111, timezone: 'America/Chicago' }

/** fetch mock serving the saved Big Bend NWS payloads; `fail` names endpoints that return 500. */
export function nwsFetch(fail = []) {
  const payloads = { points, grid, forecast: forecast12h, hourly, stations, observation }
  return vi.fn(async (url) => {
    const u = String(url)
    const key = u.includes('/points/') ? 'points' : u.endsWith('/forecast/hourly') ? 'hourly'
      : u.endsWith('/forecast') ? 'forecast' : u.endsWith('/stations') ? 'stations'
      : u.includes('/observations/latest') ? 'observation' : 'grid'
    if (fail.includes(key)) return { ok: false, status: 500, statusText: 'Server Error', json: async () => ({}) }
    return { ok: true, status: 200, json: async () => payloads[key] }
  })
}

const TWILIGHT_TOL_MS = 120_000

/** Twilight times within 2 minutes, same local offset; nulls and flags exact. */
export function expectTwilight(got, want) {
  expect(Object.keys(got).sort()).toEqual(Object.keys(want).sort())
  for (const [k, v] of Object.entries(want)) {
    if (typeof v !== 'string' || k === 'date') expect(got[k], k).toEqual(v)
    else {
      expect(Math.abs(new Date(got[k]) - new Date(v)), k).toBeLessThanOrEqual(TWILIGHT_TOL_MS)
      expect(got[k].slice(-6), k).toBe(v.slice(-6))
    }
  }
}

/** Numeric fields that come from ephemeris differ slightly between engines. */
export function expectRow(got, want, tol) {
  expect(Object.keys(got).sort()).toEqual(Object.keys(want).sort())
  for (const [k, v] of Object.entries(want)) {
    if (k in tol && v != null) expect(Math.abs(got[k] - v), k).toBeLessThanOrEqual(tol[k])
    else if (k !== 'hours' && k !== 'twilight') expect(got[k], k).toEqual(v)
  }
}

const PLAN_TOL = { score: 0.5, maxAlt: 0.2, altAtBest: 0.2, azAtBest: 1.5, moonInterference: 0.02 }
const STEP_MS = 15 * 60_000
// astro-cli labels the Moon from illuminated fraction only (a waning Moon reads "Waxing"); compare just the percentage.
const noteOf = (t) => (t.targetClass === 'moon' ? t.notes.replace(/^[^(]+/, '') : t.notes)

/**
 * Per-object parity of ranked plans. Objects within 0.2° of the 15° cut may fall on either side of it
 * between engines; flat peaks may pick a neighbouring sample, so times get one step of slack.
 * `interference: false` skips that field (astro-cli reports 0 in instant mode).
 */
export function expectPlan(got, want, { interference = true } = {}) {
  expect(Object.keys(got).sort()).toEqual(Object.keys(want).sort())
  for (const ins of Object.keys(want)) {
    const g = new Map(got[ins].map((t) => [t.id, t]))
    const w = new Map(want[ins].map((t) => [t.id, t]))
    const scores = got[ins].map((t) => t.score)
    expect(scores, `${ins} sorted`).toEqual([...scores].sort((a, b) => b - a))
    if (want[ins].length) expect(want[ins].slice(0, 3).map((t) => t.id), `${ins} top`).toContain(got[ins][0].id)
    for (const id of new Set([...g.keys(), ...w.keys()])) {
      const a = g.get(id)
      const b = w.get(id)
      if (!a || !b) {
        expect(Math.abs((a ?? b).maxAlt - 15), `${ins}/${id} in one engine only`).toBeLessThan(0.2)
        continue
      }
      const same = a.bestTime === b.bestTime
      for (const [k, tol] of Object.entries(PLAN_TOL)) {
        if (k === 'moonInterference' && !interference) continue
        if ((k === 'altAtBest' || k === 'azAtBest') && !same) continue
        expect(Math.abs(a[k] - b[k]), `${ins}/${id} ${k}`).toBeLessThanOrEqual(tol)
      }
      for (const [x, y, what] of [[a.bestTime, b.bestTime, 'bestTime'], [a.window.start, b.window.start, 'window.start'],
                                  [a.window.end, b.window.end, 'window.end']]) {
        expect(Math.abs(Date.parse(x) - Date.parse(y)), `${ins}/${id} ${what}`).toBeLessThanOrEqual(STEP_MS)
      }
      expect([a.name, a.targetClass, noteOf(a)], `${ins}/${id}`).toEqual([b.name, b.targetClass, noteOf(b)])
    }
  }
}
