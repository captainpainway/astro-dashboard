const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']

/**
 * VSX detail-page URL for a star's AAVSO OID (e.g. 10875985).
 * VSX keys its detail pages by OID, not AUID — there is no AUID-based URL.
 * Returns null when no OID is known so callers can fall back to plain text.
 */
export function vsxUrl(oid) {
  return oid ? `https://vsx.aavso.org/index.php?view=detail.top&oid=${oid}` : null
}

/**
 * Observing site label, e.g. "Big Bend National Park, TX · 29.33°N 103.21°W".
 * Falls back to just the name when coordinates are missing; '' for no location.
 */
export function fmtLocation(loc) {
  if (!loc) return ''
  const { name, latitude: lat, longitude: lon } = loc
  if (lat == null || lon == null) return name ?? ''
  const coords = `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'} ` +
                 `${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`
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
  const totalMinutes = Math.round(ms / 60000)
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

export function fmtRa(raHours) {
  if (raHours == null) return '—'
  const h = Math.floor(raHours)
  const m = Math.round((raHours - h) * 60)
  return `${h}h ${m}m`
}

export function fmtDec(dec) {
  if (dec == null) return '—'
  return `${dec >= 0 ? '+' : ''}${dec.toFixed(1)}°`
}

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