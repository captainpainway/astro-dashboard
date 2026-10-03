// Deduct-from-100 condition scoring, ported from astro-cli (rating.py, forecast._rate_hour).
// Each penalty returns [points, reason?]; reasons keep astro-cli's wording.

const pct = (x) => x.toFixed(0)

/** Map a 0-100 score onto the 6-tier scale. */
export function scoreToRating(score) {
  if (score >= 85) return 'ideal'
  if (score >= 70) return 'great'
  if (score >= 55) return 'good'
  if (score >= 40) return 'fair'
  if (score >= 25) return 'poor'
  return 'bad'
}

export function cloudPenalty(c) {
  if (c == null || c <= 10) return [0]
  if (c <= 25) return [8, `few clouds (${pct(c)}%)`]
  if (c <= 50) return [25, `partly cloudy (${pct(c)}%)`]
  if (c <= 75) return [50, `mostly cloudy (${pct(c)}%)`]
  return [75, `overcast (${pct(c)}%)`]
}

export function precipPenalty(p) {
  if (p != null && p > 30) return [30, `rain likely (${pct(p)}%)`]
  if (p != null && p > 15) return [12, `rain possible (${pct(p)}%)`]
  return [0]
}

export function windPenalty(w) {
  if (w == null) return [0]
  if (w > 15) return [12, `windy (${pct(w)} mph)`]
  if (w > 10) return [6, `breezy (${pct(w)} mph)`]
  return [w > 5 ? 2 : 0]
}

export function tempPenalty(t) {
  if (t == null) return [0]
  if (t > 85) return [5, `hot (${pct(t)}°F)`]
  if (t > 78) return [2]
  if (t < 35) return [5, `cold (${pct(t)}°F)`]
  return [0]
}

/** Apply penalties in order: { score (unclamped), reasons }. */
export function deduct(penalties) {
  let score = 100
  const reasons = []
  for (const [points, reason] of penalties) {
    score -= points
    if (reason) reasons.push(reason)
  }
  return { score, reasons }
}

/**
 * Rate a night (or instant) on the shared 6-tier scale. Cloud is the gate:
 * without it the rating is "unknown". Moonlight is intentionally excluded.
 */
export function rateConditions(cloud = null, wind = null, tempF = null, precipProb = null) {
  if (cloud == null) return { score: null, rating: 'unknown', reasons: [] }
  const { score, reasons } = deduct([cloudPenalty(cloud), precipPenalty(precipProb),
                                     windPenalty(wind), tempPenalty(tempF)])
  const clamped = Math.max(score, 0)
  return { score: clamped, rating: scoreToRating(clamped), reasons }
}
