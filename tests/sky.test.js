import { describe, expect, it } from 'vitest'
import sky from '../src/engine/sky.json'
import expected from './fixtures/tonight-expected.json'
import { altaz, observerFor, starAltAz, twilightEvents } from '../src/engine/astro'
import { toLocalIso } from '../src/engine/time'
import {
  DEEP_SKY, allTargets, altAzOf, eclipticLine, entryHorizon, searchIndex, searchSky, gridLines, meridianLine, camera, filterTargets, playStep, stepTime, darkness, edgeMarker, fieldOfView, horizonVector, introEnd, moonPath, nightRange, rotate, skyAt,
  starLimit, targetHorizon, targetVector, terrainSeed, topTargets, turnTarget, unitVector,
} from '../src/engine/sky'

const BIG_BEND = { name: 'Big Bend', latitude: 29.33, longitude: -103.21, elevationM: 1111, timezone: 'America/Chicago' }
const NIGHT = new Date('2026-10-06T05:00:00Z') // 00:00 CDT
const DAY = new Date('2026-10-05T18:00:00Z') // 13:00 CDT
const near = (a, b, tol) => expect(Math.abs(a - b)).toBeLessThan(tol)
const azNear = (a, b, tol) => expect(Math.abs(((a - b + 540) % 360) - 180)).toBeLessThan(tol)

describe('sky frame', () => {
  it('puts Polaris at the site latitude, due north', () => {
    const [ra, dec] = sky.stars.find(([, d]) => d > 89)
    const { alt, az } = altAzOf(rotate(skyAt(BIG_BEND, NIGHT).rot, unitVector(ra, dec)))
    near(alt, 29.33, 1)
    azNear(az, 0, 2)
  })

  it('agrees with starAltAz (precession and nutation included) for M42', () => {
    const got = altAzOf(rotate(skyAt(BIG_BEND, NIGHT).rot, unitVector(5.5883, -5.39)))
    const want = starAltAz(5.5883, -5.39, NIGHT, observerFor(BIG_BEND))
    near(got.alt, want.alt, 0.05)
    azNear(got.az, want.az, 0.05)
  })

  it('has the Sun at -0.83° at astro.js sunset', () => {
    const { sunset } = twilightEvents(BIG_BEND, '2026-10-05')
    near(skyAt(BIG_BEND, new Date(sunset)).sun.alt, -0.83, 0.2)
  })

  it('lists the planets by display name with altaz positions', () => {
    const uranus = skyAt(BIG_BEND, NIGHT).planets.find((p) => p.id === 'Uranus')
    expect(uranus).toEqual({ id: 'Uranus', ...altaz('uranus', NIGHT, observerFor(BIG_BEND)) })
  })

  it('is fully dark at midnight with the Moon down, and not yet dark at sunset', () => {
    const midnight = skyAt(BIG_BEND, NIGHT)
    expect(darkness(midnight)).toBe(1)
    expect(starLimit(midnight)).toBe(5) // the Moon is below the horizon then
    const { sunset } = twilightEvents(BIG_BEND, '2026-10-05')
    expect(darkness(skyAt(BIG_BEND, new Date(sunset)))).toBe(0)
  })

  it('round-trips horizon vectors and alt/az', () => {
    const { alt, az } = altAzOf(horizonVector({ alt: 33, az: 250 }))
    near(alt, 33, 1e-9)
    near(az, 250, 1e-9)
  })
})

describe('night range and intro end', () => {
  it('runs from sunset to sunrise of tonight in daytime and during the night', () => {
    const tw = twilightEvents(BIG_BEND, '2026-10-05')
    for (const now of [DAY, NIGHT]) {
      const r = nightRange(BIG_BEND, now)
      expect(r.start.toISOString()).toBe(new Date(tw.sunset).toISOString())
      expect(r.end.toISOString()).toBe(new Date(tw.sunrise).toISOString())
      expect(r.astroDusk.toISOString()).toBe(new Date(tw.astroDusk).toISOString())
    }
  })

  it('ends the intro at the best hour if it is inside the night, else astronomical dusk, else mid-night', () => {
    const r = nightRange(BIG_BEND, DAY)
    expect(introEnd(r, '2026-10-05T23:00:00-05:00').toISOString()).toBe('2026-10-06T04:00:00.000Z')
    expect(introEnd(r, '2026-10-07T23:00:00-05:00')).toBe(r.astroDusk) // a different night's hour
    expect(introEnd(r, null)).toBe(r.astroDusk)
    const noDusk = { ...r, astroDusk: null }
    expect(introEnd(noDusk, null).getTime()).toBe((r.start.getTime() + r.end.getTime()) / 2)
  })

  it('falls back to the 21:00–05:00 window under the midnight sun', () => {
    const utqiagvik = { name: 'Utqiagvik', latitude: 71.29, longitude: -156.79, timezone: 'America/Anchorage' }
    const r = nightRange(utqiagvik, new Date('2026-06-21T20:00:00Z'))
    expect(toLocalIso(r.start, utqiagvik.timezone).slice(11, 16)).toBe('21:00')
    expect(r.end - r.start).toBe(8 * 3_600_000)
    expect(r.astroDusk).toBeNull()
  })

  it('gives a short Alaskan summer night a valid range and a mid-night intro end', () => {
    const fairbanks = { name: 'Fairbanks', latitude: 64.84, longitude: -147.72, timezone: 'America/Anchorage' }
    const r = nightRange(fairbanks, new Date('2026-06-21T20:00:00Z'))
    expect(r.end > r.start).toBe(true)
    expect(r.astroDusk).toBeNull()
    expect(introEnd(r, null).getTime()).toBe((r.start.getTime() + r.end.getTime()) / 2)
  })
})

describe('camera', () => {
  const cam = camera({ yaw: 120, pitch: 25, hfov: 180, width: 1300, height: 500 })

  it('puts the view direction at the centre and inverts its own projection', () => {
    const c = cam.project(cam.fwd)
    near(c.x, 650, 1e-9)
    near(c.y, 250, 1e-9)
    const p = cam.project(cam.unproject(200, 100))
    near(p.x, 200, 1e-6)
    near(p.y, 100, 1e-6)
  })

  it('maps the edge of the field to the edge of the tile, and hides points behind the viewer', () => {
    near(cam.project(horizonVector({ alt: 0, az: 210 })).x, 1300, 1e-6) // 90° right of yaw 120 at the horizon
    expect(cam.project(horizonVector({ alt: 0, az: 300 })).visible).toBe(false)
  })

  it('shows east on the left when facing south', () => {
    const south = camera({ yaw: 180, pitch: 10, hfov: 180, width: 1000, height: 400 })
    expect(south.project(horizonVector({ alt: 10, az: 135 })).x).toBeLessThan(500)
  })

  it('sizes the field from the tile width', () => {
    expect(fieldOfView(1300)).toBe(180)
    expect(fieldOfView(375)).toBe(90)
    near(fieldOfView(1000), 142.857, 0.001)
  })

  it('pins off-screen points to the matching edge with an arrow', () => {
    const south = camera({ yaw: 180, pitch: 25, hfov: 120, width: 1000, height: 400 })
    const east = edgeMarker(horizonVector({ alt: 20, az: 90 }), south)
    expect(east.arrow).toBe('←')
    expect(east.x).toBeCloseTo(28, 6)
    const high = edgeMarker(horizonVector({ alt: 85, az: 180 }), south)
    expect(high.arrow).toBe('↑')
    expect(high.y).toBeCloseTo(28, 6)
  })

  it('turns the short way round and keeps the horizon in sight', () => {
    expect(turnTarget({ yaw: 350, pitch: 40 }, { alt: 10, az: 10 })).toEqual({ yaw: 370, pitch: 25 })
    expect(turnTarget({ yaw: 10, pitch: 40 }, { alt: 54, az: 350 })).toEqual({ yaw: -10, pitch: 54 })
    expect(turnTarget({ yaw: 0, pitch: 25 }, { alt: 60, az: 90 }, 20)).toEqual({ yaw: 90, pitch: 40 })
  })
})

describe('targets', () => {
  it('finds catalogue coordinates for every non-planet, non-Moon target in the tonight fixture', () => {
    for (const mode of ['window', 'instant']) {
      for (const list of Object.values(expected[mode].instruments)) {
        for (const t of list.filter((x) => !['planet', 'moon'].includes(x.targetClass))) {
          expect(targetVector(t.id), t.id).not.toBeNull()
        }
      }
    }
  })

  it('keeps 5 per instrument, merging M45 (in both lists) into one entry with both instruments', () => {
    const top = topTargets(expected.window.instruments)
    expect(top).toHaveLength(9)
    expect(top.filter((t) => t.id === 'M45')).toHaveLength(1)
    expect(top.find((t) => t.id === 'M45').instruments).toEqual(['dob_8inch', 'dwarf_mini'])
  })

  it('skips targets that are not displayable', () => {
    const t = (id, score) => ({ id, score })
    expect(topTargets({ a: [t('M1', 0), t('M2', 10)] }).map((x) => x.id)).toEqual(['M2'])
    expect(topTargets(null)).toEqual([])
  })

  it('places planets from the frame, catalogue targets through the matrix, and unknown ids nowhere', () => {
    const frame = skyAt(BIG_BEND, NIGHT)
    expect(targetHorizon({ id: 'Uranus', targetClass: 'planet' }, frame))
      .toEqual(horizonVector(frame.planets.find((p) => p.id === 'Uranus')))
    expect(targetHorizon({ id: 'Moon', targetClass: 'moon' }, frame)).toEqual(horizonVector(frame.moon))
    expect(targetHorizon({ id: 'M45', targetClass: 'messier' }, frame)).toEqual(rotate(frame.rot, targetVector('M45')))
    expect(targetHorizon({ id: 'nowhere', targetClass: 'messier' }, frame)).toBeNull()
  })

  it('lists every displayable target once, with every instrument and the best score', () => {
    const t = (id, score) => ({ id, name: id, score })
    const all = allTargets({ a: [t('M1', 50), t('M2', 40)], b: [t('M2', 70), t('M3', 0)] })
    expect(all.map((x) => [x.id, x.instruments, x.score])).toEqual([['M1', ['a'], 50], ['M2', ['a', 'b'], 70]])
    expect(allTargets(null)).toEqual([])
  })

  it('filters by instrument and by "above the horizon", best score first', () => {
    const frame = skyAt(BIG_BEND, NIGHT)
    const t = (id, score, instruments) => ({ id, name: id, targetClass: 'messier', score, instruments })
    const list = [t('M42', 40, ['dob_8inch']), t('M45', 95, ['dob_8inch', 'dwarf_mini']), t('nowhere', 30, ['dwarf_mini'])]
    expect(filterTargets(list, {}, frame).map((x) => x.id)).toEqual(['M45', 'M42', 'nowhere'])
    expect(filterTargets(list, { instrument: 'dwarf_mini' }, frame).map((x) => x.id)).toEqual(['M45', 'nowhere'])
    expect(filterTargets(list, { upOnly: true }, frame).map((x) => x.id)).toEqual(['M45']) // M42 is down at midnight
  })
})

describe('drawing helpers', () => {
  it('seeds the ridge from the coordinates', () => {
    const seed = terrainSeed(BIG_BEND)
    expect(seed).toHaveLength(6)
    expect(seed.every((x) => x >= 0 && x < 1)).toBe(true)
    expect(terrainSeed({ latitude: 47.61, longitude: -122.33 })).not.toEqual(seed)
  })

  it('bulges the terminator the right way for crescent and gibbous phases', () => {
    expect(moonPath(0.25, 9)).toBe('M 0 -9 A 9 9 0 0 1 0 9 A 4.5 9 0 0 0 0 -9 Z')
    expect(moonPath(0.75, 9)).toBe('M 0 -9 A 9 9 0 0 1 0 9 A 4.5 9 0 0 1 0 -9 Z')
  })
})

describe('time steps', () => {
  const range = { start: new Date('2026-10-06T00:33:10Z'), end: new Date('2026-10-06T12:21:40Z') }
  const start = range.start.getTime()

  it('plays forward and stops at the end of the night', () => {
    expect(playStep(start, range, 60_000)).toEqual({ time: start + 60_000, done: false })
    expect(playStep(range.end.getTime() - 1000, range, 60_000)).toEqual({ time: range.end.getTime(), done: true })
  })

  it("steps on the scrubber's 5-minute grid from sunset, inside the night", () => {
    expect(stepTime(start + 7 * 60_000, range, 3_600_000)).toBe(start + 65 * 60_000)
    expect(stepTime(start + 30 * 60_000, range, -3_600_000)).toBe(start)
    expect(stepTime(range.end.getTime() - 60_000, range, 3_600_000)).toBe(range.end.getTime())
  })
})

describe('line layers and catalogues', () => {
  const unit = (v) => near(Math.hypot(...v), 1, 1e-9)

  it('draws the ecliptic as a closed J2000 circle through the equinox, tilted 23.44°', () => {
    const segs = eclipticLine()
    expect(segs).toHaveLength(180)
    const pole = [0, -Math.sin(23.4393 * Math.PI / 180), Math.cos(23.4393 * Math.PI / 180)]
    for (const [a] of segs) {
      unit(a)
      near(a[0] * pole[0] + a[1] * pole[1] + a[2] * pole[2], 0, 1e-9)
    }
    expect(segs[0][0]).toEqual([1, 0, 0])
  })

  it('grids the horizon frame every 15° of altitude and 30° of azimuth', () => {
    const segs = gridLines()
    expect(segs).toHaveLength(5 * 120 + 12 * 29)
    segs.forEach(([a, b]) => { unit(a); unit(b) })
    near(altAzOf(segs[2 * 120][0]).alt, 45, 1e-9) // the third circle
  })

  it('runs the meridian from the north horizon over the zenith to the south horizon', () => {
    const segs = meridianLine()
    expect(segs).toHaveLength(90)
    segs.forEach(([a]) => near(a[1], 0, 1e-9)) // no east–west component
    const [n, s] = [segs[0][0], segs.at(-1)[1]] // compared with near(): the vectors carry -0 components
    ;[[n, [1, 0, 0]], [s, [-1, 0, 0]]].forEach(([v, want]) => v.forEach((x, i) => near(x, want[i], 1e-9)))
  })

  it('merges Messier and NGC objects, keeping the common names', () => {
    expect(DEEP_SKY).toHaveLength(125)
    expect(new Set(DEEP_SKY.map((o) => o.id)).size).toBe(125)
    expect(DEEP_SKY.find((o) => o.id === 'M45').name).toBe('Pleiades')
    expect(DEEP_SKY.find((o) => o.id === 'M1').name).toBe('M1')
  })

  it('names 216 stars down to magnitude 3.5', () => {
    expect(sky.starNames).toHaveLength(216)
    expect(sky.starNames.every(([, , , mag]) => mag <= 3.5)).toBe(true)
    expect(sky.starNames.map(([name]) => name)).toEqual(expect.arrayContaining(['Polaris', 'Vega', 'Acrux']))
  })
})

describe('search', () => {
  const index = searchIndex({ dob_8inch: [
    { id: 'M45', name: 'Pleiades', targetClass: 'messier', score: 90 },
    { id: 'Saturn', name: 'Saturn', targetClass: 'planet', score: 60 },
  ] })

  it('finds ids with or without spaces, once each, and names by word prefix', () => {
    expect(searchSky(index, 'm 45')[0]).toMatchObject({ id: 'M45', kind: 'target' })
    expect(searchSky(index, 'M45').filter((e) => e.id === 'M45')).toHaveLength(1)
    expect(searchSky(index, 'veil').map((e) => e.name)).toEqual(['Veil Nebula (Eastern)', 'Veil Nebula (Western)'])
  })

  it("finds catalogue objects and tonight's unnamed Messier targets by common name and NGC number", () => {
    // Tonight's Messier rows are named by id (M45), but the catalogue knows them as the Pleiades, NGC 224, ...
    const plain = searchIndex({ dob_8inch: [{ id: 'M45', name: 'M45', targetClass: 'messier', score: 90 },
                                            { id: 'M31', name: 'M31', targetClass: 'messier', score: 80 }] })
    expect(searchSky(plain, 'pleiades')[0]).toMatchObject({ id: 'M45', name: 'Pleiades', kind: 'target' })
    expect(searchSky(plain, 'andromeda galaxy')[0]).toMatchObject({ id: 'M31', kind: 'target' }) // an alias, not its name
    expect(searchSky(plain, 'NGC 224')[0]).toMatchObject({ id: 'M31', kind: 'target' })
    expect(searchSky(plain, 'whirlpool')[0]).toMatchObject({ id: 'M51', kind: 'deep-sky' })
    expect(searchSky(plain, 'ngc5194')[0]).toMatchObject({ id: 'M51', kind: 'deep-sky' })
    expect(searchSky(plain, "bode's")[0]).toMatchObject({ id: 'M81', kind: 'deep-sky' })
  })

  it("puts exact matches first, then tonight's targets", () => {
    expect(searchSky(index, 'orion')[0]).toMatchObject({ name: 'Orion', kind: 'constellation' })
    expect(searchSky(index, 'sat')[0]).toMatchObject({ id: 'Saturn', kind: 'target' })
  })

  it('finds both halves of Serpens, which share one abbreviation', () => {
    const halves = searchSky(index, 'serpens').filter((e) => e.kind === 'constellation').map((e) => e.name)
    expect(halves.sort()).toEqual(['Serpens Caput', 'Serpens Cauda'])
  })

  it('finds named stars and the Moon', () => {
    expect(searchSky(index, 'vega')[0]).toMatchObject({ name: 'Vega', kind: 'star' })
    expect(searchSky(index, 'MOON')[0]).toMatchObject({ kind: 'moon' })
  })

  it('returns nothing for empty, blank or unmatched queries, never throws, and returns at most 8', () => {
    expect(searchSky(index, '')).toEqual([])
    expect(searchSky(index, '   ')).toEqual([])
    expect(searchSky(index, 'zzzz')).toEqual([])
    expect(Array.isArray(searchSky(index, '(*'))).toBe(true)
    expect(searchSky(index, 'm')).toHaveLength(8)
  })

  it('places entries in the frame like the rest of the sky', () => {
    const frame = skyAt(BIG_BEND, NIGHT)
    const vega = searchSky(index, 'vega')[0]
    expect(entryHorizon(vega, frame)).toEqual(rotate(frame.rot, vega.v))
    const saturn = searchSky(index, 'saturn')[0]
    expect(entryHorizon(saturn, frame)).toEqual(targetHorizon(saturn.target, frame))
    expect(entryHorizon(searchSky(index, 'moon')[0], frame)).toEqual(horizonVector(frame.moon))
  })
})
