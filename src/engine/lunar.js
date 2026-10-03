import { Body, GeoMoon, GeoVector, RotationAxis } from 'astronomy-engine'

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
