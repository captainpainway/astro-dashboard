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
    const rows = w.findAll('tbody tr.data-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('SS Cyg')
  })

  it('expands a row on click revealing notes and timeline', async () => {
    const w = mount(TargetTable, { props: { targets, night, sortKey: 'score' } })
    await w.find('tbody tr.data-row').trigger('click')
    expect(w.text()).toContain('dwarf nova')
    expect(w.find('.mini-timeline').exists()).toBe(true)
  })

  it('colors high moon interference as bad', () => {
    const w = mount(TargetTable, { props: { targets, night, sortKey: 'score' } })
    expect(w.text()).toContain('70%')
  })
})