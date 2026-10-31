import catalogs from './catalogs.json'
import { PLANETS, altaz, magnitude, moonIllumination, moonIsWaxing, observerFor, starAltAz } from './astro'
import { round1 } from './forecast'
import { toLocalIso } from './time'

const STEP = 15 * 60_000
const MIN_ALT = 15 // degrees; below this a target isn't listed
// Height counts up to here and no further: past ~60° the view barely improves (airmass ~1.15), so between targets that
// are all well placed, brightness and moonlight decide.
const ALT_CAP = 60
const height = (best) => Math.min(best.alt, ALT_CAP)
/** Brightness bonus, the same for planets and deep-sky objects: 8 − magnitude, never negative (0 when unknown). */
const brightness = (mag) => (mag == null ? 0 : Math.max(0, 8 - mag))
const priorityBonus = (priority) => (4 - priority) * 2 // watchlist variables; priority 1 is the highest
const MOON_BONUS = 5
const BRIGHTEST_PLANET_MAG = -4.9 // Venus at its greatest brilliancy

/**
 * The highest raw score the formula can give: full height plus the largest bonus any class can earn. Raw scores are
 * shown on a fixed 1–100 scale against this, so a score means the same thing every night (a moonlit night reads lower).
 */
export const SCORE_CEILING = ALT_CAP + Math.max(
  brightness(BRIGHTEST_PLANET_MAG),
  ...[...catalogs.messier, ...catalogs.ngc].map((o) => brightness(o.magnitude)),
  priorityBonus(1),
  MOON_BONUS,
)
/** Raw score → 1–100 (0 → 1, the ceiling → 100); 0 or below stays 0 so the target is hidden as before. */
export const normalizeScore = (raw) => (raw > 0 ? Math.min(100, 1 + 99 * raw / SCORE_CEILING) : 0)

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
    score: round1(normalizeScore(score)),
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
 * Score = peak altitude counted up to 60°, then by class: planets + brightness (8 − magnitude at best time); deep-sky
 * + brightness − 40 × moon interference; variables + 2 × (4 − priority); the Moon + 5. Shown on a fixed 1–100 scale
 * (see SCORE_CEILING); 0 for a raw score of 0 or below, which hides the target.
 * (astro-cli scores by full peak altitude with a flat +10 for planets; this deliberately differs.)
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
      const { raHours, decDegrees, magnitude, type: objectType, sizeArcmin, aliases } = obj
      return { id: obj.id, name: obj.name ?? obj.id, targetClass, notes: obj.notes, moonInterference,
               score: height(best) - moonInterference * 40 + brightness(obj.magnitude),
               facts: { raHours, decDegrees, magnitude, objectType, sizeArcmin, aliases } }
    })
  }
  const planet = (key) => {
    const name = key[0].toUpperCase() + key.slice(1)
    return scored(sample((t) => altaz(key, t, observer)),
      (best) => ({ id: name, name, targetClass: 'planet', score: height(best) + brightness(magnitude(key, best.t)) }))
  }
  const moon = () => scored(moonCurve, (best) => ({
    id: 'Moon', name: 'Moon', targetClass: 'moon', score: height(best) + MOON_BONUS, notes: moonNote(mid),
  }))
  const variable = (star) => (star.raHours == null || star.decDegrees == null ? null : scored(fixedCurve(star), (best) => ({
    id: star.designation, name: star.designation, targetClass: 'variable',
    score: height(best) + priorityBonus(star.priority),
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
