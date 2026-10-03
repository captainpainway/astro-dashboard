import { Body, Equator, Horizon, Illumination, Observer, SearchAltitude, SearchRiseSet } from 'astronomy-engine'
import { addDays, toLocalIso, zonedTime } from './time'

const BODIES = { sun: Body.Sun, moon: Body.Moon }
// Sun center at sunrise/sunset (refraction + semidiameter); the day/civil boundary.
const SUNSET_ALT = -0.8333

export const observerFor = (loc) => new Observer(loc.latitude, loc.longitude, loc.elevationM ?? 0)

/** Topocentric apparent altitude in degrees, without refraction (as astro-cli/skyfield). */
export function altitude(body, date, observer) {
  const eq = Equator(BODIES[body], date, observer, true, true)
  return Horizon(date, observer, eq.ra, eq.dec).altitude
}

/** Moon illuminated fraction (0 new, 1 full). */
export const moonIllumination = (date) => Illumination(Body.Moon, date).phase_fraction

/**
 * Sunset/sunrise and twilight boundaries for the night starting on `day` (local
 * noon to noon), in the astro-cli `twilight` shape; a field is null when that
 * boundary doesn't occur.
 */
export function twilightEvents(loc, day) {
  const tz = loc.timezone
  const observer = observerFor(loc)
  const start = zonedTime(day, 12, 0, tz)
  const end = zonedTime(addDays(day, 1), 12, 0, tz)
  const limitDays = (end - start) / 86_400_000
  const iso = (t) => (t && t.date < end ? toLocalIso(t.date, tz) : null)
  const cross = (dir, alt) => iso(SearchAltitude(Body.Sun, observer, dir, start, limitDays, alt))
  const sunset = iso(SearchRiseSet(Body.Sun, observer, -1, start, limitDays))
  const sunrise = iso(SearchRiseSet(Body.Sun, observer, +1, start, limitDays))
  const dayAtNoon = altitude('sun', start, observer) > SUNSET_ALT
  return {
    date: day,
    sunset,
    sunrise,
    civilDusk: cross(-1, -6),
    civilDawn: cross(+1, -6),
    nauticalDusk: cross(-1, -12),
    nauticalDawn: cross(+1, -12),
    astroDusk: cross(-1, -18),
    astroDawn: cross(+1, -18),
    midnightSun: dayAtNoon && sunset === null,
    polarNight: !dayAtNoon && sunrise === null,
  }
}
