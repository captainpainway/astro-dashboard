import { expect, vi } from 'vitest'
import points from './fixtures/nws-points.json'
import grid from './fixtures/nws-forecastGridData.json'
import forecast12h from './fixtures/nws-forecast.json'
import hourly from './fixtures/nws-forecastHourly.json'

// Shared helpers for comparing engine output with astro-cli (skyfield) fixtures.

export const BIG_BEND = { name: 'Big Bend National Park, TX', latitude: 29.33, longitude: -103.21,
                          elevationM: 1111, timezone: 'America/Chicago' }

/** fetch mock serving the saved Big Bend NWS payloads; `fail` names endpoints that return 500. */
export function nwsFetch(fail = []) {
  const payloads = { points, grid, forecast: forecast12h, hourly }
  return vi.fn(async (url) => {
    const u = String(url)
    const key = u.includes('/points/') ? 'points' : u.endsWith('/forecast/hourly') ? 'hourly'
      : u.endsWith('/forecast') ? 'forecast' : 'grid'
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
