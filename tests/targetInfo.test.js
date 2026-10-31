import { afterEach, describe, expect, it, vi } from 'vitest'
import { BIG_BEND } from './parity'
import { starAltAz, observerFor } from '../src/engine/astro'
import { targetEvents, targetPosition, wikiSummary, wikiTitle } from '../src/engine/targetInfo'

// Lagoon Nebula (M8) as the catalogue has it, best seen at Big Bend in the early evening.
const lagoon = { id: 'M8', name: 'Lagoon Nebula', targetClass: 'messier', raHours: 18.0606, decDegrees: -24.3806,
                 magnitude: 6.0, bestTime: '2026-10-31T19:00:00-05:00' }
const now = new Date('2026-11-01T00:30:00Z')

describe('targetPosition', () => {
  it('places a catalogue target in its constellation with J2000 and of-date coordinates', () => {
    const p = targetPosition(lagoon, BIG_BEND, now)
    expect(p.constellation).toBe('Sagittarius')
    expect([p.raJ2000, p.decJ2000]).toEqual([lagoon.raHours, lagoon.decDegrees])
    // ~26 years of precession moves Sagittarius ~1.7 min of RA east, as Stellarium shows for M8
    expect((p.ra - p.raJ2000) * 60).toBeGreaterThan(1.4)
    expect((p.ra - p.raJ2000) * 60).toBeLessThan(2)
    expect(p.magnitude).toBe(6)
  })

  it('agrees with the plan’s alt/az for the same moment', () => {
    const p = targetPosition(lagoon, BIG_BEND, now)
    const plan = starAltAz(lagoon.raHours, lagoon.decDegrees, now, observerFor(BIG_BEND))
    expect(Math.abs(p.alt - plan.alt)).toBeLessThan(0.05)
    expect(Math.abs(p.az - plan.az)).toBeLessThan(0.05)
  })

  it('computes coordinates and magnitude for planets and the Moon', () => {
    const jupiter = targetPosition({ id: 'Jupiter', name: 'Jupiter', targetClass: 'planet' }, BIG_BEND, now)
    expect(jupiter.magnitude).toBeLessThan(-1.5)
    expect(jupiter.constellation).toMatch(/^[A-Z]/)
    const moon = targetPosition({ id: 'Moon', name: 'Moon', targetClass: 'moon' }, BIG_BEND, now)
    expect(moon.magnitude).toBeLessThan(-5)
  })

  it('is null for a target with no position', () => {
    expect(targetPosition({ id: 'N Tau 2026', name: 'N Tau 2026', targetClass: 'variable' }, BIG_BEND, now)).toBeNull()
  })
})

describe('targetEvents', () => {
  it('rises, transits and sets around its best time, highest at transit', () => {
    const e = targetEvents(lagoon, BIG_BEND)
    const [rise, transit, set] = [e.rise, e.transit, e.set].map((s) => new Date(s))
    expect(rise < new Date(lagoon.bestTime) && new Date(lagoon.bestTime) < set).toBe(true)
    expect(rise < transit && transit < set).toBe(true)
    expect(e.transit.slice(-6)).toBe('-05:00') // site-local
    const ha = targetPosition(lagoon, BIG_BEND, transit).hourAngle
    expect(Math.min(ha, 24 - ha)).toBeLessThan(0.01) // on the meridian (0h, either side of the wrap)
  })

  it('has no rise or set for a target that never sets', () => {
    const e = targetEvents({ ...lagoon, id: 'X', decDegrees: 80 }, BIG_BEND)
    expect([e.rise, e.set]).toEqual([null, null])
    expect(e.transit).toBeTruthy()
  })
})

describe('wikiTitle', () => {
  it.each([
    [{ id: 'M8', name: 'Lagoon Nebula', targetClass: 'nebula' }, 'Messier 8'],
    [{ id: 'NGC 7000', name: 'North America Nebula', targetClass: 'nebula' }, 'NGC 7000'],
    [{ id: 'Mercury', name: 'Mercury', targetClass: 'planet' }, 'Mercury (planet)'],
    [{ id: 'Mars', name: 'Mars', targetClass: 'planet' }, 'Mars'],
    [{ id: 'Moon', name: 'Moon', targetClass: 'moon' }, 'Moon'],
    [{ id: 'SS Cyg', name: 'SS Cyg', targetClass: 'variable' }, 'SS Cyg'],
  ])('%o → %s', (t, title) => expect(wikiTitle(t)).toBe(title))
})

describe('wikiSummary', () => {
  afterEach(() => vi.unstubAllGlobals())
  const respond = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })

  it('returns the extract, thumbnail and page link of a standard page', async () => {
    const fetch = vi.fn(() => respond(200, { type: 'standard', title: 'Lagoon Nebula', extract: 'A giant nebula.',
      thumbnail: { source: 'https://upload.wikimedia.org/x.jpg' },
      content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Lagoon_Nebula' } } }))
    vi.stubGlobal('fetch', fetch)
    expect(await wikiSummary('Messier 8 test')).toEqual({ title: 'Lagoon Nebula', extract: 'A giant nebula.',
      thumbnail: 'https://upload.wikimedia.org/x.jpg', url: 'https://en.wikipedia.org/wiki/Lagoon_Nebula' })
    expect(fetch.mock.calls[0][0]).toBe('https://en.wikipedia.org/api/rest_v1/page/summary/Messier_8_test')
  })

  it('remembers a missing article but retries a failed request', async () => {
    const fetch = vi.fn(() => respond(404, {}))
    vi.stubGlobal('fetch', fetch)
    expect(await wikiSummary('Stock 2 test')).toBeNull()
    expect(await wikiSummary('Stock 2 test')).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)

    fetch.mockImplementation(() => respond(429, {}))
    expect(await wikiSummary('Busy test')).toBeNull()
    expect(await wikiSummary('Busy test')).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('serves bundled lunar summaries without a request, and fetches everything else', async () => {
    const fetch = vi.fn(() => respond(404, {}))
    vi.stubGlobal('fetch', fetch)
    expect(await wikiSummary('Plato (crater)')).toMatchObject({ title: 'Plato (crater)',
      extract: expect.stringMatching(/^Plato is a lava-filled lunar impact crater/), thumbnail: expect.any(String) })
    expect(fetch).not.toHaveBeenCalled()
    await wikiSummary('Not bundled test')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('skips disambiguation pages', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(200, { type: 'disambiguation', title: 'X', extract: 'X may refer to' })))
    expect(await wikiSummary('Ambiguous test')).toBeNull()
  })
})
