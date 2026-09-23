import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OverviewView from '../src/components/OverviewView.vue'

const tonight = {
  mode: 'window',
  weather: {
    summary: { cloudCoverAvg: 46.3, temperatureF: 75, windMphAvg: 2.2, rating: 'good' },
    current: { cloudCover: 71, temperatureF: 82.4, windMph: 6.9,
               description: 'Mostly cloudy', station: 'KLEE', timestamp: '2026-08-30T22:30:00+00:00' },
  },
  instruments: {
    dob_8inch: [
      { id: 'SS Cyg', name: 'SS Cyg', targetClass: 'variable', score: 81.1, maxAlt: 75.1,
        bestTime: '2026-08-31T00:30:00-04:00',
        window: { start: '2026-08-30T21:00:00-04:00', end: '2026-08-31T05:00:00-04:00' },
        altAtBest: 75.1, azAtBest: 2, moonInterference: 0, notes: '' },
      { id: 'Jupiter', name: 'Jupiter', targetClass: 'planet', score: 95, maxAlt: 44,
        bestTime: '2026-08-31T03:30:00-04:00',
        window: { start: '2026-08-30T21:00:00-04:00', end: '2026-08-31T05:00:00-04:00' },
        altAtBest: 44, azAtBest: 130, moonInterference: 0, notes: '' },
      { id: 'junk', name: 'Junk', targetClass: 'messier', score: 0, maxAlt: 10,
        bestTime: '2026-08-31T01:00:00-04:00',
        window: { start: '2026-08-30T21:00:00-04:00', end: '2026-08-31T05:00:00-04:00' },
        altAtBest: 10, azAtBest: 90, moonInterference: 0, notes: '' },
    ],
    dwarf_mini: [
      { id: 'NGC 6960', name: 'Veil Nebula (Western)', targetClass: 'nebula', score: 72.8, maxAlt: 87.9,
        bestTime: '2026-08-30T23:15:00-04:00',
        window: { start: '2026-08-30T21:00:00-04:00', end: '2026-08-31T05:00:00-04:00' },
        altAtBest: 87.9, azAtBest: 14, moonInterference: 0.4, notes: '' },
    ],
  },
  errors: [],
}

const forecast = {
  night: { startLocal: '2026-08-30T19:00:00-04:00', endLocal: '2026-08-31T07:00:00-04:00', timezone: 'America/New_York' },
  hours: [
    { time: '2026-08-30T20:00:00-04:00', isDark: true, score: 30, rating: 'poor',
      tempF: 78, skyCover: 90, shortForecast: 'Cloudy', reasons: ['cloudy (90%)'] },
    { time: '2026-08-31T02:00:00-04:00', isDark: true, score: 80, rating: 'ideal',
      tempF: 74, skyCover: 5, shortForecast: 'Clear', reasons: ['clear (5%)', 'calm'] },
    { time: '2026-08-31T03:00:00-04:00', isDark: false, score: 99, rating: 'ideal',
      tempF: 72, skyCover: 4, shortForecast: 'Sunny', reasons: [] },
  ],
}

const discover = {
  targets: [
    { star: { name: 'V1452 Tau', auid: '000-BQP-885', constellation: 'Tau', varType: 'N',
              periodDays: null, maxMag: 8.7, minMag: 23.4, magBand: 'V',
              raHours: 5.35, decDegrees: 23.64 },
      score: 55.8, maxAlt: 47.1, bestTime: '2026-08-31T05:00:00-04:00',
      window: { start: '2026-08-31T02:45:00-04:00', end: '2026-08-31T05:00:00-04:00' },
      azAtBest: 85, chartId: null, chartUrl: null },
    { star: { name: 'V8055 Sgr', auid: '000-BQQ-461', constellation: 'Sgr', varType: 'N',
              periodDays: null, maxMag: 8.1, minMag: 21.6, magBand: 'V',
              raHours: 18.42, decDegrees: -22.42 },
      score: 47.7, maxAlt: 38.8, bestTime: '2026-08-30T21:15:00-04:00',
      window: { start: '2026-08-30T21:00:00-04:00', end: '2026-08-31T01:00:00-04:00' },
      azAtBest: 180, chartId: null, chartUrl: null },
  ],
}

const allProps = { tonight, forecast, discover,
                   tonightLoading: false, forecastLoading: false, discoverLoading: false }

describe('OverviewView', () => {
  it('renders conditions card with rating chip and key numbers', () => {
    const w = mount(OverviewView, { props: allProps })
    const card = w.find('.card-conditions')
    expect(card.text()).toContain('Good')
    expect(card.text()).toContain('46%')
    expect(card.text()).toContain('75°F')
    expect(card.text()).toContain('Mostly cloudy')
  })

  it('picks the highest displayable-score target per instrument, labeled by instrument', () => {
    const w = mount(OverviewView, { props: allProps })
    const card = w.find('.card-picks')
    expect(card.text()).toContain('Jupiter')          // 95 beats SS Cyg 81.1; Junk (0) excluded
    expect(card.text()).not.toContain('Junk')
    expect(card.text()).toContain('Veil Nebula (Western)')
    expect(card.text()).toContain('8" Dobsonian')
    expect(card.text()).toContain('Dwarf Mini')
    expect(card.text()).toContain('95')
  })

  it('shows each pick\'s best time', () => {
    const w = mount(OverviewView, { props: allProps })
    const card = w.find('.card-picks')
    expect(card.text()).toContain('3:30 AM')  // Jupiter bestTime
    expect(card.text()).toContain('11:15 PM') // Veil bestTime
  })

  it('renders discoveries card with top star and remaining count', () => {
    const w = mount(OverviewView, { props: allProps })
    const card = w.find('.card-discoveries')
    expect(card.text()).toContain('V1452 Tau')
    expect(card.text()).toContain('8.7–23.4 V')
    expect(card.text()).toContain('N')
    expect(card.text()).toContain('+1 more')  // 2 found, 1 shown
  })

  it('shows per-section loading placeholders while sections load', () => {
    const w = mount(OverviewView, {
      props: { tonight: null, forecast: null, discover: null,
               tonightLoading: true, forecastLoading: true, discoverLoading: true },
    })
    const placeholders = w.findAll('.card-loading')
    expect(placeholders).toHaveLength(3) // one per data source (tonight, forecast, discover)
  })

  it('renders hourly strip with time, emoji, temp, cloud per hour', () => {
    const w = mount(OverviewView, { props: allProps })
    const chips = w.findAll('.hour-chip')
    expect(chips).toHaveLength(3)
    expect(chips[0].text()).toContain('8:00 PM')
    expect(chips[0].text()).toContain('☁️')
    expect(chips[0].text()).toContain('78°')
    expect(chips[0].text()).toContain('90%')
    expect(chips[1].text()).toContain('🌙') // Clear + dark
    expect(chips[2].text()).toContain('☀️') // Sunny + not dark
  })

  it('highlights only the best dark hour in the hourly strip', () => {
    const w = mount(OverviewView, { props: allProps })
    const chips = w.findAll('.hour-chip')
    expect(chips[1].classes()).toContain('best')  // score 80, dark
    expect(chips[0].classes()).not.toContain('best')
    expect(chips[2].classes()).not.toContain('best') // score 99 but not dark
  })

  it('color-codes each hourly chip by its rating', () => {
    const w = mount(OverviewView, { props: allProps })
    const chips = w.findAll('.hour-chip')
    expect(chips[0].classes()).toContain('rc-poor')   // rating: poor
    expect(chips[1].classes()).toContain('rc-ideal')  // rating: ideal
    expect(chips[2].classes()).toContain('rc-ideal')  // rating: ideal (not dark, still colored)
  })

  it('falls back to a neutral class for unknown ratings', () => {
    const fc = { ...forecast, hours: [{ ...forecast.hours[0], rating: 'bizarre' }] }
    const w = mount(OverviewView, { props: { ...allProps, forecast: fc } })
    expect(w.findAll('.hour-chip')[0].classes()).toContain('rc-none')
  })

  it('hourly strip hidden when forecast data is missing', () => {
    const w = mount(OverviewView, {
      props: { tonight, forecast: null, discover,
               tonightLoading: false, forecastLoading: false, discoverLoading: false },
    })
    expect(w.find('.card-hourly').exists()).toBe(false)
  })

  it('hides sections whose data failed to arrive (no error text)', () => {
    const w = mount(OverviewView, {
      props: { tonight, forecast: null, discover: null,
               tonightLoading: false, forecastLoading: false, discoverLoading: false },
    })
    expect(w.find('.card-hourly').exists()).toBe(false)
    expect(w.find('.card-discoveries').exists()).toBe(false)
    expect(w.find('.card-conditions').exists()).toBe(true)
    expect(w.text()).not.toContain('failed')
  })

  it('shows the best dark hour as its own tile', () => {
    const w = mount(OverviewView, { props: allProps })
    const card = w.find('.card-best')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('🌙')
    expect(card.text()).toContain('score 80')
  })

  it('renders night times in its own tile, separate from the hourly strip', () => {
    const twilight = { sunset: '2026-08-30T19:45:00-04:00', astroDusk: '2026-08-30T21:15:00-04:00',
                       astroDawn: '2026-08-31T05:10:00-04:00', sunrise: '2026-08-31T06:40:00-04:00' }
    const w = mount(OverviewView, { props: { ...allProps, twilight } })
    const card = w.find('.card-night')
    expect(card.exists()).toBe(true)
    expect(card.classes()).not.toContain('card-hourly')
    expect(card.text()).toContain('9:15 PM')
    expect(w.findAll('.card-hourly')).toHaveLength(1)
  })

  it('shows a dash, not NaN, when average wind is missing', () => {
    const t = { ...tonight, weather: { ...tonight.weather,
      summary: { ...tonight.weather.summary, windMphAvg: null } } }
    const w = mount(OverviewView, { props: { ...allProps, tonight: t } })
    expect(w.find('.card-conditions').text()).not.toContain('NaN')
    expect(w.find('.card-conditions').text()).toContain('— mph')
  })
})
