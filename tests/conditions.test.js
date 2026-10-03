import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { buildForecast, summarizeHours } from '../src/engine/forecast'
import { clearWeatherCache } from '../src/engine/nws'
import { buildOutlook } from '../src/engine/outlook'
import { buildTonight } from '../src/engine/tonight'
import { TARGET_CLASSES, generatePlan, halfHourGrid } from '../src/engine/scoring'
import { BIG_BEND, expectPlan, expectRow, expectTwilight, nwsFetch } from './parity'
import forecastWant from './fixtures/forecast-expected.json'
import outlookWant from './fixtures/outlook-expected.json'
import tonight from './fixtures/tonight-expected.json'
import grid from './fixtures/nws-forecastGridData.json'

const HOUR_TOL = { sunAlt: 0.15, moonAlt: 0.15, moonIllum: 1e-3, score: 0.15 }
const NIGHT_TOL = { moonIllum: 1e-3, moonUpFraction: 0.05, darkHours: 0.5, score: 0.15 }

beforeEach(() => { clearWeatherCache(); vi.stubGlobal('fetch', nwsFetch()) })

describe('buildForecast', () => {
  it('matches astro-cli for the night of 2026-10-03, from the sunset hour to the sunrise hour', async () => {
    const got = await buildForecast(BIG_BEND, { date: '2026-10-03' })
    expect(got.errors).toEqual([])
    expect(got.location).toEqual(forecastWant.location)
    expectTwilight(got.twilight, forecastWant.twilight)
    expect([got.night.startLocal, got.night.endLocal]).toEqual([got.twilight.sunset, got.twilight.sunrise])
    // from the hour containing sunset (19:35) to the one containing sunrise (07:47): astro-cli's hours plus 07:00
    expect(got.hours.map((h) => h.time.slice(11, 16))).toEqual(
      ['19:00', '20:00', '21:00', '22:00', '23:00', '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00'])
    let matched = 0
    for (const h of got.hours) {
      const want = forecastWant.hours.find((w) => w.time === h.time)
      // moonIllum is taken at the window's midpoint, which moved by ~25 minutes with the new window
      if (want) { expectRow(h, want, { ...HOUR_TOL, moonIllum: 0.01 }); matched++ }
    }
    expect(matched).toBe(12)
  })

  it('defaults to tonight in the location timezone', async () => {
    const got = await buildForecast(BIG_BEND, {}, new Date('2026-10-04T03:00:00Z'))
    expect(got.night.startLocal).toBe(got.twilight.sunset)
    expect(got.twilight.sunset.slice(0, 10)).toBe('2026-10-03')
  })

  it('keeps 19:00 to 07:00 where the Sun does not set', async () => {
    const got = await buildForecast({ ...BIG_BEND, latitude: 80, longitude: 0, timezone: 'UTC' }, { date: '2026-06-21' })
    expect([got.night.startLocal, got.night.endLocal]).toEqual(['2026-06-21T19:00:00+00:00', '2026-06-22T07:00:00+00:00'])
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

describe('summarizeHours', () => {
  const hour = (score, over = {}) => ({ isDark: true, skyCover: 100, tempF: 60, windMph: 5, precipProb: 10, score, ...over })

  it('never scores a night below zero, even when its hours do', () => {
    const n = summarizeHours([hour(-40), hour(-15), hour(10)])
    expect(n.score).toBeCloseTo(10 / 3)
    expect(n.rating).toBe('bad')
  })

  it('averages the dark hours only, and is null without any sky cover', () => {
    expect(summarizeHours([hour(80), hour(60), hour(5, { isDark: false })]).score).toBe(70)
    expect(summarizeHours([hour(80, { skyCover: null })])).toBeNull()
  })
})

describe('buildOutlook', () => {
  it('matches astro-cli for 7 nights, but runs each night from sunset to sunrise instead of the NWS period', async () => {
    const got = await buildOutlook(BIG_BEND, { nights: 7 })
    expect(got.errors).toEqual([])
    expect(got.location).toEqual(outlookWant.location)
    expect(got.timezone).toBe('America/Chicago')
    expect(got.nights).toHaveLength(outlookWant.nights.length)
    got.nights.forEach((n, i) => {
      const want = outlookWant.nights[i]
      // what the NWS night period itself says
      for (const k of ['date', 'label', 'windDir', 'shortForecast']) expect(n[k], k).toEqual(want[k])
      expectTwilight(n.twilight, want.twilight)
      expect([n.start, n.end]).toEqual([n.twilight.sunset, n.twilight.sunrise])
      // hours: the one containing sunset through the one containing sunrise
      const [sunset, sunrise] = [Date.parse(n.start), Date.parse(n.end)]
      const [first, last] = [Date.parse(n.hours[0].time), Date.parse(n.hours.at(-1).time)]
      // (tonight's hourly data starts at 20:00 in the fixture, after the 19:00 hour has gone)
      if (i === 0) expect(first).toBeGreaterThanOrEqual(Math.floor(sunset / 3_600_000) * 3_600_000)
      else expect(first <= sunset && sunset < first + 3_600_000, `${n.date} first hour ${n.hours[0].time} vs sunset ${n.start}`).toBe(true)
      expect(last <= sunrise && sunrise < last + 3_600_000, `${n.date} last hour ${n.hours.at(-1).time} vs sunrise ${n.end}`).toBe(true)
      expect(n.hours.length).toBeGreaterThanOrEqual(want.hours.length)
      // hours astro-cli also lists agree with it, bar the moon-dependent score, which shifts with the new window midpoint
      const core = ({ reasons, score, rating, moonIllum, ...rest }) => rest
      n.hours.forEach((h) => {
        const w = want.hours.find((x) => x.time === h.time)
        if (w) expectRow(core(h), core(w), HOUR_TOL)
      })
    })
  })

  it("rates tonight from its hours, and the hourly forecast's summary of the same night is identical", async () => {
    const outlook = await buildOutlook(BIG_BEND, { nights: 7 })
    const tonight = outlook.nights[0]
    const forecast = await buildForecast(BIG_BEND, { date: tonight.twilight.date })
    const want = summarizeHours(forecast.hours)
    expect(want).not.toBeNull()
    expect({ cloudCover: tonight.cloudCover, tempF: tonight.tempF, windMph: tonight.windMph, precipProb: tonight.precipProb,
             score: tonight.score, rating: tonight.rating, reasons: tonight.reasons })
      .toEqual({ cloudCover: want.cloudCover, tempF: want.tempF, windMph: want.windMph, precipProb: want.precipProb,
                 score: Math.round(want.score * 10) / 10, rating: want.rating, reasons: want.reasons })
  })

  it('falls back to the NWS period when there is no hourly forecast', async () => {
    vi.stubGlobal('fetch', nwsFetch(['hourly']))
    const got = await buildOutlook(BIG_BEND, { nights: 7 })
    expect(got.nights[0].hours).toEqual([])
    expect(got.nights[0].rating).toBe(outlookWant.nights[0].rating) // as astro-cli rated it from the period
    expect(got.nights[0].tempF).toBe(outlookWant.nights[0].tempF)
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

describe('buildTonight', () => {
  const NOW = new Date('2026-10-03T15:00:00-05:00')

  // astro-cli ranks over 21:00-05:00; here the window is astronomical dusk to dawn, so the ranking itself is
  // compared with astro-cli in engine.test.js (same grid), and this checks the window and its plumbing.
  it('ranks tonight (window mode) over astronomical dusk to dawn', async () => {
    const got = await buildTonight(BIG_BEND, {}, NOW)
    const want = tonight.window
    expect(got.errors).toEqual([])
    expect(got.mode).toBe('window')
    expect(got.location).toEqual(want.location)
    expectTwilight(got.twilight, want.twilight)
    expect([got.night.startLocal, got.night.endLocal]).toEqual([got.twilight.astroDusk, got.twilight.astroDawn])
    expect(got.weather.current).toEqual(want.weather.current)
    expect(got.weather.summary.rating).toBeTruthy()
    const grid = halfHourGrid(new Date(got.night.startUtc), new Date(got.night.endUtc))
    expect(got.instruments).toEqual(generatePlan(got.location, grid, TARGET_CLASSES))
  })

  it('reports best times and visible windows on the half hour', async () => {
    const got = await buildTonight(BIG_BEND, {}, NOW)
    const targets = Object.values(got.instruments).flat()
    expect(targets.length).toBeGreaterThan(5)
    for (const t of targets) {
      for (const iso of [t.bestTime, t.window.start, t.window.end]) expect(iso.slice(14, 19)).toMatch(/^(00|30):00$/)
    }
  })

  it('matches astro-cli at 22:30 (instant mode)', async () => {
    const got = await buildTonight(BIG_BEND, { at: '22:30' }, NOW)
    const want = tonight.instant
    expect(got.errors).toEqual([])
    expect(got.mode).toBe('instant')
    expect(got.at).toEqual(want.at)
    expect(got.weather).toEqual(want.weather)
    expectTwilight(got.twilight, want.twilight)
    expectPlan(got.instruments, want.instruments, { interference: false })
  })

  it('degrades: hourly failure nulls the weather sections but still ranks targets', async () => {
    vi.stubGlobal('fetch', nwsFetch(['hourly']))
    const got = await buildTonight(BIG_BEND, {}, NOW)
    expect(got.weather.summary).toBeNull()
    expect(got.weather.current).not.toBeNull()
    expect(got.errors).toEqual(['weather: NWS 500 Server Error'])
    expect(got.instruments.dob_8inch.length).toBeGreaterThan(0)
    const instant = await buildTonight(BIG_BEND, { at: '22:30' }, NOW)
    expect(instant.weather.atTime).toBeNull()
  })

  it('gives an all-null summary when no hourly period falls in the night window', async () => {
    const got = await buildTonight(BIG_BEND, {}, new Date('2027-01-01T12:00:00Z'))
    expect(got.weather.summary).toEqual({ cloudCoverAvg: null, temperatureF: null, windMphAvg: null,
                                          precipProbAvg: null, rating: null, score: null, reasons: [] })
  })

  it('reports "No stations" when NWS lists no observation stations', async () => {
    const base = nwsFetch()
    vi.stubGlobal('fetch', vi.fn(async (url) => (String(url).endsWith('/stations')
      ? { ok: true, status: 200, json: async () => ({ features: [] }) } : base(url))))
    const got = await buildTonight(BIG_BEND, {}, NOW)
    expect(got.weather.current).toEqual({ cloudCover: null, temperatureF: null, windMph: null,
                                          description: 'No stations', station: null, timestamp: null })
    expect(got.errors).toEqual([])
  })

  it('fills a missing elevation from the gridpoint', async () => {
    const got = await buildTonight({ ...BIG_BEND, elevationM: null }, {}, NOW)
    expect(got.location.elevationM).toBe(Math.round(grid.properties.elevation.value))
  })

  it('rejects a malformed time and unknown classes with a readable error', async () => {
    await expect(buildTonight(BIG_BEND, { at: '25:00' }, NOW)).rejects.toThrow("Invalid time '25:00'")
    await expect(buildTonight(BIG_BEND, { include: ['planet', 'comet'] }, NOW)).rejects.toThrow('Unknown target class')
  })

  it('treats an empty include like no filter, and a filter as a filter', async () => {
    expect((await buildTonight(BIG_BEND, { include: [] }, NOW)).instruments.dwarf_mini.length).toBeGreaterThan(0)
    const only = await buildTonight(BIG_BEND, { include: ['cluster'] }, NOW)
    expect(only.instruments.dob_8inch).toEqual([])
    expect(new Set(only.instruments.dwarf_mini.map((t) => t.targetClass))).toEqual(new Set(['cluster']))
  })
})

describe('weather cache across views', () => {
  afterEach(() => vi.useRealTimers())

  it('reuses one set of NWS responses and stamps every view with when they were fetched', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'))
    clearWeatherCache()
    const NOW = new Date('2026-10-03T15:00:00-05:00')
    const first = await buildTonight(BIG_BEND, {}, NOW)
    expect(fetch).toHaveBeenCalledTimes(5) // points, hourly, grid, stations, observation

    vi.setSystemTime(new Date('2026-10-03T16:00:00Z')) // an hour later, e.g. after a chip click
    const again = await buildTonight(BIG_BEND, { include: ['planet'] }, NOW)
    const forecast = await buildForecast(BIG_BEND, { date: '2026-10-03' }, NOW)
    expect(fetch).toHaveBeenCalledTimes(5)
    const outlook = await buildOutlook(BIG_BEND)
    expect(fetch).toHaveBeenCalledTimes(6) // only the 12-hour forecast is new

    for (const r of [first, again, forecast, outlook]) expect(r.generatedAt).toBe('2026-10-03T12:00:00.000Z')
  })
})
