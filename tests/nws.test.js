import { describe, expect, it, vi, beforeEach } from 'vitest'
import { resolvePoint } from '../src/engine/nws'
import points from './fixtures/nws-points.json'

const respond = (status, body = {}) => ({ ok: status < 400, status, statusText: 'x', json: () => Promise.resolve(body) })

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(() => respond(200, points))) })

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

  it.each([[91, 0], [0, 181], [NaN, 0], ['29', -103]])('rejects invalid coordinates %s,%s without fetching', async (lat, lon) => {
    await expect(resolvePoint(lat, lon)).rejects.toThrow(/latitude/i)
    expect(fetch).not.toHaveBeenCalled()
  })
})
