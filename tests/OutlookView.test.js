import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import OutlookView from '../src/components/OutlookView.vue'

function hour(over = {}) {
  return {
    time: '2026-09-01T23:00:00-04:00', tempF: 76, dewpointF: 75, skyCover: 48, windMph: 5,
    windDir: 'NE', humidity: 90, precipProb: 2, shortForecast: 'Partly Cloudy',
    sunAlt: -40, moonAlt: 47.6, moonIllum: 0.73, twilightPhase: 'dark', moonUp: true,
    isDark: true, rating: 'fair', reasons: ['partly cloudy (48%)'], score: 45,
    ...over,
  }
}

function night(over = {}) {
  return {
    date: '2026-09-01', label: 'Tonight',
    start: '2026-09-01T20:00:00-04:00', end: '2026-09-02T06:00:00-04:00',
    tempF: 75.0, windMph: 5.0, windDir: 'NE', cloudCover: 46.5, cloudSource: 'grid',
    precipProb: 19, shortForecast: 'Slight Chance Showers And Thunderstorms then Partly Cloudy',
    moonIllum: 0.73, moonUpFraction: 0.75, darkHours: 2.5,
    rating: 'fair', reasons: ['partly cloudy (46%)', 'moon up ~8h of 10h (73%)'],
    score: 52.0, hours: [hour(), hour({ time: '2026-09-02T00:00:00-04:00', score: 70, rating: 'good' })],
    ...over,
  }
}

const props = (nights, loading = false) => ({ nights, loading })

describe('OutlookView', () => {
  it('renders one panel per night with label, window, and rating chip', () => {
    const w = mount(OutlookView, { props: props([night(), night({ date: '2026-09-02', label: 'Wednesday Night' })]) })
    const panels = w.findAll('.outlook-night')
    expect(panels).toHaveLength(2)
    expect(panels[0].find('h2').text()).toBe('Tonight')
    expect(panels[1].find('h2').text()).toBe('Wednesday Night')
    expect(panels[0].find('.rating').classes()).toContain('rating-fair')
    expect(panels[0].text()).toContain('8:00 PM – 6:00 AM')
    expect(panels[0].text()).toContain('52')
  })

  it('renders headline stats, moon percentages, and reasons', () => {
    const w = mount(OutlookView, { props: props([night()]) })
    const text = w.text()
    expect(text).toContain('47%') // cloud
    expect(text).toContain('75°F')
    expect(text).toContain('5 mph NE')
    expect(text).toContain('19%') // precip
    expect(text).toContain('73% · up 75%') // moon illum · moonUpFraction
    expect(text).toContain('2.5h')
    expect(text).toContain('moon up ~8h of 10h (73%)')
  })

  it('renders hourly chips styled like the home hourly strip', () => {
    const w = mount(OutlookView, { props: props([night()]) })
    const chips = w.findAll('.hour-chip')
    expect(chips).toHaveLength(2)
    expect(chips[0].classes()).toContain('rc-fair')
    expect(chips[1].classes()).toContain('rc-good')
    expect(chips[1].classes()).toContain('best') // highest-scoring dark hour
    expect(chips[0].find('.hour-chip-emoji').text()).not.toBe('')
  })

  it('dims non-dark hours and only marks dark hours as best', () => {
    const n = night({ hours: [
      hour({ isDark: false, twilightPhase: 'civil twilight', score: 10, rating: 'bad' }),
      hour({ time: '2026-09-02T01:00:00-04:00', score: 60 }),
    ] })
    const w = mount(OutlookView, { props: props([n]) })
    const chips = w.findAll('.hour-chip')
    expect(chips[0].classes()).toContain('not-dark')
    expect(chips[1].classes()).not.toContain('not-dark')
    expect(chips[1].classes()).toContain('best')
    expect(chips[0].classes()).not.toContain('best')
  })

  it('shows placeholder when a night has no hourly detail', () => {
    const w = mount(OutlookView, { props: props([night({ hours: [] })]) })
    expect(w.text()).toContain('no hourly detail for this night')
  })

  it('marks text-sourced cloud estimates', () => {
    const w = mount(OutlookView, { props: props([night({ cloudSource: 'text', cloudCover: 40 })]) })
    expect(w.find('.outlook-stats').text()).toContain('40% ~')
  })

  it('shows loading and empty placeholders', () => {
    expect(mount(OutlookView, { props: { nights: [], loading: true } }).text()).toContain('loading outlook…')
    expect(mount(OutlookView, { props: { nights: [], loading: false } }).text()).toContain('no nightly outlook available')
  })

  it('opens only tonight, even when a later night scores higher', () => {
    const nights = [
      night({ date: '2026-09-01', score: 40 }),
      night({ date: '2026-09-02', score: 20 }),
      night({ date: '2026-09-03', score: 80 }),
    ]
    const w = mount(OutlookView, { props: props(nights) })
    const open = w.findAll('.outlook-night').map((p) => p.element.open)
    expect(open).toEqual([true, false, false])
  })

  it('shows a compact glance line in the summary', () => {
    const w = mount(OutlookView, { props: props([night()]) })
    const glance = w.find('summary .outlook-glance').text()
    expect(glance).toContain('47%')
    expect(glance).toContain('73%')
    expect(glance).toContain('2.5h moonless')
  })

  it('renders one strip segment per hour with rating classes and best marker', () => {
    const w = mount(OutlookView, { props: props([night()]) })
    const segs = w.findAll('summary .outlook-strip span')
    expect(segs).toHaveLength(2)
    expect(segs[0].classes()).toContain('rc-fair')
    expect(segs[1].classes()).toContain('rc-good')
    expect(segs[1].classes()).toContain('best')
  })

  it('keeps user toggles across a refresh with the same nights', async () => {
    const nights = [night({ date: '2026-09-01' }), night({ date: '2026-09-02', score: 10 })]
    const w = mount(OutlookView, { props: props(nights) })
    const first = w.findAll('.outlook-night')[0]
    first.element.open = false
    await first.trigger('toggle')
    const second = w.findAll('.outlook-night')[1]
    second.element.open = true
    await second.trigger('toggle')

    await w.setProps({ nights: nights.map((n) => ({ ...n })) })
    expect(w.findAll('.outlook-night').map((p) => p.element.open)).toEqual([false, true])
  })
  describe('summary click', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('opens a closed night right away', async () => {
      const nights = [night({ date: '2026-09-01' }), night({ date: '2026-09-02' })]
      const w = mount(OutlookView, { props: props(nights), attachTo: document.body })
      await w.findAll('.outlook-night summary')[1].trigger('click')
      expect(w.findAll('.outlook-night')[1].element.open).toBe(true)
      w.unmount()
    })

    it('keeps a night rendered while it animates shut', async () => {
      const w = mount(OutlookView, { props: props([night()]), attachTo: document.body })
      await w.find('.outlook-night summary').trigger('click')
      const panel = w.find('.outlook-night')
      expect(panel.element.open).toBe(true)
      expect(panel.classes()).toContain('closing')
      w.unmount()
    })

    it('closes immediately when reduced motion is preferred', async () => {
      vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce') }))
      const w = mount(OutlookView, { props: props([night()]) })
      await w.find('.outlook-night summary').trigger('click')
      expect(w.find('.outlook-night').element.open).toBe(false)
    })
  })
})
