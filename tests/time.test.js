import { describe, expect, it } from 'vitest'
import { addDays, localDate, nextOccurrence, toLocalIso, tonightWindow, zonedTime } from '../src/engine/time'

describe('time helpers', () => {
  it('formats an instant in a zone with its offset', () => {
    expect(toLocalIso(new Date('2026-10-04T00:00:00Z'), 'America/Chicago')).toBe('2026-10-03T19:00:00-05:00')
    expect(toLocalIso(new Date('2026-12-04T00:00:00Z'), 'America/Chicago')).toBe('2026-12-03T18:00:00-06:00')
    expect(toLocalIso(new Date('2026-10-04T00:00:00.900Z'), 'UTC')).toBe('2026-10-04T00:00:00+00:00')
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
