import { describe, expect, it } from 'vitest'
import { addDays, localDate, nextOccurrence, toLocalIso, tonightWindow, zonedTime } from '../src/engine/time'

describe('time helpers', () => {
  it('formats an instant in a zone with its offset', () => {
    expect(toLocalIso(new Date('2026-10-04T00:00:00Z'), 'America/Chicago')).toBe('2026-10-03T19:00:00-05:00')
    expect(toLocalIso(new Date('2026-12-04T00:00:00Z'), 'America/Chicago')).toBe('2026-12-03T18:00:00-06:00')
    expect(toLocalIso(new Date('2026-10-04T00:00:00.900Z'), 'UTC')).toBe('2026-10-04T00:00:00+00:00')
  })

  it('matches Intl to the second around DST changes, including half- and quarter-hour zones', () => {
    // Reference: what Intl itself says, with no caching. Lord Howe shifts by 30 minutes; Kathmandu is +05:45.
    const ref = (d, tz) => {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric',
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'longOffset' })
        .formatToParts(d).map((x) => [x.type, x.value]))
      const off = p.timeZoneName === 'GMT' ? '+00:00' : p.timeZoneName.slice(3)
      return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${off}`
    }
    const around = [['America/Chicago', '2026-03-08T08:00:00Z'], ['America/Chicago', '2026-11-01T07:00:00Z'],
                    ['Europe/London', '2026-03-29T01:00:00Z'], ['Australia/Lord_Howe', '2026-04-04T15:00:00Z'],
                    ['Asia/Kathmandu', '2026-06-01T00:00:00Z'], ['UTC', '2026-01-01T00:00:00Z']]
    for (const [tz, at] of around) {
      for (let s = -3 * 3600; s <= 3 * 3600; s += 7 * 60 + 13) { // every 7m13s, so seconds and block edges vary
        const d = new Date(Date.parse(at) + s * 1000 + 250)
        expect(toLocalIso(d, tz), `${tz} ${d.toISOString()}`).toBe(ref(d, tz))
      }
    }
  })

  it('converts wall-clock time in a zone to an instant, across the DST change', () => {
    expect(zonedTime('2026-10-31', 19, 0, 'America/Chicago').toISOString()).toBe('2026-11-01T00:00:00.000Z')
    expect(zonedTime('2026-11-01', 7, 0, 'America/Chicago').toISOString()).toBe('2026-11-01T13:00:00.000Z')
    expect(zonedTime('2026-06-21', 12, 0, 'America/Anchorage').toISOString()).toBe('2026-06-21T20:00:00.000Z')
  })

  it('gives the local calendar date and adds days', () => {
    expect(localDate(new Date('2026-10-04T03:00:00Z'), 'America/Chicago')).toBe('2026-10-03')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('night window', () => {
  const tz = 'America/Chicago'
  it('finds the next occurrence of a clock time (today if not passed, else tomorrow)', () => {
    const at = (iso, h, m) => nextOccurrence(new Date(iso), h, m, tz).toISOString()
    expect(at('2026-10-03T15:00:00-05:00', 22, 30)).toBe('2026-10-04T03:30:00.000Z')
    expect(at('2026-10-03T23:00:00-05:00', 22, 30)).toBe('2026-10-05T03:30:00.000Z')
    expect(at('2026-10-03T22:30:00-05:00', 22, 30)).toBe('2026-10-04T03:30:00.000Z') // equal counts as not passed
  })

  it('tonight is 21:00-05:00 local, and rolls to tomorrow once 21:00 has passed', () => {
    const w = (iso) => { const { start, end } = tonightWindow(new Date(iso), tz); return [start.toISOString(), end.toISOString()] }
    expect(w('2026-10-03T15:00:00-05:00')).toEqual(['2026-10-04T02:00:00.000Z', '2026-10-04T10:00:00.000Z'])
    expect(w('2026-10-03T22:00:00-05:00')).toEqual(['2026-10-05T02:00:00.000Z', '2026-10-05T10:00:00.000Z'])
  })

  it('ends at 05:00 wall clock across the fall-back change (9 real hours, as astro-cli)', () => {
    const { start, end } = tonightWindow(new Date('2026-10-31T15:00:00-05:00'), tz)
    expect(start.toISOString()).toBe('2026-11-01T02:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-01T11:00:00.000Z')
  })
})
