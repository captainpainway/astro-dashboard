import { describe, expect, it } from 'vitest'
import * as Astronomy from 'astronomy-engine'
import { subsolarPoint } from '../src/engine/lunar'
import altaz from './fixtures/altaz.json'
import rating from './fixtures/rating.json'
import twilight from './fixtures/twilight.json'
import horizons from './fixtures/lunar-horizons.json'
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

describe('astronomy-engine vs skyfield (altaz fixture)', () => {
  // Topocentric apparent alt/az, no refraction, matching astro-cli.
  it.each(altaz.cases)('sun and moon within 0.01° at $utc', ({ site, utc, bodies }) => {
    const obs = new Astronomy.Observer(site.lat, site.lon, site.elevationM)
    for (const [name, body] of [['sun', Astronomy.Body.Sun], ['moon', Astronomy.Body.Moon]]) {
      const eq = Astronomy.Equator(body, new Date(utc), obs, true, true)
      const hor = Astronomy.Horizon(new Date(utc), obs, eq.ra, eq.dec)
      expect(Math.abs(hor.altitude - bodies[name].alt)).toBeLessThan(0.01)
      expect(Math.abs(angleDiff(hor.azimuth, bodies[name].az))).toBeLessThan(0.01)
    }
  })
})

describe('subsolarPoint vs JPL Horizons', () => {
  it.each(horizons.cases)('within 0.01° at $utc', ({ utc, sunLon, sunLat }) => {
    const p = subsolarPoint(new Date(utc))
    expect(Math.abs(angleDiff(p.lon, sunLon))).toBeLessThan(0.01)
    expect(Math.abs(p.lat - sunLat)).toBeLessThan(0.01)
  })
})
