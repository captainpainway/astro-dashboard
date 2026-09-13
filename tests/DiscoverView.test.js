import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DiscoverView from '../src/components/DiscoverView.vue'

const night = { startLocal: '2026-08-30T21:00:00-04:00', endLocal: '2026-08-31T05:00:00-04:00', timezone: 'America/New_York' }

function star(over = {}) {
  return {
    name: 'V1452 Tau', auid: '000-BQP-885', oid: '10875985', constellation: 'Tau', varType: 'N',
    periodDays: null, maxMag: 8.7, minMag: 23.4, magBand: 'V',
    raHours: 5.35, decDegrees: 23.64, ...over,
  }
}

function target(over = {}) {
  return {
    star: star(),
    score: 55.8, maxAlt: 47.1, bestTime: '2026-08-31T05:00:00-04:00',
    window: { start: '2026-08-31T02:45:00-04:00', end: '2026-08-31T05:00:00-04:00' },
    azAtBest: 85, chartId: null, chartUrl: null, ...over,
  }
}

const props = (targets) => ({ targets, night, loading: false })

describe('DiscoverView', () => {
  it('renders one row per star with name, type, constellation', () => {
    const w = mount(DiscoverView, { props: props([target(), target({ star: star({ name: 'V8055 Sgr', constellation: 'Sgr' }) })]) })
    const rows = w.findAll('tbody tr.data-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('V1452 Tau')
    expect(rows[0].text()).toContain('N')
    expect(rows[0].text()).toContain('Tau')
  })

  it('renders the magnitude range with band', () => {
    const w = mount(DiscoverView, { props: props([target()]) })
    expect(w.text()).toContain('8.7–23.4 V')
  })

  it('renders period days when present, em-dash when null', () => {
    const w = mount(DiscoverView, {
      props: props([target(), target({ star: star({ periodDays: 4.21 }) })]),
    })
    expect(w.text()).toContain('4.21 d')
  })

  it('hides zero/negative-scored stars', () => {
    const w = mount(DiscoverView, {
      props: props([target(), target({ star: star({ name: 'Junk Star' }), score: 0 })]),
    })
    expect(w.findAll('tbody tr.data-row')).toHaveLength(1)
    expect(w.text()).not.toContain('Junk Star')
  })

  it('expands a row on click revealing window, coordinates, and chart link', async () => {
    const w = mount(DiscoverView, {
      props: props([target({ chartId: 'X42882PV', chartUrl: 'https://app.aavso.org/vsp/X42882PV' })]),
    })
    await w.find('tbody tr.data-row').trigger('click')
    const detail = w.find('.detail-row')
    expect(detail.text()).toContain('2:45 AM')
    expect(detail.text()).toContain('RA 5h 21m')
    expect(detail.text()).toContain('Dec +23.6°')
    const link = w.find('.chart-link')
    expect(link.attributes('href')).toBe('https://app.aavso.org/vsp/X42882PV')
    expect(link.text()).toContain('X42882PV')
  })

  it('links the AUID to the star VSX detail page', async () => {
    const w = mount(DiscoverView, { props: props([target()]) })
    await w.find('tbody tr.data-row').trigger('click')
    const link = w.find('.vsx-link')
    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('000-BQP-885')
    expect(link.attributes('href')).toBe('https://vsx.aavso.org/index.php?view=detail.top&oid=10875985')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
  })

  it('renders the AUID as plain text when no oid is known', async () => {
    const w = mount(DiscoverView, { props: props([target({ star: star({ oid: null }) })]) })
    await w.find('tbody tr.data-row').trigger('click')
    expect(w.find('.vsx-link').exists()).toBe(false)
    expect(w.find('.detail-row').text()).toContain('000-BQP-885')
  })

  it('shows no chart link when chartUrl is null', async () => {
    const w = mount(DiscoverView, { props: props([target()]) })
    await w.find('tbody tr.data-row').trigger('click')
    expect(w.find('.chart-link').exists()).toBe(false)
  })

  it('shows loading placeholder', () => {
    const w = mount(DiscoverView, { props: { targets: [], night, loading: true } })
    expect(w.text()).toContain('loading discovered stars…')
  })

  it('shows empty state when loaded but no stars', () => {
    const w = mount(DiscoverView, { props: { targets: [], night, loading: false } })
    expect(w.text()).toContain('no under-observed stars found')
  })
})