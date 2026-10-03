import { describe, expect, it } from 'vitest'
import { fmtTime, fmtDateTime, pct, compass, timeline, fmtRa, fmtDec, weatherEmoji, vsxUrl, fmtLocation } from '../src/format'

describe('vsxUrl', () => {
  it('builds a VSX detail URL from an OID', () => {
    expect(vsxUrl('10875985')).toBe('https://vsx.aavso.org/index.php?view=detail.top&oid=10875985')
  })
  it('returns null without an OID so callers render plain text', () => {
    expect(vsxUrl(null)).toBeNull()
    expect(vsxUrl('')).toBeNull()
    expect(vsxUrl(undefined)).toBeNull()
  })
})

describe('fmtTime', () => {
  it('formats ISO local times as h:mm AM/PM', () => {
    expect(fmtTime('2026-08-31T00:30:00-04:00')).toBe('12:30 AM')
    expect(fmtTime('2026-08-30T21:00:00-04:00')).toBe('9:00 PM')
  })
  it("shows the site's wall-clock time from the ISO offset, not the viewer's timezone", () => {
    expect(fmtTime('2026-10-03T19:36:52-05:00')).toBe('7:36 PM')
    expect(fmtTime('2026-10-04T12:05:00-07:00')).toBe('12:05 PM')
  })
  it('returns em-dash for empty input', () => {
    expect(fmtTime(null)).toBe('—')
  })
})

describe('fmtDateTime', () => {
  it('includes the date so a stale timestamp is obvious', () => {
    expect(fmtDateTime('2026-08-31T02:41:03+00:00')).toBe('Aug 30, 10:41 PM')
  })
  it('returns em-dash for empty input', () => {
    expect(fmtDateTime('')).toBe('—')
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

describe('fmtRa / fmtDec (discover coordinates)', () => {
  it('formats decimal RA hours as h m', () => {
    expect(fmtRa(5.35)).toBe('5h 21m')
    expect(fmtRa(18.42)).toBe('18h 25m')
  })
  it('formats declination with sign and one decimal', () => {
    expect(fmtDec(23.64)).toBe('+23.6°')
    expect(fmtDec(-22.42)).toBe('-22.4°')
  })
  it('handles null', () => {
    expect(fmtRa(null)).toBe('—')
    expect(fmtDec(null)).toBe('—')
  })
})

describe('weatherEmoji (NWS short forecast → icon)', () => {
  it('maps known forecast strings', () => {
    expect(weatherEmoji({ shortForecast: 'Partly Cloudy' })).toBe('⛅')
    expect(weatherEmoji({ shortForecast: 'Mostly Cloudy' })).toBe('☁️')
    expect(weatherEmoji({ shortForecast: 'Rain Showers' })).toBe('🌧️')
    expect(weatherEmoji({ shortForecast: 'Thunderstorms Likely' })).toBe('⛈️')
    expect(weatherEmoji({ shortForecast: 'Light Snow' })).toBe('🌨️')
    expect(weatherEmoji({ shortForecast: 'Patchy Fog' })).toBe('🌫️')
  })
  it('clear at night is the moon, clear day is the sun', () => {
    expect(weatherEmoji({ shortForecast: 'Clear', isDark: true })).toBe('🌙')
    expect(weatherEmoji({ shortForecast: 'Clear', isDark: false })).toBe('☀️')
  })
  it('falls back to sky cover for unknown forecast text', () => {
    expect(weatherEmoji({ shortForecast: 'Blustery', skyCover: 10, isDark: false })).toBe('☀️')
    expect(weatherEmoji({ shortForecast: 'Blustery', skyCover: 10, isDark: true })).toBe('🌙')
    expect(weatherEmoji({ shortForecast: 'Blustery', skyCover: 50 })).toBe('⛅')
    expect(weatherEmoji({ shortForecast: 'Blustery', skyCover: 90 })).toBe('☁️')
  })
  it('handles missing everything with a generic icon', () => {
    expect(weatherEmoji({})).toBe('🌤️')
  })
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

describe('fmtLocation', () => {
  it('formats name with hemisphere-lettered coordinates', () => {
    expect(fmtLocation({ name: 'Big Bend National Park, TX', latitude: 29.33, longitude: -103.21 }))
      .toBe('Big Bend National Park, TX · 29.33°N 103.21°W')
  })
  it('uses S and E for southern / eastern sites', () => {
    expect(fmtLocation({ name: 'Sydney', latitude: -33.868, longitude: 151.209 }))
      .toBe('Sydney · 33.87°S 151.21°E')
  })
  it('falls back to the name when coordinates are missing', () => {
    expect(fmtLocation({ name: 'home' })).toBe('home')
  })
  it('returns an empty string for no location', () => {
    expect(fmtLocation(null)).toBe('')
  })
})
