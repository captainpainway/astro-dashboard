// Timezone arithmetic on Intl (Temporal isn't in Safari yet; swap this file when it is).

const formatters = new Map()
const pad = (n) => String(n).padStart(2, '0')

function wallParts(date, tz) {
  let f = formatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit',
                                           day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    formatters.set(tz, f)
  }
  return Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]))
}

// Intl is slow (~0.1 ms a call) and plans format thousands of times. Offsets change only at DST transitions, which fall
// on 15-minute UTC boundaries, so one lookup per zone and 15-minute block is exact.
// ponytail: never evicted; a session touches a few thousand blocks at most
const BLOCK = 15 * 60_000
const offsets = new Map()

/** UTC offset of `tz` at `date`, in minutes (e.g. -300 for CDT). */
function offsetMinutes(date, tz) {
  const key = `${tz}|${Math.floor(date.getTime() / BLOCK)}`
  let off = offsets.get(key)
  if (off === undefined) {
    const p = wallParts(date, tz)
    const wall = Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
    off = Math.round((wall - Math.floor(date.getTime() / 1000) * 1000) / 60_000)
    offsets.set(key, off)
  }
  return off
}

/** ISO 8601 in `tz` with its offset, to the second: "2026-10-03T19:00:00-05:00". */
export function toLocalIso(date, tz) {
  const off = offsetMinutes(date, tz)
  const w = new Date(Math.floor(date.getTime() / 1000) * 1000 + off * 60_000) // the wall clock, read in UTC
  const a = Math.abs(off)
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}` +
         `T${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}:${pad(w.getUTCSeconds())}` +
         `${off < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`
}

/** Calendar date ("YYYY-MM-DD") of `date` in `tz`. */
export const localDate = (date, tz) => toLocalIso(date, tz).slice(0, 10)

/** "YYYY-MM-DD" shifted by n days. */
export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** The instant when the wall clock in `tz` reads `day` hour:minute. */
export function zonedTime(day, hour, minute, tz) {
  const [y, m, d] = day.split('-').map(Number)
  const wall = Date.UTC(y, m - 1, d, hour, minute)
  // Second pass corrects the guess when the offset differs on either side of a DST change.
  let t = wall - offsetMinutes(new Date(wall), tz) * 60_000
  t = wall - offsetMinutes(new Date(t), tz) * 60_000
  return new Date(t)
}

/** Next wall-clock `hour:minute` in `tz`: today if not yet passed, else tomorrow. */
export function nextOccurrence(now, hour, minute, tz) {
  const today = localDate(now, tz)
  const t = zonedTime(today, hour, minute, tz)
  return t < now ? zonedTime(addDays(today, 1), hour, minute, tz) : t
}

/** Observing window 21:00 → 05:00 local (astro-cli's "tonight"; tomorrow's once 21:00 has passed). */
export function tonightWindow(now, tz) {
  const start = nextOccurrence(now, 21, 0, tz)
  return { start, end: zonedTime(addDays(localDate(start, tz), 1), 5, 0, tz) }
}
