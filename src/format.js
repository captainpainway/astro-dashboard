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