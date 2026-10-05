import { Rotation_EQJ_HOR } from 'astronomy-engine'
import catalogs from './catalogs.json'
import { PLANETS, altaz, darkWindow, moonIllumination, moonIsWaxing, observerFor, twilightEvents } from './astro'
import { localDate } from './time'
import { isDisplayable } from '../format'

const RAD = Math.PI / 180
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

/** Points more than ~100° from the view direction aren't drawn: stereographic blows up toward 180°. */
export const VISIBLE_Z = -0.17

/** J2000 unit vector of a right ascension (hours) and declination (degrees). */
export function unitVector(raHours, decDeg) {
  const ra = raHours * 15 * RAD
  const dec = decDeg * RAD
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]
}

// Horizontal frame as in astronomy-engine: x north, y west, z zenith; azimuth from north through east.
export function horizonVector({ alt, az }) {
  const a = alt * RAD
  const z = az * RAD
  return [Math.cos(a) * Math.cos(z), -Math.cos(a) * Math.sin(z), Math.sin(a)]
}
export const altAzOf = ([x, y, z]) => ({ alt: Math.asin(clamp(z, -1, 1)) / RAD, az: (Math.atan2(-y, x) / RAD + 360) % 360 })

/** Flattened astronomy-engine `rot[i][j]` applied as RotateVector does; uniformMatrix3fv(loc, false, m) matches in GLSL. */
export const rotate = (m, [x, y, z]) =>
  [m[0] * x + m[3] * y + m[6] * z, m[1] * x + m[4] * y + m[7] * z, m[2] * x + m[5] * y + m[8] * z]

const cap = (s) => s[0].toUpperCase() + s.slice(1)

/** What moves, at `date`: the J2000→horizon matrix, the Sun, the Moon (with phase) and the planets. */
export function skyAt(location, date) {
  const observer = observerFor(location)
  return {
    date,
    rot: Rotation_EQJ_HOR(date, observer).rot.flat(),
    sun: altaz('sun', date, observer),
    moon: { ...altaz('moon', date, observer), illum: moonIllumination(date), waxing: moonIsWaxing(date) },
    planets: PLANETS.map((key) => ({ id: cap(key), ...altaz(key, date, observer) })),
  }
}

/** 0 until the Sun is 6° down, 1 once it is 18° down. */
export const darkness = (frame) => smoothstep(6, 18, -frame.sun.alt)

/** Faintest magnitude drawn: 0 at dusk, 5 in full dark, up to 1 brighter limit lost to a bright Moon above the horizon. */
export const starLimit = (frame) => 5 * darkness(frame) - (frame.moon.alt > 0 ? frame.moon.illum : 0)

/**
 * Tonight's scrubber range: sunset to sunrise of the night `darkWindow` picks, or that window where the Sun doesn't set
 * or rise. `astroDusk` is null on nights without astronomical darkness.
 */
export function nightRange(location, now) {
  const win = darkWindow(location, now)
  const tw = twilightEvents(location, localDate(win.start, location.timezone))
  const date = (iso) => (iso ? new Date(iso) : null)
  const astroDusk = date(tw.astroDusk)
  return tw.sunset && tw.sunrise ? { start: date(tw.sunset), end: date(tw.sunrise), astroDusk } : { ...win, astroDusk }
}

/** Where the intro stops: `bestHour` (ISO) if it falls inside `range`, else astronomical dusk, else mid-range. */
export function introEnd(range, bestHour) {
  const t = Date.parse(bestHour ?? '')
  if (t >= range.start && t <= range.end) return new Date(t)
  return range.astroDusk ?? new Date((range.start.getTime() + range.end.getTime()) / 2)
}

/** Horizontal field of view for a tile `width` CSS px wide: about 7 px per degree, from 90° to 180°. */
export const fieldOfView = (width) => clamp(width / 7, 90, 180)

/**
 * Stereographic camera looking at azimuth `yaw`, altitude `pitch`, `hfov` degrees across `width` × `height` CSS px.
 * `project` maps a horizon vector to tile px (y down); `unproject` is its inverse.
 */
export function camera({ yaw, pitch, hfov, width, height }) {
  const y0 = yaw * RAD
  const p0 = pitch * RAD
  const fwd = [Math.cos(p0) * Math.cos(y0), -Math.cos(p0) * Math.sin(y0), Math.sin(p0)]
  const right = [-Math.sin(y0), -Math.cos(y0), 0]
  const up = cross(right, fwd)
  const scale = width / 2 / (2 * Math.tan(hfov * RAD / 4)) // px per stereographic unit: the field's edge is the tile's edge
  return {
    yaw, pitch, hfov, width, height, fwd, right, up, scale,
    degPerPx: 1 / (scale * RAD),
    project(v) {
      const z = dot(v, fwd)
      const k = 2 / (1 + z)
      const x = width / 2 + k * dot(v, right) * scale
      const y = height / 2 - k * dot(v, up) * scale
      const visible = z > VISIBLE_Z
      return { x, y, visible, onScreen: visible && x >= 0 && x <= width && y >= 0 && y <= height }
    },
    unproject(x, y) {
      const sx = (x - width / 2) / scale
      const sy = (height / 2 - y) / scale
      const d = 4 + sx * sx + sy * sy
      const [a, b, c] = [4 * sx / d, 4 * sy / d, (8 - d) / d]
      return [0, 1, 2].map((i) => a * right[i] + b * up[i] + c * fwd[i])
    },
  }
}

/** Spot on the tile's edge (`inset` px in) toward an off-screen horizon vector, with an arrow pointing at it. */
export function edgeMarker(v, cam, inset = 28) {
  const a = Math.atan2(dot(v, cam.up), dot(v, cam.right)) // on-screen direction from the centre, counter-clockwise
  const hw = cam.width / 2 - inset
  const hh = cam.height / 2 - inset
  const t = Math.min(hw / Math.abs(Math.cos(a) || 1e-9), hh / Math.abs(Math.sin(a) || 1e-9))
  const deg = a / RAD
  const arrow = Math.abs(deg) <= 45 ? '→' : deg > 45 && deg < 135 ? '↑' : deg < -45 && deg > -135 ? '↓' : '←'
  return { x: cam.width / 2 + Math.cos(a) * t, y: cam.height / 2 - Math.sin(a) * t, arrow }
}

/** Camera angles that put `altAz` `lift` degrees above centre, turning the short way and keeping the horizon in sight. */
export function turnTarget(view, { alt, az }, lift = 0) {
  return { yaw: view.yaw + (((az - view.yaw) % 360) + 540) % 360 - 180, pitch: clamp(alt - lift, 25, 85) }
}

/**
 * Displayable targets of each instrument (only the first `per` of each when given), one entry per id listing every
 * instrument that has it and the best score among them.
 */
export function allTargets(instruments, per = Infinity) {
  const byId = new Map()
  for (const [instrument, list] of Object.entries(instruments ?? {})) {
    for (const t of list.filter(isDisplayable).slice(0, per)) {
      const seen = byId.get(t.id)
      if (seen) {
        seen.instruments.push(instrument)
        seen.score = Math.max(seen.score, t.score)
      } else byId.set(t.id, { ...t, instruments: [instrument] })
    }
  }
  return [...byId.values()]
}

/** The first `per` displayable targets of each instrument (the home tile's rings). */
export const topTargets = (instruments, per = 5) => allTargets(instruments, per)

/** The sky page's list: `instrument` ('all' or a key), optionally only targets above the horizon in `frame`. */
export function filterTargets(targets, { instrument = 'all', upOnly = false } = {}, frame = null) {
  return targets
    .filter((t) => instrument === 'all' || t.instruments.includes(instrument))
    .filter((t) => !upOnly || (frame && (targetHorizon(t, frame)?.[2] ?? -1) > 0))
    .sort((a, b) => b.score - a.score)
}

const CATALOG = new Map([
  ...catalogs.messier.map((o) => [o.id, o]),
  ...catalogs.ngc.map((o) => [o.id, o]),
  ...catalogs.watchlist.map((o) => [o.designation, o]),
])

/** J2000 unit vector of a catalogue target (Messier, NGC by id, watchlist by designation); null if unknown. */
export function targetVector(id) {
  const o = CATALOG.get(id)
  return o?.raHours == null || o.decDegrees == null ? null : unitVector(o.raHours, o.decDegrees)
}

/** Horizon vector of a tonight-plan target in `frame`, or null when its position is unknown. */
export function targetHorizon(target, frame) {
  if (target.targetClass === 'planet') {
    const p = frame.planets.find((q) => q.id === target.id)
    return p ? horizonVector(p) : null
  }
  if (target.targetClass === 'moon') return horizonVector(frame.moon)
  const v = targetVector(target.id)
  return v && rotate(frame.rot, v)
}

/** Six numbers in [0, 1) from the coordinates, so each place gets its own decorative ridge line. */
export function terrainSeed({ latitude, longitude }) {
  return Array.from({ length: 6 }, (_, i) => {
    const x = Math.sin(latitude * 12.9898 + longitude * 78.233 + i * 37.719) * 43758.5453
    return x - Math.floor(x)
  })
}

const BV_STOPS = [[-0.4, [0.61, 0.69, 1]], [0, [0.8, 0.85, 1]], [0.6, [1, 0.96, 0.91]], [1.2, [1, 0.82, 0.63]], [2, [1, 0.68, 0.32]]]
/** Star colour (linear RGB 0..1) from its B−V colour index. */
export function starColor(bv) {
  const b = clamp(bv, -0.4, 2)
  const i = Math.max(1, BV_STOPS.findIndex(([x]) => x >= b))
  const [[x0, c0], [x1, c1]] = [BV_STOPS[i - 1], BV_STOPS[i]]
  return c0.map((c, k) => c + (c1[k] - c) * ((b - x0) / (x1 - x0)))
}

/** SVG path of the lit part of a Moon disc of radius `r` and lit fraction `illum`, lit limb toward +x. */
export function moonPath(illum, r) {
  const rx = Math.abs(2 * illum - 1) * r
  return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${rx} ${r} 0 0 ${illum > 0.5 ? 1 : 0} 0 ${-r} Z`
}
