const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']

/** "29.33°N 103.21°W" for decimal degrees (east-positive longitude, also used for selenographic points). */
export const fmtCoords = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'} ` +
                                       `${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`

/**
 * Observing site label, e.g. "Big Bend National Park, TX · 29.33°N 103.21°W".
 * Falls back to just the name when coordinates are missing; '' for no location.
 */
export function fmtLocation(loc) {
  if (!loc) return ''
  const { name, latitude: lat, longitude: lon } = loc
  if (lat == null || lon == null) return name ?? ''
  const coords = fmtCoords(lat, lon)
  return name ? `${name} · ${coords}` : coords
}

/** True when a target should be displayed: score must be positive. */
export function isDisplayable(t) {
  return t.score != null && Math.floor(t.score) > 0
}

export function fmtTime(iso) {
  // Site-local times carry the site's offset; show that wall clock, not the viewer's timezone.
  const m = iso && /T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return '—'
  const hour = Number(m[1])
  return `${hour % 12 || 12}:${m[2]} ${hour < 12 ? 'AM' : 'PM'}`
}

/** Date + time, e.g. "Sep 23, 5:52 PM" — for timestamps that may be stale. */
export function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

/**
 * Human-readable duration between two ISO instants, e.g. '9h 07m'.
 * Returns null when either end is missing or the range is not positive, so
 * callers can skip the element rather than render a nonsense span.
 */
export function fmtDuration(startIso, endIso) {
  if (!startIso || !endIso) return null
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return null
  return fmtMinutes(Math.round(ms / 60000))
}

/** Whole minutes as '9h 07m', or '45m' under an hour. */
export function fmtMinutes(totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

/** 'Wed, Sep 2' style label for a YYYY-MM-DD date string. */
export function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function pct(x) {
  if (x === null || x === undefined) return '—'
  return `${Math.round(x * 100)}%`
}

export function compass(az) {
  if (az === null || az === undefined) return '—'
  return COMPASS[Math.round(az / 22.5) % 16]
}

/** Why the lunar list is empty tonight. */
export const lunarEmpty = (moon) => ((moon?.maxAlt ?? 0) < 10
  ? "the Moon stays below 10° during tonight's window" : 'the Moon is too close to new to show features')

const EMOJI_RULES = [
  [/thunder|lightning/i, '⛈️'],
  [/snow|sleet|blizzard/i, '🌨️'],
  [/rain|drizzle|shower/i, '🌧️'],
  [/fog|mist|haze/i, '🌫️'],
  [/tropical|hurricane|storm/i, '🌪️'],
]

/** Emoji icon for an hourly forecast row; falls back to sky cover, then a generic icon. */
export function weatherEmoji(h = {}) {
  const f = h.shortForecast ?? ''
  for (const [re, emoji] of EMOJI_RULES) if (re.test(f)) return emoji

  const clear = /clear|sunny|fair/i.test(f)
  const partly = /partly/i.test(f)
  const cloudy = /cloud|overcast/i.test(f)
  const cover = h.skyCover ?? null

  if (clear || partly) {
    if (partly) return '⛅'
    return h.isDark ? '🌙' : '☀️'
  }
  if (cloudy) return '☁️'
  if (cover != null) {
    if (cover < 25) return h.isDark ? '🌙' : '☀️'
    if (cover < 65) return '⛅'
    return '☁️'
  }
  return '🌤️'
}

export function timeline(night, target) {
  const start = new Date(night.startLocal).getTime()
  const end = new Date(night.endLocal).getTime()
  const span = (end - start) || 1
  const pos = (t) =>
    Math.max(0, Math.min(100, ((new Date(t).getTime() - start) / span) * 100))
  return {
    leftPct: pos(target.window.start),
    widthPct: pos(target.window.end) - pos(target.window.start),
    starPct: pos(target.bestTime),
  }
}
/** Sexagesimal parts of x rounded to `places` decimals of the last field, carrying 60s upward. */
function sexagesimal(x, places) {
  const scale = 10 ** places
  const total = Math.round(Math.abs(x) * 3600 * scale)
  const whole = Math.floor(total / (3600 * scale))
  const min = Math.floor(total / (60 * scale)) % 60
  const sec = (total % (60 * scale)) / scale
  return [whole, String(min).padStart(2, '0'), sec.toFixed(places).padStart(places ? places + 3 : 2, '0')]
}

/** Right ascension or hour angle in hours, e.g. '18h 03m 40.4s'; '—' when unknown. */
export function fmtHours(h) {
  if (h == null) return '—'
  const [hh, mm, ss] = sexagesimal(((h % 24) + 24) % 24, 1)
  return `${String(hh % 24).padStart(2, '0')}h ${mm}m ${ss}s`
}

/** Signed angle in degrees, e.g. '−24° 22′ 49″'; '—' when unknown. */
export function fmtDms(deg) {
  if (deg == null) return '—'
  const [d, m, s] = sexagesimal(deg, 0)
  return `${deg < 0 ? '−' : '+'}${String(d).padStart(2, '0')}° ${m}′ ${s}″`
}

/** Apparent size from [major, minor] arcminutes, e.g. '45′ × 30′' or '1.5° × 0.7°' past a degree; null if unknown. */
export function fmtSize(size) {
  if (!size?.length) return null
  const big = size[0] >= 60
  const one = (a) => (big ? `${+(a / 60).toFixed(1)}°` : `${+a.toFixed(1)}′`)
  return size.map(one).join(' × ')
}

const OBJECT_TYPES = { dbl: 'double star', ast: 'asterism', S: 'spiral galaxy' }
const CLASS_TYPES = { planet: 'planet', moon: 'natural satellite', variable: 'variable star' }

/** What a target is, e.g. 'emission nebula', 'globular cluster', 'planet'. */
export function objectTypeLabel(t) {
  if (t.objectType) return OBJECT_TYPES[t.objectType] ?? t.objectType.replaceAll('_', ' ')
  return CLASS_TYPES[t.targetClass] ?? t.targetClass
}
