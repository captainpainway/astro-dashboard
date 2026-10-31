import { Body, Constellation, DefineStar, Equator, HourAngle, Horizon, Illumination, SearchHourAngle,
         SearchRiseSet } from 'astronomy-engine'
import { observerFor } from './astro'
import { toLocalIso } from './time'

// Fixed (catalogue) targets are loaded into this user-defined body just before each search; everything here is
// synchronous, so one slot is enough.
const FIXED = Body.Star1
const FAR_LY = 1000 // any distance well outside the solar system gives the same apparent position
const HALF_DAY = 43_200_000

function bodyOf(t) {
  if (t.targetClass === 'planet') return Body[t.name] ?? null
  if (t.targetClass === 'moon') return Body.Moon
  if (t.raHours == null || t.decDegrees == null) return null
  DefineStar(FIXED, t.raHours, t.decDegrees, FAR_LY)
  return FIXED
}

/**
 * Where a target is at `now`, Stellarium-style: constellation, RA/Dec (J2000 and of date, hours/degrees),
 * hour angle (hours, 0–24), alt/az (degrees, no refraction, like the plan) and magnitude (computed for the
 * Moon and planets, catalogue value otherwise). null for a target with no known position.
 */
export function targetPosition(t, location, now) {
  const body = bodyOf(t)
  if (!body) return null
  const observer = observerFor(location)
  const j2000 = body === FIXED ? { ra: t.raHours, dec: t.decDegrees } : Equator(body, now, observer, false, true)
  const ofDate = Equator(body, now, observer, true, true)
  const { altitude, azimuth } = Horizon(now, observer, ofDate.ra, ofDate.dec)
  return {
    constellation: Constellation(j2000.ra, j2000.dec).name,
    raJ2000: j2000.ra,
    decJ2000: j2000.dec,
    ra: ofDate.ra,
    dec: ofDate.dec,
    hourAngle: HourAngle(body, now, observer),
    alt: altitude,
    az: azimuth,
    magnitude: body === FIXED ? (t.magnitude ?? null) : Illumination(body, now).mag,
  }
}

/**
 * Rise, transit and set (site-local ISO strings) of the pass that's up at the target's best time; rise and set are
 * null for a target that never sets. null for a target with no known position.
 */
export function targetEvents(t, location) {
  const body = bodyOf(t)
  if (!body || !t.bestTime) return null
  const observer = observerFor(location)
  const at = new Date(t.bestTime)
  const iso = (d) => (d ? toLocalIso(d, location.timezone) : null)
  const rise = SearchRiseSet(body, observer, +1, at, -1)?.date ?? null
  const set = SearchRiseSet(body, observer, -1, at, 1)?.date ?? null
  const transit = SearchHourAngle(body, observer, 0, rise ?? new Date(at.getTime() - HALF_DAY), +1).time.date
  return { rise: iso(rise), transit: iso(transit), set: iso(set) }
}

const PLANET_PAGES = { Mercury: 'Mercury (planet)' }

/** English Wikipedia page title for a target; Messier numbers and catalogue ids redirect to the named page. */
export function wikiTitle(t) {
  if (t.targetClass === 'planet') return PLANET_PAGES[t.name] ?? t.name
  if (t.targetClass === 'moon') return 'Moon'
  const m = /^M(\d+)$/.exec(t.id)
  return m ? `Messier ${m[1]}` : t.id
}

// Summaries ship with the app (scripts/fetch-wiki-summaries.mjs) and load on first use: they work offline, and rarely
// read lunar articles no longer wait ~0.5 s on Wikipedia's cache.
let summaries = null

/** The bundled summary of a Wikipedia article as { title, extract, thumbnail, url }, or null when there's none. */
export async function wikiSummary(title) {
  summaries ??= import('./wikiSummaries.json').then((m) => m.default)
  return (await summaries)[title] ?? null
}
