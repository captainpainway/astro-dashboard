import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { clearWeatherCache, expandDurationSeries, pointProps, resolvePoint, weatherFetchedAt } from '../src/engine/nws'
import points from './fixtures/nws-points.json'

const respond = (status, body = {}) => ({ ok: status < 400, status, statusText: 'x', json: () => Promise.resolve(body) })

beforeEach(() => {
  clearWeatherCache()
  vi.stubGlobal('fetch', vi.fn(() => respond(200, points)))
})
afterEach(() => vi.useRealTimers())

describe('resolvePoint', () => {
  it('resolves place name and timezone from NWS /points, rounding to 2 decimals', async () => {
    const loc = await resolvePoint(29.3312, -103.2079)
    expect(fetch).toHaveBeenCalledWith('https://api.weather.gov/points/29.33,-103.21')
    expect(loc).toEqual({ name: 'Study Butte, TX', latitude: 29.33, longitude: -103.21,
                          elevationM: null, timezone: 'America/Chicago' })
  })

  it('reports locations NWS does not cover (404) as US-only', async () => {
    fetch.mockReturnValue(respond(404))
    await expect(resolvePoint(51.51, -0.13)).rejects.toThrow(/US only/)
  })

  it('reports other NWS failures with the status', async () => {
    fetch.mockReturnValue(respond(500))
    await expect(resolvePoint(29.33, -103.21)).rejects.toThrow(/500/)
  })

  it('expands ISO-duration series into hourly buckets, including day durations', () => {
    const s = expandDurationSeries([
      { validTime: '2026-10-03T00:00:00+00:00/PT2H', value: 40 },
      { validTime: '2026-10-03T02:00:00+00:00/P1DT1H', value: 90 },
    ])
    expect(s.size).toBe(27)
    expect(s.get(Date.parse('2026-10-03T01:00:00Z'))).toBe(40)
    expect(s.get(Date.parse('2026-10-04T02:00:00Z'))).toBe(90)
  })

  it.each([[91, 0], [0, 181], [NaN, 0], ['29', -103]])('rejects invalid coordinates %s,%s without fetching', async (lat, lon) => {
    await expect(resolvePoint(lat, lon)).rejects.toThrow(/latitude/i)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('weather cache', () => {
  const POINTS = 'https://api.weather.gov/points/29.33,-103.21'

  it('fetches each URL once, sharing one request between concurrent callers and later ones', async () => {
    await Promise.all([pointProps(29.33, -103.21), pointProps(29.33, -103.21)])
    await pointProps(29.33, -103.21)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keys by URL, so another location is fetched separately', async () => {
    await pointProps(29.33, -103.21)
    await pointProps(30.27, -97.74)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('does not cache failures: the next caller refetches', async () => {
    fetch.mockReturnValueOnce(respond(500))
    await expect(pointProps(29.33, -103.21)).rejects.toThrow(/500/)
    await expect(pointProps(29.33, -103.21)).resolves.toBeDefined()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('a plain clear forgets responses but still lets the browser cache answer', async () => {
    await pointProps(29.33, -103.21)
    clearWeatherCache()
    await pointProps(29.33, -103.21)
    expect(fetch.mock.calls).toEqual([[POINTS], [POINTS]])
  })

  it('after a refresh, refetches each URL once past the browser cache, then caches again', async () => {
    await pointProps(29.33, -103.21)
    clearWeatherCache(true)
    await pointProps(29.33, -103.21)
    await pointProps(29.33, -103.21)
    expect(fetch.mock.calls).toEqual([[POINTS], [POINTS, { cache: 'reload' }]])
  })

  it('weatherFetchedAt is when the cache generation began, not now', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'))
    clearWeatherCache()
    vi.setSystemTime(new Date('2026-10-03T15:00:00Z'))
    expect(weatherFetchedAt()).toBe('2026-10-03T12:00:00.000Z')
  })
})
