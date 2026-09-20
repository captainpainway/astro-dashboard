import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ForecastView from '../src/components/ForecastView.vue'
import NightTimes from '../src/components/NightTimes.vue'

const night = { startLocal: '2026-08-30T19:00:00-04:00', endLocal: '2026-08-31T07:00:00-04:00', timezone: 'America/New_York' }

function hour(over = {}) {
  return {
    time: '2026-08-31T01:00:00-04:00', tempF: 76, dewpointF: 75, skyCover: 48, windMph: 0,
    windDir: '', humidity: 97, precipProb: 2, shortForecast: 'Partly Cloudy',
    sunAlt: -52, moonAlt: 47.6, moonIllum: 0.9, twilightPhase: 'dark', moonUp: true,
    isDark: true, rating: 'fair', reasons: ['partly cloudy (48%)', 'moon up (90%)'], score: 45,
    ...over,
  }
}

const props = (hours) => ({ hours, night, loading: false })

describe('ForecastView', () => {
  it('renders one hour card per hour, sorted by time as given', () => {
    const hours = [hour(), hour({ time: '2026-08-30T20:00:00-04:00', rating: 'ideal' })]
    const w = mount(ForecastView, { props: props(hours) })
    expect(w.findAll('.hour-card')).toHaveLength(2)
    expect(w.text()).toContain('Partly Cloudy')
  })

  it('shows the hourly rating chip on each card', () => {
    const hours = [hour(), hour({ rating: 'ideal' })]
    const w = mount(ForecastView, { props: props(hours) })
    const chips = w.findAll('.hour-card .rating')
    expect(chips[0].classes()).toContain('rating-fair')
    expect(chips[1].classes()).toContain('rating-ideal')
  })

  it('dims non-dark hours', () => {
    const hours = [hour(), hour({ isDark: false, twilightPhase: 'civil' })]
    const w = mount(ForecastView, { props: props(hours) })
    expect(w.findAll('.hour-card')[1].classes()).toContain('not-dark')
  })

  it('shows best-window summary from the highest-scoring dark hour', () => {
    const hours = [
      hour({ time: '2026-08-30T20:00:00-04:00', score: 30 }),
      hour({ time: '2026-08-31T01:00:00-04:00', score: 45 }),
      hour({ time: '2026-08-31T02:00:00-04:00', score: 80, rating: 'ideal' }),
    ]
    const w = mount(ForecastView, { props: props(hours) })
    expect(w.find('.best-window').exists()).toBe(true)
    expect(w.find('.best-window').text()).toContain('2:00 AM')
    expect(w.find('.best-window').text()).toContain('Ideal')
  })

  it('renders no best-window section when there are no dark hours', () => {
    const hours = [hour({ isDark: false, score: 10 })]
    const w = mount(ForecastView, { props: props(hours) })
    expect(w.find('.best-window').exists()).toBe(false)
  })

  it('shows loading placeholder', () => {
    const w = mount(ForecastView, { props: { hours: [], night, loading: true } })
    expect(w.text()).toContain('loading forecast…')
  })

  it('shows empty state when loaded but no hours', () => {
    const w = mount(ForecastView, { props: { hours: [], night, loading: false } })
    expect(w.text()).toContain('no hourly forecast available')
  })

  it('lists hourly reasons on each card', () => {
    const w = mount(ForecastView, { props: props([hour()]) })
    expect(w.text()).toContain('partly cloudy (48%)')
    expect(w.text()).toContain('moon up (90%)')
  })

  it('flags daylight hours as not observing time', () => {
    const hours = [hour({ daylight: true, isDark: false }),
                   hour({ time: '2026-08-31T03:00:00-04:00' })]
    const w = mount(ForecastView, { props: props(hours) })
    const cards = w.findAll('.hour-card')
    expect(cards[0].classes()).toContain('daylight')
    expect(cards[0].text()).toContain('sun up')
    expect(cards[1].classes()).not.toContain('daylight')
    expect(cards[1].text()).not.toContain('sun up')
  })

  it('shows the night-times card when twilight is present', () => {
    const tw = { sunset: '2026-08-30T19:27:00-04:00', sunrise: '2026-08-31T07:13:00-04:00',
                 astroDusk: '2026-08-30T20:46:00-04:00', astroDawn: '2026-08-31T05:54:00-04:00' }
    const w = mount(ForecastView, { props: { ...props([hour()]), twilight: tw } })
    expect(w.findComponent(NightTimes).exists()).toBe(true)
    expect(w.text()).toContain('7:27 PM')
  })

  it('omits the night-times card when twilight is absent', () => {
    const w = mount(ForecastView, { props: props([hour()]) })
    expect(w.findComponent(NightTimes).exists()).toBe(false)
  })
})