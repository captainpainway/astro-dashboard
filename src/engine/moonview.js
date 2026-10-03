import { Libration } from 'astronomy-engine'
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

/** Unit-disc position of a selenographic point; `visible` when it faces Earth. */
export function project(pt, { right, up, earth }) {
  const p = sunVector(pt)
  return { x: dot(p, right), y: dot(p, up), visible: dot(p, earth) > 0 }
}
