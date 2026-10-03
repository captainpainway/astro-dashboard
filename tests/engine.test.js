import { describe, expect, it } from 'vitest'
import { subsolarPoint } from '../src/engine/lunar'
import { rateConditions } from '../src/engine/rating'
import { altaz as engineAltaz, observerFor, twilightEvents } from '../src/engine/astro'
import { BIG_BEND, expectPlan, expectTwilight } from './parity'
import { generatePlan, timeGrid } from '../src/engine/scoring'
import altaz from './fixtures/altaz.json'
import rating from './fixtures/rating.json'
import twilight from './fixtures/twilight.json'
import horizons from './fixtures/lunar-horizons.json'
import tonight from './fixtures/tonight-expected.json'
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
