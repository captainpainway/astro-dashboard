import catalogs from './catalogs.json'
import { PLANETS, altaz, moonIllumination, moonIsWaxing, observerFor, starAltAz } from './astro'
import { round1 } from './forecast'
import { toLocalIso } from './time'

const STEP = 15 * 60_000
const MIN_ALT = 15 // degrees; below this a target isn't listed

export const TARGET_CLASSES = ['planet', 'moon', 'variable', 'messier', 'nebula', 'cluster']
// The owner's two instruments (astro-cli config/equipment.yaml), shown to every visitor as-is.
const INSTRUMENTS = { dob_8inch: ['planet', 'moon', 'variable', 'messier'], dwarf_mini: ['nebula', 'cluster'] }
const MOON_PENALISED = new Set(['nebula', 'cluster', 'messier'])
const TYPE_TO_CLASS = {
  open_cluster: 'cluster', globular_cluster: 'cluster', asterism: 'cluster',
  nebula: 'nebula', diffuse_nebula: 'nebula', planetary_nebula: 'nebula', emission_nebula: 'nebula',
  supernova_remnant: 'nebula', spiral_galaxy: 'nebula', elliptical_galaxy: 'nebula',
  irregular_galaxy: 'nebula', lenticular_galaxy: 'nebula',
}
const PHASE_NAMES = ['New Moon', 'Crescent', 'Quarter', 'Gibbous', 'Full Moon']

/** "Waning Gibbous (82% illuminated)": nearest quarter-phase name, direction from the Moon's elongation. */
export function moonNote(date) {
  const phase = moonIllumination(date)
  const i = Math.round(phase * 4)
  const waxing = moonIsWaxing(date)
  const name = i === 2 ? (waxing ? 'First Quarter' : 'Last Quarter')
    : i % 4 === 0 ? PHASE_NAMES[i] : `${waxing ? 'Waxing' : 'Waning'} ${PHASE_NAMES[i]}`
  return `${name} (${(phase * 100).toFixed(0)}% illuminated)`
}

/** 15-minute sample times from `start` to `end`, both inclusive. */
export function timeGrid(start, end) {
  const out = []
  for (let t = start.getTime(); t <= end.getTime(); t += STEP) out.push(new Date(t))
  return out
}

const HALF_HOUR = 30 * 60_000
/** Clock-aligned half-hour sample times within [start, end] (so best times land on :00 and :30). */
export function halfHourGrid(start, end) {
  const out = []
  for (let t = Math.ceil(start / HALF_HOUR) * HALF_HOUR; t <= end; t += HALF_HOUR) out.push(new Date(t))
  return out
}

function toTarget(tz, { id, name, targetClass, score, above, best, moonInterference, notes, facts }) {
  const iso = (s) => toLocalIso(s.t, tz)
  return {
    id, name, targetClass,
    score: round1(score),
    maxAlt: round1(best.alt),
    bestTime: iso(best),
    window: { start: iso(above[0]), end: iso(above.at(-1)) },
    altAtBest: round1(best.alt),
    azAtBest: Math.round(best.az),
    moonInterference: Math.round(moonInterference * 100) / 100,
    notes,
    ...facts, // fixed objects: J2000 position and catalogue facts for the expanded row
  }
}

/**
 * Ranked targets per instrument over the sample `times` (a night grid, or a single instant).
 * Score = peak altitude, minus a moonlight penalty for deep-sky classes, plus magnitude/priority bonuses.
 */
export function generatePlan(location, times, classes = TARGET_CLASSES) {
  const observer = observerFor(location)
  const sample = (at) => times.map((t) => ({ t, ...at(t) }))
  const moonCurve = sample((t) => altaz('moon', t, observer))
  const moonAt = new Map(moonCurve.map((s) => [s.t.getTime(), s.alt]))
  const mid = new Date((times[0].getTime() + times.at(-1).getTime()) / 2)
  const enabled = new Set(classes)

  // 0 = Moon down whenever the target is up, 1 = Moon overhead throughout (altitude-weighted).
  const interference = (curve) => {
    let overlap = 0
    let total = 0
    for (const { t, alt } of curve) {
      if (alt <= 0) continue
      total += alt
      const m = moonAt.get(t.getTime()) ?? 0
      if (m > 0) overlap += alt * (m / 90)
    }
    return total ? overlap / total : 0
  }

  const scored = (curve, make) => {
    const above = curve.filter((s) => s.alt > MIN_ALT)
    if (!above.length) return null
    const best = above.reduce((a, b) => (b.alt > a.alt ? b : a)) // first maximum, like Python's max()
    return { above, best, moonInterference: 0, notes: '', ...make(best) }
  }
  const fixedCurve = (o) => sample((t) => starAltAz(o.raHours, o.decDegrees, t, observer))

  const catalog = (obj, targetClass) => {
    const curve = fixedCurve(obj)
    return scored(curve, (best) => {
      const moonInterference = MOON_PENALISED.has(targetClass) ? interference(curve) : 0
      const bonus = obj.magnitude == null ? 0 : Math.max(0, 8 - obj.magnitude)
      const { raHours, decDegrees, magnitude, type: objectType, sizeArcmin, aliases } = obj
      return { id: obj.id, name: obj.name ?? obj.id, targetClass, notes: obj.notes, moonInterference,
               score: best.alt - moonInterference * 40 + bonus,
               facts: { raHours, decDegrees, magnitude, objectType, sizeArcmin, aliases } }
    })
  }
  const planet = (key) => {
    const name = key[0].toUpperCase() + key.slice(1)
    return scored(sample((t) => altaz(key, t, observer)),
      (best) => ({ id: name, name, targetClass: 'planet', score: best.alt + 10 }))
  }
  const moon = () => scored(moonCurve, (best) => ({
    id: 'Moon', name: 'Moon', targetClass: 'moon', score: best.alt + 5, notes: moonNote(mid),
  }))
  const variable = (star) => (star.raHours == null || star.decDegrees == null ? null : scored(fixedCurve(star), (best) => ({
    id: star.designation, name: star.designation, targetClass: 'variable',
    score: best.alt + (4 - star.priority) * 2,
    facts: { raHours: star.raHours, decDegrees: star.decDegrees },
    notes: star.chartId ? `chart ${star.chartId}${star.notes ? ` — ${star.notes}` : ''}` : star.notes,
  })))
  const ngc = (cls) => catalogs.ngc.filter((o) => (TYPE_TO_CLASS[o.type] ?? o.type) === cls).map((o) => catalog(o, cls))

  const candidates = {
    planet: () => PLANETS.map(planet),
    moon: () => [moon()],
    variable: () => catalogs.watchlist.map(variable),
    messier: () => catalogs.messier.map((o) => catalog(o, 'messier')),
    nebula: () => ngc('nebula'),
    cluster: () => ngc('cluster'),
  }
  return Object.fromEntries(Object.entries(INSTRUMENTS).map(([key, own]) => [key,
    own.filter((c) => enabled.has(c)).flatMap((c) => candidates[c]()).filter(Boolean)
      .sort((a, b) => b.score - a.score).map((r) => toTarget(location.timezone, r))]))
}
