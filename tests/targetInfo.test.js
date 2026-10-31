import { afterEach, describe, expect, it, vi } from 'vitest'
import { BIG_BEND } from './parity'
import { PLANETS, starAltAz, observerFor } from '../src/engine/astro'
import catalogs from '../src/engine/catalogs.json'
import { targetEvents, targetPosition, wikiSummary, wikiTitle } from '../src/engine/targetInfo'
import wikiSummaries from '../src/engine/wikiSummaries.json'

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

  it('serves the bundled summary without asking Wikipedia, and null where there is no article', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(await wikiSummary('Messier 8')).toMatchObject({ title: 'Lagoon Nebula', extract: expect.any(String),
      thumbnail: expect.stringMatching(/^https:\/\//), url: 'https://en.wikipedia.org/wiki/Lagoon_Nebula' })
    expect(await wikiSummary('Plato (crater)')).toMatchObject({
      extract: expect.stringMatching(/^Plato is a lava-filled lunar impact crater/) })
    expect([await wikiSummary('Stock 2'), await wikiSummary('Not in the catalogue')]).toEqual([null, null])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('has an entry for every Tonight target, so scripts/fetch-wiki-summaries.mjs names them as wikiTitle does', () => {
    const targets = [
      ...PLANETS.map((p) => ({ targetClass: 'planet', name: p[0].toUpperCase() + p.slice(1) })),
      { targetClass: 'moon', id: 'Moon' },
      ...[...catalogs.messier, ...catalogs.ngc].map((o) => ({ targetClass: 'messier', id: o.id })),
      ...catalogs.watchlist.map((s) => ({ targetClass: 'variable', id: s.designation })),
    ]
    const missing = targets.map(wikiTitle).filter((title) => !(title in wikiSummaries))
    expect(missing).toEqual([])
  })
})
