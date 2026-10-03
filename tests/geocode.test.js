import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchPlaces } from '../src/engine/geocode'

const respond = (status, body = {}) => ({ ok: status < 400, status, json: () => Promise.resolve(body) })
const austin = { id: 4671654, name: 'Austin', admin1: 'Texas', country_code: 'US', latitude: 30.26715, longitude: -97.74306 }

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(() => respond(200, { results: [austin] }))) })

describe('searchPlaces', () => {
  it('asks the Open-Meteo geocoder for US matches and maps the results', async () => {
    const found = await searchPlaces('  Austin ')
    expect(fetch.mock.calls[0][0]).toBe('https://geocoding-api.open-meteo.com/v1/search?name=Austin&count=8&language=en&format=json&countryCode=US')
    expect(found).toEqual([{ id: 4671654, name: 'Austin', state: 'Texas', latitude: 30.26715, longitude: -97.74306 }])
  })

  it('url-encodes the query, so a ZIP code or a place with spaces passes through intact', async () => {
    await searchPlaces('78701')
    await searchPlaces('Port Angeles')
    expect(fetch.mock.calls[0][0]).toContain('name=78701')
    expect(fetch.mock.calls[1][0]).toContain('name=Port%20Angeles')
  })

  it('sends no request for queries under two characters', async () => {
    expect(await searchPlaces(' a ')).toEqual([])
    expect(await searchPlaces('')).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns an empty list when nothing matches (the response has no results key)', async () => {
    fetch.mockReturnValue(respond(200, { generationtime_ms: 0.4 }))
    expect(await searchPlaces('zzzzqqxx')).toEqual([])
  })

  it('drops non-US results even if the server returns them, and tolerates a missing state', async () => {
    fetch.mockReturnValue(respond(200, { results: [{ ...austin, country_code: 'GB', id: 1 }, { ...austin, admin1: undefined, id: 2 }] }))
    const found = await searchPlaces('Austin')
    expect(found.map((p) => p.id)).toEqual([2])
    expect(found[0].state).toBe('')
  })

  it('reports a failed search with the status', async () => {
    fetch.mockReturnValue(respond(429))
    await expect(searchPlaces('Austin')).rejects.toThrow(/City search failed \(429\)/)
  })
})
