import { describe, expect, it, vi, beforeEach } from 'vitest'
import { buildForecast } from '../src/engine/forecast'
import { buildOutlook } from '../src/engine/outlook'
import { BIG_BEND, expectRow, expectTwilight, nwsFetch } from './parity'
import forecastWant from './fixtures/forecast-expected.json'
import outlookWant from './fixtures/outlook-expected.json'

const HOUR_TOL = { sunAlt: 0.15, moonAlt: 0.15, moonIllum: 1e-3, score: 0.15 }
const NIGHT_TOL = { moonIllum: 1e-3, moonUpFraction: 0.05, darkHours: 0.5, score: 0.15 }

beforeEach(() => { vi.stubGlobal('fetch', nwsFetch()) })

describe('buildForecast', () => {
  it('matches astro-cli for the night of 2026-10-03', async () => {
    const got = await buildForecast(BIG_BEND, { date: '2026-10-03' })
    expect(got.errors).toEqual([])
    expect(got.location).toEqual(forecastWant.location)
    expect(got.night).toEqual(forecastWant.night)
    expectTwilight(got.twilight, forecastWant.twilight)
    expect(got.hours).toHaveLength(forecastWant.hours.length)
    got.hours.forEach((h, i) => expectRow(h, forecastWant.hours[i], HOUR_TOL))
  })

  it('defaults to tonight in the location timezone', async () => {
    const got = await buildForecast(BIG_BEND, {}, new Date('2026-10-04T03:00:00Z'))
    expect(got.night.startLocal).toBe('2026-10-03T19:00:00-05:00')
  })

  it('rejects an invalid date', async () => {
    await expect(buildForecast(BIG_BEND, { date: '2026-13-01' })).rejects.toThrow(/Invalid date/)
  })

  it('degrades to no hours plus an error when the hourly forecast fails', async () => {
    vi.stubGlobal('fetch', nwsFetch(['hourly']))
    const got = await buildForecast(BIG_BEND, { date: '2026-10-03' })
    expect(got.hours).toEqual([])
    expect(got.errors[0]).toMatch(/^forecast: /)
    expect(got.twilight).not.toBeNull()
  })

  it('keeps hours without sky cover when only the gridpoint fails', async () => {
    vi.stubGlobal('fetch', nwsFetch(['grid']))
    const got = await buildForecast(BIG_BEND, { date: '2026-10-03' })
    expect(got.errors).toEqual([])
    expect(got.hours.length).toBeGreaterThan(0)
    expect(got.hours.every((h) => h.skyCover === null)).toBe(true)
  })
})

describe('buildOutlook', () => {
  it('matches astro-cli for 7 nights', async () => {
    const got = await buildOutlook(BIG_BEND, { nights: 7 })
    expect(got.errors).toEqual([])
    expect(got.location).toEqual(outlookWant.location)
    expect(got.timezone).toBe('America/Chicago')
    expect(got.nights).toHaveLength(outlookWant.nights.length)
    got.nights.forEach((n, i) => {
      const want = outlookWant.nights[i]
      expectRow(n, want, NIGHT_TOL)
      expectTwilight(n.twilight, want.twilight)
      expect(n.hours).toHaveLength(want.hours.length)
      n.hours.forEach((h, j) => expectRow(h, want.hours[j], HOUR_TOL))
    })
  })

  it('degrades to no nights plus an error when the 12-hour forecast fails', async () => {
    vi.stubGlobal('fetch', nwsFetch(['forecast']))
    const got = await buildOutlook(BIG_BEND, {})
    expect(got.nights).toEqual([])
    expect(got.errors[0]).toMatch(/^outlook: /)
  })

  it('falls back to text cloud estimates when the gridpoint fails', async () => {
    vi.stubGlobal('fetch', nwsFetch(['grid']))
    const got = await buildOutlook(BIG_BEND, { nights: 7 })
    expect(got.errors).toEqual([])
    expect(got.nights.every((n) => n.cloudSource !== 'grid')).toBe(true)
    expect(got.nights.some((n) => n.cloudSource === 'text')).toBe(true)
  })
})
