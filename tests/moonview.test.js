import { describe, expect, it } from 'vitest'
import { Body, Equator, EquatorFromVector, GeoMoon, RotationAxis, SiderealTime } from 'astronomy-engine'
import { altaz, observerFor } from '../src/engine/astro'
import { moonVisibleTimes, moonView, project, skyRotation, sunVector, viewBasis } from '../src/engine/moonview'
import { subsolarPoint } from '../src/engine/lunar'
import horizons from './fixtures/lunar-horizons.json'

const wrap = (d) => ((d + 540) % 360) - 180
const TOL = 0.1 // degrees; see Step 4 if this has to change

describe('moonView', () => {
  it.each(horizons.cases)('sub-Earth point matches JPL Horizons at $utc', ({ utc, obsLon, obsLat }) => {
    const { earth } = moonView(new Date(utc))
    expect(Math.abs(wrap(earth.lon - obsLon))).toBeLessThan(TOL)
    expect(Math.abs(earth.lat - obsLat)).toBeLessThan(TOL)
  })

  it('reports the same sub-solar point as subsolarPoint', () => {
    const d = new Date('2026-10-25T00:00:00Z')
    expect(moonView(d).sub).toEqual(subsolarPoint(d))
  })
})

describe('project', () => {
  const centred = viewBasis({ lat: 0, lon: 0 })

  it('puts the sub-Earth point at the disc centre, visible', () => {
    const p = project({ lat: 0, lon: 0 }, centred)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(0)
    expect(p.visible).toBe(true)
  })

  it('is north-up and east-right (Mare Crisium side is on the right)', () => {
    const north = project({ lat: 90, lon: 0 }, centred)
    expect([north.x, north.y]).toEqual([expect.closeTo(0), expect.closeTo(1)])
    const east = project({ lat: 0, lon: 90 }, centred)
    expect([east.x, east.y]).toEqual([expect.closeTo(1), expect.closeTo(0)])
    expect(project({ lat: 0, lon: -90 }, centred).x).toBeCloseTo(-1)
  })

  it('hides far-side points', () => {
    expect(project({ lat: 0, lon: 180 }, centred).visible).toBe(false)
    expect(project({ lat: 30, lon: 150 }, centred).visible).toBe(false)
  })

  it('libration tilts the pole into view: north libration shows the north pole, hides the south pole', () => {
    const tilted = viewBasis({ lat: 6.5, lon: 0 })
    const n = project({ lat: 90, lon: 0 }, tilted)
    expect(n.visible).toBe(true)
    expect(n.y).toBeCloseTo(Math.cos(6.5 * Math.PI / 180))
    expect(project({ lat: -90, lon: 0 }, tilted).visible).toBe(false)
  })

  it('shows a waxing Moon lit on the right: sub-solar point projects right of centre on 2026-10-25', () => {
    const { sub, earth } = moonView(new Date('2026-10-25T00:00:00Z'))
    const p = project(sub, viewBasis(earth))
    expect(p.visible).toBe(true)
    expect(p.x).toBeGreaterThan(0.2)
    expect(p.x).toBeLessThan(0.35)
  })
})

describe('sunVector', () => {
  it('is the unit vector toward the point in the body frame', () => {
    expect(sunVector({ lat: 0, lon: 0 })).toEqual([1, 0, 0])
    const [x, y, z] = sunVector({ lat: 0, lon: 90 })
    expect([x, y, z]).toEqual([expect.closeTo(0), 1, expect.closeTo(0)])
  })
})

describe('skyRotation', () => {
  const site = { latitude: 40, longitude: -75, timezone: 'America/New_York' }
  const toRad = Math.PI / 180

  // Independent route: lunar pole's position angle from celestial north, minus the parallactic angle.
  const reference = (date) => {
    const eq = EquatorFromVector(GeoMoon(date))
    const axis = RotationAxis(Body.Moon, date)
    const dRa = (axis.ra - eq.ra) * 15 * toRad
    const dec = eq.dec * toRad
    const pdec = axis.dec * toRad
    const P = Math.atan2(Math.cos(pdec) * Math.sin(dRa), Math.sin(pdec) * Math.cos(dec) - Math.cos(pdec) * Math.sin(dec) * Math.cos(dRa))
    const ofDate = Equator(Body.Moon, date, observerFor(site), true, true)
    const H = (SiderealTime(date) + site.longitude / 15 - ofDate.ra) * 15 * toRad
    const q = Math.atan2(Math.sin(H), Math.tan(site.latitude * toRad) * Math.cos(ofDate.dec * toRad) - Math.sin(ofDate.dec * toRad) * Math.cos(H))
    return P - q
  }
  const wrapRad = (a) => Math.atan2(Math.sin(a), Math.cos(a))

  it.each(['2026-10-03T23:00:00Z', '2026-10-04T02:00:00Z', '2026-10-04T06:00:00Z', '2026-11-12T01:30:00Z'])(
    'matches pole position angle minus parallactic angle at %s',
    (utc) => {
      const d = new Date(utc)
      expect(Math.abs(wrapRad(skyRotation(d, site) - reference(d)))).toBeLessThan(1.5 * toRad)
    })

  it('turns an eastern (rising) Moon counter-clockwise and a western one clockwise, relative to the meridian', () => {
    const rising = new Date('2026-10-03T23:00:00Z')
    const times = moonVisibleTimes(site, rising)
    const [rise, set] = [times[0].date, times.at(-1).date]
    expect(skyRotation(rise, site) - skyRotation(set, site)).toBeGreaterThan(0)
  })
})

describe('moonVisibleTimes', () => {
  const site = { latitude: 40, longitude: -75, timezone: 'America/New_York' }
  const now = new Date('2026-10-03T23:00:00Z')
  const dates = (times) => times.map((t) => t.date)

  it('runs from moonrise to moonset in half-hour steps with the Moon up throughout', () => {
    const times = dates(moonVisibleTimes(site, now))
    expect(times.length).toBeGreaterThan(3)
    times.forEach((t, i) => {
      if (i) expect(t - times[i - 1]).toBeLessThanOrEqual(30 * 60_000)
      expect(altaz('moon', t, observerFor(site)).alt).toBeGreaterThan(-1)
    })
    expect(times.at(-1) - times[0]).toBeLessThan(18 * 3_600_000)
  })

  it('tags only the moonrise and moonset ends', () => {
    const times = moonVisibleTimes(site, now)
    expect(times.map((t) => t.event)).toEqual(['moonrise', ...Array(times.length - 2).fill(null), 'moonset'])
  })

  it('covers the pass under way now, or else the next one', () => {
    const times = dates(moonVisibleTimes(site, now))
    const up = altaz('moon', now, observerFor(site)).alt > 0
    expect(up ? times[0] <= now && now <= times.at(-1) : times[0] > now).toBe(true)
  })

  it('stays inside a window, dropping the rise/set tags the window cuts off', () => {
    const all = dates(moonVisibleTimes(site, now))
    const window = { start: all[2], end: all[5] }
    const times = moonVisibleTimes(site, now, window)
    expect(times.map((t) => t.date.getTime())).toEqual(all.slice(2, 6).map((t) => t.getTime()))
    expect(times.every((t) => t.event === null)).toBe(true)
  })

  it('is empty when the Moon is not up in the window, or never rises or sets', () => {
    const all = dates(moonVisibleTimes(site, now))
    expect(moonVisibleTimes(site, now, { start: new Date(+all.at(-1) + 3_600_000), end: new Date(+all.at(-1) + 7_200_000) })).toEqual([])
    expect(moonVisibleTimes({ latitude: 89.9, longitude: 0, timezone: 'UTC' }, new Date('2026-06-21T00:00:00Z'))).toEqual([])
  })
})
