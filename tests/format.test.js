import { describe, expect, it } from 'vitest'
import { fmtTime, pct, compass, timeline } from '../src/format'

describe('fmtTime', () => {
  it('formats ISO local times as h:mm AM/PM', () => {
    expect(fmtTime('2026-08-31T00:30:00-04:00')).toBe('12:30 AM')
    expect(fmtTime('2026-08-30T21:00:00-04:00')).toBe('9:00 PM')
  })
  it('returns em-dash for empty input', () => {
    expect(fmtTime(null)).toBe('—')
  })
})

describe('pct (moonInterference 0-1 fraction)', () => {
  it('renders as integer percent', () => expect(pct(0.4)).toBe('40%'))
  it('renders zero as 0%', () => expect(pct(0)).toBe('0%'))
  it('renders null as em-dash', () => expect(pct(null)).toBe('—'))
})

describe('compass', () => {
  it('maps azimuth to 16-point compass', () => {
    expect(compass(2)).toBe('N')
    expect(compass(181)).toBe('S')
    expect(compass(46)).toBe('NE')
  })
  it('handles null', () => expect(compass(null)).toBe('—'))
})

describe('timeline', () => {
  const night = { startLocal: '2026-08-30T21:00:00-04:00', endLocal: '2026-08-31T05:00:00-04:00' }
  const target = {
    window: { start: '2026-08-30T21:00:00-04:00', end: '2026-08-31T05:00:00-04:00' },
    bestTime: '2026-08-31T01:00:00-04:00',
  }
  it('computes bar position and star position in percent', () => {
    const t = timeline(night, target)
    expect(t.leftPct).toBeCloseTo(0)
    expect(t.widthPct).toBeCloseTo(100)
    expect(t.starPct).toBeCloseTo(50)
  })
  it('clamps out-of-window values to 0-100', () => {
    const t = timeline(night, { window: { start: night.startLocal, end: night.endLocal },
                                bestTime: '2026-08-31T12:00:00-04:00' })
    expect(t.starPct).toBe(100)
  })
})