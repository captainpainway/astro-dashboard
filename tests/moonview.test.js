import { describe, expect, it } from 'vitest'
import { moonView, project, sunVector, viewBasis } from '../src/engine/moonview'
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
