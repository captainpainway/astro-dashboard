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

/** UTC offset of `tz` at `date`, in minutes (e.g. -300 for CDT). */
function offsetMinutes(date, tz) {
  const p = wallParts(date, tz)
  const wall = Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return Math.round((wall - Math.floor(date.getTime() / 1000) * 1000) / 60_000)
}

/** ISO 8601 in `tz` with its offset, to the second: "2026-10-03T19:00:00-05:00". */
export function toLocalIso(date, tz) {
  const p = wallParts(date, tz)
  const off = offsetMinutes(date, tz)
  const a = Math.abs(off)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}` +
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
