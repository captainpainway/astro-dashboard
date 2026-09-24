import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TargetTable from '../src/components/TargetTable.vue'

const night = { startLocal: '2026-08-30T21:00:00-04:00', endLocal: '2026-08-31T05:00:00-04:00' }
const targets = [
  { id: 'SS Cyg', name: 'SS Cyg', targetClass: 'variable', score: 81.1, maxAlt: 75.1,
    bestTime: '2026-08-31T00:30:00-04:00',
    window: { start: night.startLocal, end: night.endLocal },
    altAtBest: 75.1, azAtBest: 2, moonInterference: 0, notes: 'dwarf nova' },
  { id: 'M13', name: 'M13', targetClass: 'cluster', score: 60, maxAlt: 88,
    bestTime: '2026-08-30T23:00:00-04:00',
    window: { start: night.startLocal, end: night.endLocal },
    altAtBest: 88, azAtBest: 330, moonInterference: 0.7, notes: 'globular' },
]

describe('TargetTable', () => {
  it('renders one row per target sorted by score desc', () => {
    const w = mount(TargetTable, { props: { targets, night, sortKey: 'score' } })
    const rows = w.findAll('tr.data-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('SS Cyg')
  })

  it('expands a row on click revealing notes and timeline', async () => {
    const w = mount(TargetTable, { props: { targets, night, sortKey: 'score' } })
    await w.find('tr.data-row').trigger('click')
    expect(w.text()).toContain('dwarf nova')
    expect(w.find('.mini-timeline').exists()).toBe(true)
  })

  it('colors high moon interference as bad', () => {
    const w = mount(TargetTable, { props: { targets, night, sortKey: 'score' } })
    expect(w.text()).toContain('70%')
  })

  it('shows cardinal direction and azimuth degrees together in one AZ column', () => {
    const w = mount(TargetTable, { props: { targets, night, sortKey: 'score' } })
    const headings = w.findAll('th').map(h => h.text().toLowerCase())
    expect(headings).toContain('az')
    expect(headings).not.toContain('dir')
    const ssCygAz = w.findAll('tr.data-row')[0].find('td.az')
    expect(ssCygAz.text()).toContain('N')
    expect(ssCygAz.text()).toContain('2°')
  })

  it('colors class badges by target class', () => {
    const w = mount(TargetTable, { props: { targets, night, sortKey: 'score' } })
    const badges = w.findAll('.badge')
    expect(badges[0].classes()).toContain('cls-variable')
    expect(badges[1].classes()).toContain('cls-cluster')
  })

  it('marks every other row for alternating shading', () => {
    const w = mount(TargetTable, { props: { targets, night, sortKey: 'score' } })
    const rows = w.findAll('tr.data-row')
    expect(rows[0].classes()).not.toContain('alt')
    expect(rows[1].classes()).toContain('alt')
  })

  it('explains the moon interference thresholds', () => {
    const w = mount(TargetTable, { props: { targets, night, sortKey: 'score' } })
    const moonTh = w.findAll('th').find(h => h.text().toLowerCase() === 'moon')
    expect(moonTh.attributes('title')).toMatch(/20%.*50%/)
    expect(w.find('.moon-legend').exists()).toBe(true)
  })

  it('shows the top 25 targets until "show all" is clicked', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...targets[0], id: `T${i}`, name: `Target ${i}`, score: 90 - i,
    }))
    const w = mount(TargetTable, { props: { targets: many, night, sortKey: 'score' } })
    expect(w.findAll('tr.data-row')).toHaveLength(25)
    const btn = w.find('.show-more')
    expect(btn.text()).toContain('show all 30')
    await btn.trigger('click')
    expect(w.findAll('tr.data-row')).toHaveLength(30)
    await w.find('.show-more').trigger('click')
    expect(w.findAll('tr.data-row')).toHaveLength(25)
  })

  it('omits the "show all" button when everything already fits', () => {
    const w = mount(TargetTable, { props: { targets, night, sortKey: 'score' } })
    expect(w.find('.show-more').exists()).toBe(false)
  })

  it('hides targets with zero or negative scores', () => {
    const withJunk = [
      ...targets,
      { id: 'zero', name: 'Zero Score Target', targetClass: 'planet', score: 0, maxAlt: 30,
        bestTime: '2026-08-30T22:00:00-04:00',
        window: { start: night.startLocal, end: night.endLocal },
        altAtBest: 30, azAtBest: 90, moonInterference: 0, notes: 'hide me' },
      { id: 'neg', name: 'Negative Score Target', targetClass: 'planet', score: -5, maxAlt: 20,
        bestTime: '2026-08-30T22:00:00-04:00',
        window: { start: night.startLocal, end: night.endLocal },
        altAtBest: 20, azAtBest: 270, moonInterference: 0, notes: 'hide me too' },
    ]
    const w = mount(TargetTable, { props: { targets: withJunk, night, sortKey: 'score' } })
    const rows = w.findAll('tr.data-row')
    expect(rows).toHaveLength(2) // only the positive-score targets
    expect(w.text()).not.toContain('Zero Score Target')
    expect(w.text()).not.toContain('Negative Score Target')
  })
})