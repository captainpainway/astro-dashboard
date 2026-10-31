import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
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

// Expanded rows ask Wikipedia for a summary; keep tests offline.
const wikiFetch = vi.fn(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }))
beforeEach(() => vi.stubGlobal('fetch', wikiFetch))
afterEach(() => vi.unstubAllGlobals())

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

describe('TargetTable expanded row (Stellarium-style details)', () => {
  const loc = { name: 'Big Bend National Park, TX', latitude: 29.33, longitude: -103.21, elevationM: 1111,
                timezone: 'America/Chicago' }
  const lagoon = { id: 'M8', name: 'Lagoon Nebula', targetClass: 'nebula', score: 70, maxAlt: 36,
    bestTime: '2026-10-31T19:00:00-05:00', window: { start: '2026-10-31T19:00:00-05:00', end: '2026-10-31T21:30:00-05:00' },
    altAtBest: 36, azAtBest: 200, moonInterference: 0.2, notes: 'Lagoon nebula',
    raHours: 18.0606, decDegrees: -24.3806, magnitude: 6, objectType: 'emission_nebula',
    sizeArcmin: [45, 30], aliases: ['NGC 6523', 'LBN 25'] }
  const nightOct = { startLocal: '2026-10-31T19:00:00-05:00', endLocal: '2026-11-01T06:00:00-05:00' }

  async function open(fetchImpl, target = lagoon) {
    if (fetchImpl) vi.stubGlobal('fetch', fetchImpl)
    const w = mount(TargetTable, { props: { targets: [target], night: nightOct, location: loc, sortKey: 'score' } })
    await w.find('tr.data-row').trigger('click')
    await flushPromises()
    return w
  }

  it('shows type, constellation, magnitude, size, coordinates and rise/transit/set', async () => {
    const text = (await open()).find('.target-detail').text()
    expect(text).toContain('emission nebula in Sagittarius')
    expect(text).toContain('6.0')
    expect(text).toContain('45′ × 30′')
    expect(text).toMatch(/18h 03m 38\.2s\s+−24° 22′ 50″/)
    for (const label of ['az / alt', 'hour angle', 'RA / Dec (J2000)', 'RA / Dec (of date)', 'rise · transit · set'])
      expect(text).toContain(label)
  })

  it('lists the catalogue id first among the other names', async () => {
    const names = (await open()).findAll('.td-alias').map((a) => a.text())
    expect(names).toEqual(['M8', 'NGC 6523', 'LBN 25'])
  })

  it('shows the Wikipedia summary, image and link when there is an article', async () => {
    const fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({
      type: 'standard', title: 'Lagoon Nebula', extract: 'The Lagoon Nebula is a giant emission nebula.',
      thumbnail: { source: 'https://upload.wikimedia.org/lagoon.jpg' },
      content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Lagoon_Nebula' } } }) }))
    // Summaries are cached per title for the session, so use one the other tests haven't asked for
    const w = await open(fetch, { ...lagoon, id: 'M17' })
    expect(fetch.mock.calls[0][0]).toContain('/page/summary/Messier_17')
    expect(w.find('.td-extract').text()).toBe('The Lagoon Nebula is a giant emission nebula.')
    expect(w.find('.td-thumb').attributes('src')).toBe('https://upload.wikimedia.org/lagoon.jpg')
    expect(w.find('.td-more a').attributes('href')).toBe('https://en.wikipedia.org/wiki/Lagoon_Nebula')
  })

  it('leaves the summary out when Wikipedia has none', async () => {
    expect((await open()).find('.td-wiki').exists()).toBe(false)
  })
})

describe('TargetTable focus (opened from the sky page)', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ ...targets[1], id: `T${i}`, name: `Target ${i}`, score: 90 - i }))

  it('expands the focused row, showing every target when it is past the top 25, then reports back', async () => {
    const w = mount(TargetTable, { props: { targets: many, night, sortKey: 'score', focusId: 'T28' } })
    await flushPromises()
    expect(w.findAll('tr.data-row')).toHaveLength(30)
    expect(w.find('tr.data-row.open .name').text()).toBe('Target 28')
    expect(w.find('.detail-row').exists()).toBe(true)
    expect(w.emitted('focused')).toHaveLength(1)
  })

  it('ignores an id that is not in the list', async () => {
    const w = mount(TargetTable, { props: { targets, night, sortKey: 'score', focusId: 'nope' } })
    await flushPromises()
    expect(w.find('tr.data-row.open').exists()).toBe(false)
    expect(w.emitted('focused')).toHaveLength(1)
  })
})
