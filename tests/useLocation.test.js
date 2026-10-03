import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { DEMO_LOCATION, useLocation } from '../src/composables/useLocation'
import { clearWeatherCache } from '../src/engine/nws'
import points from './fixtures/nws-points.json'

const KEY = 'astrodash.location'
const seattle = { name: 'Seattle, WA', latitude: 47.61, longitude: -122.33, elevationM: null, timezone: 'America/Los_Angeles' }

beforeEach(() => {
  clearWeatherCache()
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(() => ({ ok: true, status: 200, json: () => Promise.resolve(points) })))
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('useLocation', () => {
  it('defaults to the Big Bend demo location', () => {
    expect(useLocation().location.value).toEqual(DEMO_LOCATION)
    expect(DEMO_LOCATION.name).toMatch(/Big Bend/)
  })

  it('uses a stored location, rounded to 2 decimals', () => {
    localStorage.setItem(KEY, JSON.stringify({ ...seattle, latitude: 47.6062, longitude: -122.3321 }))
    expect(useLocation().location.value).toEqual(seattle)
  })

  it.each([
    ['corrupt JSON', '{not json'],
    ['out-of-range latitude', JSON.stringify({ ...seattle, latitude: 123 })],
    ['missing timezone', JSON.stringify({ ...seattle, timezone: undefined })],
  ])('falls back to the demo on %s', (_, raw) => {
    localStorage.setItem(KEY, raw)
    expect(useLocation().location.value).toEqual(DEMO_LOCATION)
  })

  it('falls back to the demo when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect(useLocation().location.value).toEqual(DEMO_LOCATION)
  })

  it('setCoordinates resolves through NWS and saves the result', async () => {
    const { location, setCoordinates } = useLocation()
    await setCoordinates(29.33, -103.21)
    expect(location.value.name).toBe('Study Butte, TX')
    expect(JSON.parse(localStorage.getItem(KEY)).name).toBe('Study Butte, TX')
  })

  it('setCoordinates still updates the location when saving fails', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    const { location, setCoordinates } = useLocation()
    await setCoordinates(29.33, -103.21)
    expect(location.value.name).toBe('Study Butte, TX')
  })

  it('setCoordinates keeps the current location and reports an error NWS does not cover', async () => {
    fetch.mockReturnValue({ ok: false, status: 404, json: () => Promise.resolve({}) })
    const { location, error, setCoordinates } = useLocation()
    await setCoordinates(51.51, -0.13)
    expect(location.value).toEqual(DEMO_LOCATION)
    expect(error.value).toMatch(/US only/)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('reset clears storage and returns to the demo', async () => {
    localStorage.setItem(KEY, JSON.stringify(seattle))
    const { location, reset } = useLocation()
    reset()
    expect(location.value).toEqual(DEMO_LOCATION)
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})

describe('useLocation.locateMe', () => {
  const geo = (impl) => vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: impl } })
  const ok = (latitude, longitude) => (success) => success({ coords: { latitude, longitude } })
  const fail = (code) => (_s, error) => error({ code })

  it('uses the browser position, resolved and rounded like a typed one', async () => {
    geo(ok(29.3312, -103.2079))
    const loc = useLocation()
    await loc.locateMe()
    expect(fetch).toHaveBeenCalledWith('https://api.weather.gov/points/29.33,-103.21')
    expect(loc.location.value).toMatchObject({ latitude: 29.33, longitude: -103.21, timezone: 'America/Chicago' })
    expect(loc.resolving.value).toBe(false)
    expect(JSON.parse(localStorage.getItem(KEY)).latitude).toBe(29.33)
  })

  it.each([[1, /permission was denied/], [2, /position is unavailable/], [3, /timed out/]])(
    'explains geolocation error %s and keeps the current location', async (code, message) => {
      geo(fail(code))
      const loc = useLocation()
      await loc.locateMe()
      expect(loc.error.value).toMatch(message)
      expect(loc.location.value).toEqual(DEMO_LOCATION)
      expect(loc.resolving.value).toBe(false)
      expect(fetch).not.toHaveBeenCalled()
    })

  it('says so when the browser cannot share a location', async () => {
    vi.stubGlobal('navigator', {})
    const loc = useLocation()
    await loc.locateMe()
    expect(loc.error.value).toMatch(/cannot share your location/)
  })

  it('reports a position outside the US as such and keeps the current location', async () => {
    geo(ok(51.51, -0.13))
    fetch.mockReturnValue({ ok: false, status: 404, statusText: 'Not Found', json: () => Promise.resolve({}) })
    const loc = useLocation()
    await loc.locateMe()
    expect(loc.error.value).toMatch(/US only/)
    expect(loc.location.value).toEqual(DEMO_LOCATION)
  })
})

describe('useLocation out-of-order lookups', () => {
  it('keeps the most recent choice even when an earlier lookup finishes last', async () => {
    const pending = {}
    fetch.mockImplementation((url) => new Promise((resolve) => {
      pending[url] = () => resolve({ ok: true, status: 200, json: () => Promise.resolve(points) })
    }))
    const loc = useLocation()
    const first = loc.setCoordinates(47.61, -122.33)
    const second = loc.setCoordinates(25.76, -80.19)
    pending['https://api.weather.gov/points/25.76,-80.19']() // the second resolves first…
    await second
    pending['https://api.weather.gov/points/47.61,-122.33']() // …then the stale first one
    await first
    expect(loc.location.value.latitude).toBe(25.76)
    expect(JSON.parse(localStorage.getItem(KEY)).latitude).toBe(25.76)
    expect(loc.resolving.value).toBe(false)
  })

  it('a reset wins over a lookup that is still in flight', async () => {
    let finish
    fetch.mockImplementation(() => new Promise((resolve) => {
      finish = () => resolve({ ok: true, status: 200, json: () => Promise.resolve(points) })
    }))
    const loc = useLocation()
    const pendingLookup = loc.setCoordinates(47.61, -122.33)
    loc.reset()
    finish()
    await pendingLookup
    expect(loc.location.value).toEqual(DEMO_LOCATION)
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
