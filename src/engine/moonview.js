import { Body, Libration, RotateVector, Rotation_EQJ_HOR, RotationAxis } from 'astronomy-engine'
import { altaz, moonPass, observerFor } from './astro'
import { subsolarPoint } from './lunar'

const RAD = Math.PI / 180

// Body frame: x toward lon 0 / lat 0, y toward 90°E, z toward the north pole.
export const sunVector = ({ lat, lon }) =>
  [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)]

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** Sub-solar and sub-Earth points (selenographic degrees, east-positive) at `date`. */
export function moonView(date) {
  const { elat, elon } = Libration(date)
  return { sub: subsolarPoint(date), earth: { lat: elat, lon: elon } }
}

/** North-up screen basis seen from `earth`: +x right (east), +y up (north), `earth` toward the viewer. */
export function viewBasis(earth) {
  const e = sunVector(earth)
  const k = e[2]
  const n = Math.sqrt(1 - k * k) // |z - k·e|
  const up = [(0 - k * e[0]) / n, (0 - k * e[1]) / n, (1 - k * e[2]) / n]
  return { right: cross(up, e), up, earth: e }
}

/** `basis` turned counter-clockwise on screen by `angle` radians. */
export function rotateBasis({ right, up, earth }, angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { right: right.map((r, i) => c * r - s * up[i]), up: right.map((r, i) => s * r + c * up[i]), earth }
}

/**
 * Counter-clockwise screen rotation (radians) that turns the north-up Moon into the Moon as it hangs in the sky
 * at `location` and `date`, zenith up. Uses the geocentric pole direction; parallax is under a degree.
 */
export function skyRotation(date, location) {
  const observer = observerFor(location)
  const { alt, az } = altaz('moon', date, observer)
  const a = alt * RAD
  const b = az * RAD
  // Horizontal frame: x north, y west, z zenith. `m` is where the Moon is, `n` the lunar north pole's direction.
  const m = [Math.cos(a) * Math.cos(b), -Math.cos(a) * Math.sin(b), Math.sin(a)]
  const pole = RotateVector(Rotation_EQJ_HOR(date, observer), RotationAxis(Body.Moon, date).north)
  const n = [pole.x, pole.y, pole.z]
  // Screen up is the zenith with its line-of-sight part removed; screen right is forward × up.
  const k = m[2]
  const raw = [-k * m[0], -k * m[1], 1 - k * m[2]]
  const len = Math.hypot(...raw)
  const up = raw.map((c) => c / len)
  return Math.atan2(-dot(n, cross(m, up)), dot(n, up))
}

const HALF_HOUR = 30 * 60_000
/**
 * Half-hour times (plus the moonrise and moonset ends, tagged in `event`) of the pass under way at `now`, or the next one
 * if the Moon is down, as [{ date, event }]. `window` ({ start, end } Dates) clips the pass; [] if the Moon never is up in it.
 */
export function moonVisibleTimes(location, now, window = null) {
  const pass = moonPass(observerFor(location), window ? window.start : now)
  if (!pass) return []
  const lo = window ? Math.max(pass.rise, window.start) : pass.rise.getTime()
  const hi = window ? Math.min(pass.set, window.end) : pass.set.getTime()
  if (lo >= hi) return []
  const tag = (t) => (Math.abs(t - pass.rise) < 1000 ? 'moonrise' : Math.abs(t - pass.set) < 1000 ? 'moonset' : null)
  const times = [lo]
  for (let t = Math.floor(lo / HALF_HOUR) * HALF_HOUR + HALF_HOUR; t < hi; t += HALF_HOUR) times.push(t)
  return [...times, hi].map((t) => ({ date: new Date(t), event: tag(t) }))
}

/** Unit-disc position of a selenographic point; `visible` when it faces Earth. */
export function project(pt, { right, up, earth }) {
  const p = sunVector(pt)
  return { x: dot(p, right), y: dot(p, up), visible: dot(p, earth) > 0 }
}
