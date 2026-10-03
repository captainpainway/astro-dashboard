import { describe, expect, it } from 'vitest'
import { addDays, localDate, toLocalIso, zonedTime } from '../src/engine/time'

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
