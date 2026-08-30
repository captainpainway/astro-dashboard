const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']

/** True when a target should be displayed: score must be positive. */
export function isDisplayable(t) {
  return t.score != null && Math.floor(t.score) > 0
}

export function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
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