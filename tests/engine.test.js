import { describe, expect, it } from 'vitest'
import { buildLunar, reliefScore, subsolarPoint, sunAltitudeAt } from '../src/engine/lunar'
import { rateConditions } from '../src/engine/rating'
import { altaz as engineAltaz, observerFor, twilightEvents } from '../src/engine/astro'
import { BIG_BEND, expectPlan, expectTwilight } from './parity'
import { generatePlan, timeGrid } from '../src/engine/scoring'
import altaz from './fixtures/altaz.json'
import rating from './fixtures/rating.json'
import twilight from './fixtures/twilight.json'
import horizons from './fixtures/lunar-horizons.json'
import tonight from './fixtures/tonight-expected.json'
import lunar from '../src/engine/lunar.json'
import points from './fixtures/nws-points.json'
import grid from './fixtures/nws-forecastGridData.json'
import forecast from './fixtures/nws-forecast.json'
import hourly from './fixtures/nws-forecastHourly.json'

// Signed difference a - b wrapped into [-180, 180).
const angleDiff = (a, b) => ((a - b + 540) % 360) - 180

describe('fixtures', () => {
  it('load with the expected shapes', () => {
    expect(rating.cases.length).toBeGreaterThan(100)
    expect(twilight.cases).toHaveLength(9)
    expect(altaz.cases[0].bodies.moon).toBeDefined()
    expect(points.properties.timeZone).toBe('America/Chicago')
    expect(grid.properties.skyCover.values.length).toBeGreaterThan(0)
    expect(forecast.properties.periods.length).toBeGreaterThan(0)
    expect(hourly.properties.periods.length).toBeGreaterThan(0)
  })
})

describe('astro.js vs skyfield (altaz fixture)', () => {
  // Topocentric apparent alt/az, no refraction, matching astro-cli.
  it.each(altaz.cases)('bodies within 0.05° at $utc', ({ site, utc, bodies }) => {
    const obs = observerFor({ latitude: site.lat, longitude: site.lon, elevationM: site.elevationM })
    for (const [name, want] of Object.entries(bodies)) {
      const got = engineAltaz(name, new Date(utc), obs)
      expect(Math.abs(got.alt - want.alt), `${name} alt`).toBeLessThan(0.05)
      expect(Math.abs(angleDiff(got.az, want.az)), `${name} az`).toBeLessThan(0.05)
    }
  })
})

describe('rateConditions vs astro-cli', () => {
  it('matches every rating fixture case exactly', () => {
    for (const { in: i, out } of rating.cases) {
      expect(rateConditions(i.cloud, i.wind, i.tempF, i.precipProb), JSON.stringify(i)).toEqual(out)
    }
  })
})

describe('twilightEvents vs skyfield', () => {
  const camel = (k) => (k === 'date_local' ? 'date' : k.replace(/_(\w)/g, (_, c) => c.toUpperCase()))
  it.each(twilight.cases)('$site.name $date within 2 minutes', ({ site, date, events }) => {
    const loc = { latitude: site.lat, longitude: site.lon, elevationM: site.elevationM, timezone: site.tz }
    const want = Object.fromEntries(Object.entries(events).map(([k, v]) => [camel(k), v]))
    expectTwilight(twilightEvents(loc, date), want)
  })
})

describe('subsolarPoint vs JPL Horizons', () => {
  it.each(horizons.cases)('within 0.01° at $utc', ({ utc, sunLon, sunLat }) => {
    const p = subsolarPoint(new Date(utc))
    expect(Math.abs(angleDiff(p.lon, sunLon))).toBeLessThan(0.01)
    expect(Math.abs(p.lat - sunLat)).toBeLessThan(0.01)
  })
})

describe('generatePlan vs astro-cli', () => {
  const grid = (night) => timeGrid(new Date(night.startUtc), new Date(night.endUtc))
  const moonNote = (plan) => plan.dob_8inch.find((t) => t.id === 'Moon')?.notes

  it('ranks the night of 2026-10-03 like astro-cli (window mode)', () => {
    const { night, instruments } = tonight.window
    expectPlan(generatePlan(BIG_BEND, grid(night)), instruments)
  })

  it('ranks the sky at 22:30 like astro-cli (instant mode)', () => {
    const at = new Date(tonight.instant.at.utc)
    expectPlan(generatePlan(BIG_BEND, [at]), tonight.instant.instruments, { interference: false })
  })

  it('honours the class filter and puts planets/moon only in the Dobsonian list', () => {
    const plan = generatePlan(BIG_BEND, grid(tonight.window.night), ['planet'])
    expect(plan.dwarf_mini).toEqual([])
    expect(plan.dob_8inch.length).toBeGreaterThan(0)
    expect(new Set(plan.dob_8inch.map((t) => t.targetClass))).toEqual(new Set(['planet']))
  })

  it('returns empty lists, not an error, when nothing clears 15° (Utqiagvik in polar winter)', () => {
    const loc = { latitude: 71.29, longitude: -156.79, elevationM: 10, timezone: 'America/Anchorage' }
    const plan = generatePlan(loc, grid(tonight.window.night), ['planet'])
    expect(Array.isArray(plan.dob_8inch)).toBe(true)
    expect(plan.dwarf_mini).toEqual([])
  })

  it('labels the Moon waning after full and waxing before it (astro-cli says "Waxing" for both)', () => {
    const night = (startUtc) => timeGrid(new Date(startUtc), new Date(Date.parse(startUtc) + 8 * 3_600_000))
    expect(moonNote(generatePlan(BIG_BEND, night('2026-10-04T02:00:00Z'), ['moon']))).toMatch(/^(Last Quarter|Waning) /)
    expect(moonNote(generatePlan(BIG_BEND, night('2026-10-18T02:00:00Z'), ['moon']))).toMatch(/^(First Quarter|Waxing) /)
  })
})

describe('lunar.json', () => {
  const places = lunar.filter((f) => f.kind === 'place')
  const at = (id) => lunar.find((f) => f.id === id)

  it('has the 108 AL checklist rows (91 places, 17 phase rows) split 26/46/36 by tier', () => {
    expect(lunar).toHaveLength(108)
    expect(places).toHaveLength(91)
    const tier = (t) => lunar.filter((f) => f.tier === t).length
    expect([tier('eyes'), tier('binoculars'), tier('telescope')]).toEqual([26, 46, 36])
    expect(new Set(lunar.map((f) => f.id)).size).toBe(108)
  })

  it('keeps places on the near side with coordinates matching published values', () => {
    for (const f of places) {
      expect(Math.abs(f.lat), f.id).toBeLessThanOrEqual(90)
      expect(Math.abs(f.lon), f.id).toBeLessThanOrEqual(80)
    }
    // Published centre coordinates (Wikipedia/IAU), within 0.5°.
    for (const [id, lat, lon] of [['tycho', -43.31, -11.36], ['copernicus', 9.62, -20.08], ['plato', 51.62, -9.38],
                                  ['aristarchus', 23.73, -47.49], ['kepler', 8.12, -38.01]]) {
      expect(Math.abs(at(id).lat - lat), `${id} lat`).toBeLessThan(0.5)
      expect(Math.abs(at(id).lon - lon), `${id} lon`).toBeLessThan(0.5)
    }
  })

  it('gives the hand-resolved rows their parent coordinates', () => {
    expect(at('petavius-wall')).toMatchObject({ lat: at('petavius').lat, lon: at('petavius').lon })
    expect(at('clavius-craterlets')).toMatchObject({ lat: at('clavius').lat, lon: at('clavius').lon })
    expect(at('lunar-rays')).toMatchObject({ kind: 'phase', when: 'full' })
  })
})

describe('lunar geometry', () => {
  it('computes the Sun altitude at a point from the subsolar point', () => {
    expect(sunAltitudeAt({ lat: 10, lon: 20 }, { lat: 10, lon: 20 })).toBeCloseTo(90, 4)
    expect(sunAltitudeAt({ lat: 0, lon: 90 }, { lat: 0, lon: 0 })).toBeCloseTo(0, 4)
    expect(sunAltitudeAt({ lat: 0, lon: 180 }, { lat: 0, lon: 0 })).toBeCloseTo(-90, 4)
    expect(sunAltitudeAt({ lat: 45, lon: 0 }, { lat: 0, lon: 0 })).toBeCloseTo(45, 4)
  })

  it('never returns NaN when rounding pushes the sine just past 1 (Sun directly overhead)', () => {
    const p = { lat: -61.129999999999825, lon: 5 }
    expect(sunAltitudeAt(p, p)).toBeCloseTo(90, 4)
  })

  it('scores low-Sun relief best, shadow zero, and full-Moon features by high Sun', () => {
    const relief = (h) => reliefScore(h, false)
    expect([-5, 0].map(relief)).toEqual([0, 0])
    expect(relief(1.5)).toBeCloseTo(50)
    expect([3, 8, 15].map(relief)).toEqual([100, 100, 100])
    expect(relief(27.5)).toBeCloseTo(50)
    expect(relief(40)).toBe(0)
    expect(reliefScore(22.5, true)).toBeCloseTo(50)
    expect(reliefScore(60, true)).toBe(100)
    expect(reliefScore(-3, true)).toBe(0)
  })
})

describe('buildLunar (places)', () => {
  const night = (iso) => buildLunar(BIG_BEND, new Date(iso))
  const rowOf = (id) => lunar.find((f) => f.id === id)
  const sorted = (r) => expect(r.features.map((f) => f.score)).toEqual(r.features.map((f) => f.score).sort((a, b) => b - a))

  it('first-quarter night: terminator features lead (Sun just up on the eastern half)', () => {
    const r = night('2026-10-17T15:00:00-05:00')
    expect(r.moon.waxing).toBe(true)
    expect(r.moon.maxAlt).toBeGreaterThan(10)
    expect(r.features.slice(0, 8).every((f) => f.sunAlt > 0 && f.sunAlt < 20)).toBe(true)
    expect(r.features.slice(0, 10).map((f) => f.name)).toContain('Aristoteles')
    expect(r.features[0].reason).toMatch(/^terminator, Sun \d+°$/)
    sorted(r)
  })

  it('last-quarter side: the western (negative longitude) features lead', () => {
    const r = night('2026-10-03T15:00:00-05:00')
    expect(r.moon.waxing).toBe(false)
    expect(r.features.slice(0, 5).every((f) => rowOf(f.id).lon < 0)).toBe(true)
  })

  it('full Moon: a "~14 days old" feature leads on its high Sun, with a full-Moon reason', () => {
    const r = night('2026-10-24T15:00:00-05:00')
    expect(r.features[0].name).toBe('Kepler')
    expect(r.features[0].sunAlt).toBeGreaterThan(30)
    expect(r.features[0].reason).toMatch(/high Sun/)
  })

  it('new Moon: nothing is listed and the Moon never clears 10°', () => {
    const r = night('2026-10-10T15:00:00-05:00')
    expect(r.features).toEqual([])
    expect(r.moon.maxAlt).toBeLessThan(10)
  })

  it('returns the response envelope with the night window and a Moon summary', () => {
    const r = night('2026-10-17T15:00:00-05:00')
    expect(r.night).toMatchObject({ startLocal: '2026-10-17T21:00:00-05:00', endLocal: '2026-10-18T05:00:00-05:00',
                                    timezone: 'America/Chicago' })
    expect(r.errors).toEqual([])
    expect(r.moon.note).toMatch(/\(\d+% illuminated\)$/)
    expect(r.location).toEqual(BIG_BEND)
  })

  it('works without an elevation and across the fall-back night (9 real hours)', () => {
    const r = buildLunar({ ...BIG_BEND, elevationM: null }, new Date('2026-10-31T15:00:00-05:00'))
    expect(r.night.endUtc).toBe('2026-11-01T11:00:00+00:00')
    expect(r.features.every((f) => Number.isFinite(f.score))).toBe(true)
    sorted(r)
  })
})

describe('buildLunar (phase rows)', () => {
  const names = (r) => r.features.filter((f) => f.kind === 'phase').map((f) => f.name)

  it('full Moon: the "when full" folklore rows and Lunar Rays appear, the gibbous-only cow does not', () => {
    const r = buildLunar(BIG_BEND, new Date('2026-10-24T15:00:00-05:00'))
    expect(names(r)).toContain('Man in the Moon')
    expect(names(r)).toContain('Lunar Rays')
    expect(names(r)).not.toContain('Cow Jumping Over the Moon')
    expect(names(r)).toHaveLength(12)
    expect(r.features.find((f) => f.name === 'Man in the Moon')).toMatchObject({ tier: 'eyes', score: 50, sunAlt: null })
  })

  it('gibbous Moon: the cow appears, full-only rows do not', () => {
    const r = buildLunar(BIG_BEND, new Date('2026-10-21T15:00:00-05:00'))
    expect(names(r)).toContain('Cow Jumping Over the Moon')
    expect(names(r)).not.toContain('Man in the Moon')
  })

  it('1.3 days after new: waxing crescent and both "Arms" rows, not the waning crescent', () => {
    const r = buildLunar(BIG_BEND, new Date('2026-10-11T15:00:00-05:00'))
    expect(names(r)).toEqual(expect.arrayContaining(['Crescent Moon, Waxing', "Old Moon in New Moon's Arms", "New Moon in Old Moon's Arms"]))
    expect(names(r)).not.toContain('Crescent Moon, Waning')
    expect(r.features.find((f) => f.name === 'Crescent Moon, Waxing').reason).toMatch(/evening crescent, Moon \d+°/)
  })

  it('1.5 days before new: waning crescent in the morning twilight', () => {
    const r = buildLunar(BIG_BEND, new Date('2026-10-08T15:00:00-05:00'))
    expect(names(r)).toEqual(expect.arrayContaining(['Crescent Moon, Waning', "Old Moon in New Moon's Arms"]))
    expect(names(r)).not.toContain('Crescent Moon, Waxing')
  })

  it('new Moon night has no phase rows either (Moon not up in twilight)', () => {
    expect(buildLunar(BIG_BEND, new Date('2026-10-10T15:00:00-05:00')).features).toEqual([])
  })

  it('skips twilight-based rows where there is no dusk or dawn (Utqiagvik, polar night)', () => {
    const loc = { name: 'Utqiagvik, AK', latitude: 71.29, longitude: -156.79, elevationM: 10, timezone: 'America/Anchorage' }
    const r = buildLunar(loc, new Date('2026-12-21T12:00:00-09:00'))
    expect(Array.isArray(r.features)).toBe(true)
    expect(names(r)).not.toContain('Crescent Moon, Waxing')
  })
})
