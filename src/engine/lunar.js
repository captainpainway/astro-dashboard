import { Body, GeoMoon, GeoVector, RotationAxis } from 'astronomy-engine'
import features from './lunar.json'
import { altaz, darkWindow, moonIllumination, moonIsWaxing, moonPhaseAngle, moonWindow, observerFor, twilightEvents } from './astro'
import { round1 } from './forecast'
import { halfHourGrid, moonNote } from './scoring'
import { localDate, toLocalIso, tonightWindow } from './time'

const RAD = Math.PI / 180

const rotZ = (a, [x, y, z]) => [x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a), z]
const rotX = (a, [x, y, z]) => [x, y * Math.cos(a) + z * Math.sin(a), -y * Math.sin(a) + z * Math.cos(a)]

/**
 * Point on the Moon where the Sun is overhead at `date`.
 * Selenographic degrees, east-positive, lon in [-180, 180] (same frame as the
 * USGS gazetteer and JPL Horizons MOON_ME). Colongitude = (90 - lon) mod 360.
 */
export function subsolarPoint(date) {
  const sun = GeoVector(Body.Sun, date, true)
  const moon = GeoMoon(date)
  const v = [sun.x - moon.x, sun.y - moon.y, sun.z - moon.z]
  const n = Math.hypot(...v)
  // J2000 equator -> lunar body frame via the IAU pole (ra, dec) and prime meridian (spin).
  const axis = RotationAxis(Body.Moon, date)
  const [x, y, z] = rotZ(axis.spin * RAD,
    rotX((90 - axis.dec) * RAD, rotZ((90 + axis.ra * 15) * RAD, v.map((c) => c / n))))
  return { lat: Math.asin(z) / RAD, lon: Math.atan2(y, x) / RAD }
}

/** Sun's altitude in degrees at a selenographic point, given the subsolar point (same frame as subsolarPoint). */
export function sunAltitudeAt({ lat, lon }, sub) {
  const s = Math.sin(lat * RAD) * Math.sin(sub.lat * RAD) +
    Math.cos(lat * RAD) * Math.cos(sub.lat * RAD) * Math.cos((lon - sub.lon) * RAD)
  return Math.asin(Math.max(-1, Math.min(1, s))) / RAD // rounding can push s just past ±1
}

const RELIEF_PEAK = 8 // Sun altitude (°) with the longest useful shadows
/**
 * 0-100 for how well the Sun's altitude shows a feature: relief peaks with the Sun 8° up (long shadows) and fades
 * to 0 at the terminator and by 40°; rays and albedo features (`highSun`) reach 90 by a 45° Sun, then creep to 100
 * overhead so they don't tie.
 */
export function reliefScore(sunAlt, highSun) {
  if (sunAlt <= 0) return 0
  if (highSun) return sunAlt < 45 ? (sunAlt / 45) * 90 : 90 + (Math.min(sunAlt, 90) - 45) / 45 * 10
  if (sunAlt < RELIEF_PEAK) return (sunAlt / RELIEF_PEAK) * 100
  return Math.max(0, (40 - sunAlt) / (40 - RELIEF_PEAK)) * 100
}

const MIN_MOON_ALT = 10 // below this the Moon isn't worth observing
const MOON_ALT_CAP = 60 // Moon height counts up to here, like target height on Tonight
const MIN_SCORE = 25 // hide features that are barely lit or barely placed
const DAY_DEG = 360 / 29.530589 // Moon's mean elongation per day
const PHASE_SCORE = 50 // ponytail: fixed mid-list score; rank phase rows by Moon altitude if it matters

const reasonFor = (f, sunAlt) => (f.ageDays === 14 ? `high Sun ${sunAlt.toFixed(0)}° — best near full`
  : sunAlt < 15 ? `terminator, Sun ${sunAlt.toFixed(0)}°` : `Sun ${sunAlt.toFixed(0)}°`)

/** Peak Moon altitude over [from, to] (epoch ms, half-hour marks) at or above `minAlt`, or null. */
function moonPeak(from, to, observer, minAlt) {
  let best = null
  for (const t of halfHourGrid(from, to)) {
    const alt = altaz('moon', t, observer).alt
    if (alt >= minAlt && (!best || alt > best.alt)) best = { t, alt }
  }
  return best
}

/** Client-side lunar planner: AL checklist features ranked for the Moon's next stretch above 10° at `location`. */
export function buildLunar(location, now = new Date()) {
  const tz = location.timezone
  const observer = observerFor(location)
  // Falls back to 21:00-05:00 when the Moon doesn't get above 10° in the next few passes (high latitudes).
  const { start, end } = moonWindow(observer, now, MIN_MOON_ALT) ?? tonightWindow(now, tz)
  const samples = halfHourGrid(start, end).map((t) => ({ t, moonAlt: altaz('moon', t, observer).alt, sub: subsolarPoint(t) }))
  const up = samples.filter((s) => s.moonAlt >= MIN_MOON_ALT)

  // ponytail: libration ignored, so limb features (Crisium, Grimaldi, ...) rank as if face-on; weight by Libration() if it matters.
  const place = (f) => {
    let best = null
    for (const s of up) {
      const sunAlt = sunAltitudeAt(f, s.sub)
      const score = reliefScore(sunAlt, f.ageDays === 14) * (0.5 + 0.5 * Math.min(s.moonAlt / MOON_ALT_CAP, 1))
      if (!best || score > best.score) best = { score, sunAlt, moonAlt: s.moonAlt, t: s.t }
    }
    return best && { id: f.id, name: f.name, tier: f.tier, kind: 'place', type: f.type, ageDays: f.ageDays,
                     lat: f.lat, lon: f.lon, score: round1(best.score), sunAlt: round1(best.sunAlt), moonAlt: round1(best.moonAlt),
                     bestTime: toLocalIso(best.t, tz), reason: reasonFor(f, best.sunAlt) }
  }

  const rows = features.filter((f) => f.kind === 'place').map(place)
    .filter((r) => r && r.score >= MIN_SCORE).sort((a, b) => b.score - a.score)
  // Rows with no place: full/gibbous folklore at the night's highest Moon; crescents low in the twilight.
  const tw = twilightEvents(location, localDate(darkWindow(location, now).start, tz))
  const evening = [tw.sunset, tw.astroDusk]
  const morning = [tw.astroDawn, tw.sunrise]
  const highest = up.reduce((a, b) => (!a || b.moonAlt > a.moonAlt ? b : a), null)

  const phaseRow = (f) => {
    let hit = null
    if (f.when === 'full' || f.when === 'gibbous') {
      const illum = highest && moonIllumination(highest.t)
      const ok = highest && (f.when === 'full' ? illum >= 0.9 : illum >= 0.5 && illum < 0.95)
      if (ok) hit = { t: highest.t, alt: highest.moonAlt, reason: `Moon ${(illum * 100).toFixed(0)}% lit` }
    } else {
      const days = f.when === 'near-new-72' ? 3 : 2
      const sides = []
      if (f.when !== 'waning-new-48') sides.push({ win: evening, label: 'evening', ok: (a) => a > 0 && a <= days * DAY_DEG })
      if (f.when !== 'waxing-new-48') sides.push({ win: morning, label: 'morning', ok: (a) => a >= 360 - days * DAY_DEG })
      for (const { win, label, ok } of sides) {
        if (win.some((x) => !x)) continue // no dusk/dawn at this latitude and date
        const [from, to] = win.map(Date.parse)
        if (!ok(moonPhaseAngle(new Date(from)))) continue
        const peak = moonPeak(from, to, observer, 3)
        if (peak) { hit = { t: peak.t, alt: peak.alt, reason: `${label} crescent, Moon ${peak.alt.toFixed(0)}°` }; break }
      }
    }
    return hit && { id: f.id, name: f.name, tier: f.tier, kind: 'phase', type: null, ageDays: null, score: PHASE_SCORE,
                    sunAlt: null, moonAlt: round1(hit.alt), bestTime: toLocalIso(hit.t, tz), reason: hit.reason }
  }
  const phases = features.filter((f) => f.kind === 'phase').map(phaseRow).filter(Boolean)

  const mid = new Date((start.getTime() + end.getTime()) / 2)
  return {
    generatedAt: new Date().toISOString(),
    location,
    night: { startLocal: toLocalIso(start, tz), endLocal: toLocalIso(end, tz),
             startUtc: toLocalIso(start, 'UTC'), endUtc: toLocalIso(end, 'UTC'), timezone: tz },
    moon: { illum: moonIllumination(mid), waxing: moonIsWaxing(mid),
            maxAlt: round1(Math.max(...samples.map((s) => s.moonAlt))), note: moonNote(mid) },
    features: [...rows, ...phases].sort((a, b) => b.score - a.score),
    errors: [],
  }
}
