import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { DEMO_LOCATION, useLocation } from '../src/composables/useLocation'
import points from './fixtures/nws-points.json'

const KEY = 'astrodash.location'
const seattle = { name: 'Seattle, WA', latitude: 47.61, longitude: -122.33, elevationM: null, timezone: 'America/Los_Angeles' }

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(() => ({ ok: true, status: 200, json: () => Promise.resolve(points) })))
})
afterEach(() => vi.restoreAllMocks())

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
