import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LunarView from '../src/components/LunarView.vue'

const feature = (over = {}) => ({
  id: 'copernicus', name: 'Copernicus', tier: 'binoculars', kind: 'place', type: 'Crater', ageDays: 10, lat: 9.62, lon: -20.08,
  score: 80, sunAlt: 10.4, moonAlt: 41.2, bestTime: '2026-08-31T01:00:00-04:00', reason: 'terminator, Sun 10°', ...over,
})
const features = [
  feature({ id: 'mare-imbrium', name: 'Mare Imbrium', tier: 'eyes', type: 'Mare', score: 90, sunAlt: 6 }),
  feature(),
  feature({ id: 'rupes-recta', name: 'Rupes Recta', tier: 'telescope', type: 'Rupes', score: 70, sunAlt: 4 }),
]
const moon = { maxAlt: 40, note: 'First Quarter (46% illuminated)' }
const mountView = (props) => mount(LunarView, { props: { features, moon, loading: false, ...props } })
const tab = (w, label) => w.findAll('.tabs button').find((b) => b.text().startsWith(label))

describe('LunarView', () => {
  it('renders one row per feature with name, reason, rounded Sun altitude and best time, but no Moon column', () => {
    const w = mountView()
    const rows = w.findAll('tr.data-row')
    expect(rows).toHaveLength(3)
    expect(rows[1].text()).toContain('Copernicus')
    expect(rows[1].text()).toContain('terminator, Sun 10°')
    expect(rows[1].text()).toContain('1:00 AM')
    expect(rows[1].text()).not.toContain('41°') // the Moon's altitude is folded into the score, not shown
    expect(w.findAll('th').map((th) => th.text())).toEqual(['', 'feature', 'tier', 'score', 'sun', 'best time', 'why'])
  })

  it('draws the score as a number plus a meter whose bar width is the score', () => {
    const cell = mountView().findAll('tr.data-row')[1].find('td.score')
    expect(cell.find('.score-num').text()).toBe('80')
    expect(cell.find('.score-track .score-bar').attributes('style')).toContain('width: 80%')
  })

  it('mirrors the tonight list: panel wrapper, tier-coloured badges, alternating rows', () => {
    const w = mountView()
    expect(w.find('.targets-panel.panel table.targets').exists()).toBe(true)
    expect(w.findAll('tr.data-row .badge').map((b) => b.classes()).map((c) => c.find((x) => x.startsWith('tier-'))))
      .toEqual(['tier-eyes', 'tier-binoculars', 'tier-telescope'])
    const rows = w.findAll('tr.data-row')
    expect(rows.map((r) => r.classes().includes('alt'))).toEqual([false, true, false])
  })

  it('expands a row on click to show its type, AL age group and the Moon altitude, and collapses on a second click', async () => {
    const w = mountView()
    expect(w.find('.detail-row').exists()).toBe(false)
    await w.findAll('tr.data-row')[1].trigger('click')
    expect(w.find('.detail-row').text()).toContain('Crater')
    expect(w.find('.detail-row').text()).toContain('~10 days old')
    expect(w.find('.detail-row').text()).toContain('9.62°N 20.08°W')
    expect(w.find('.detail-row').text()).toContain('Moon 41° up')
    await w.findAll('tr.data-row')[1].trigger('click')
    expect(w.find('.detail-row').exists()).toBe(false)
  })

  it('says a phase row has no fixed place when expanded', async () => {
    const w = mountView({ features: [feature({ kind: 'phase', type: null, ageDays: null, sunAlt: null, name: 'Man in the Moon' })] })
    await w.find('tr.data-row').trigger('click')
    expect(w.find('.detail-row').text()).toContain('no fixed place')
  })

  it('caps the list at 25 rows with a show-all toggle, like the tonight list', async () => {
    const many = Array.from({ length: 27 }, (_, i) => feature({ id: `f${i}`, name: `Feature ${i}`, score: 90 - i }))
    const w = mountView({ features: many })
    expect(w.findAll('tr.data-row')).toHaveLength(25)
    expect(w.find('.show-more').text()).toBe('show all 27 features')
    await w.find('.show-more').trigger('click')
    expect(w.findAll('tr.data-row')).toHaveLength(27)
    expect(w.find('.show-more').text()).toBe('show top 25')
    expect(mountView().find('.show-more').exists()).toBe(false)
  })

  it('shows the Moon note and a count per tier tab', () => {
    const w = mountView()
    expect(w.text()).toContain('First Quarter (46% illuminated)')
    expect(w.findAll('.tabs button').map((b) => b.text())).toEqual(
      ['all (3)', 'eyes-only (1)', 'binoculars (1)', 'telescope (1)'])
  })

  it('filters by tier and returns to all', async () => {
    const w = mountView()
    await tab(w, 'binoculars').trigger('click')
    expect(w.findAll('tr.data-row').map((r) => r.text())).toEqual([expect.stringContaining('Copernicus')])
    await tab(w, 'all').trigger('click')
    expect(w.findAll('tr.data-row')).toHaveLength(3)
  })

  it('shows a dash for features with no place (phase rows)', () => {
    const w = mountView({ features: [feature({ kind: 'phase', type: null, sunAlt: null, name: 'Man in the Moon' })] })
    expect(w.find('tr.data-row').text()).toContain('—')
  })

  it('explains an empty list: Moon down vs too close to new', () => {
    expect(mountView({ features: [], moon: { maxAlt: 4 } }).text()).toContain('below 10°')
    expect(mountView({ features: [], moon: { maxAlt: 40 } }).text()).toContain('too close to new')
  })

  it('names the tier when only that tier has nothing, instead of the Moon message', async () => {
    const w = mountView({ features: [features[0]] })
    await tab(w, 'telescope').trigger('click')
    expect(w.text()).toContain('no telescope features are well placed tonight')
    expect(w.text()).not.toContain('below 10°')
  })

  it('shows loading text while empty and loading, and copes with no Moon data', () => {
    expect(mountView({ features: [], loading: true }).text()).toContain('loading lunar features')
    expect(() => mountView({ moon: null })).not.toThrow()
  })
})

describe('LunarView moon map', () => {
  const stubGl = () => {
    vi.stubGlobal('WebGLRenderingContext', function () {})
    const gl = new Proxy({}, { get: () => () => ({}) }) // every GL call is a no-op
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl)
  }
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers() })
  const dots = (w) => w.findAll('.moon-dot')
  const atPlace = (id, name, lat, lon, over = {}) => feature({ id, name, lat, lon, ...over })
  const spread = [atPlace('mare-imbrium', 'Mare Imbrium', 30, -20, { tier: 'eyes' }),
    atPlace('copernicus', 'Copernicus', 9.6, -20, { tier: 'binoculars' }),
    atPlace('rupes-recta', 'Rupes Recta', -22, -8, { tier: 'telescope' })]

  it('draws one dot per near-side feature, labelled with its name', () => {
    stubGl()
    const w = mountView({ features: [atPlace('a', 'Alpha', 10, 20), atPlace('b', 'Beta', -30, -60)] })
    expect(w.find('.moon-map canvas').exists()).toBe(true)
    expect(dots(w).map((d) => d.attributes('aria-label'))).toEqual(['Alpha', 'Beta'])
  })

  it('gives no dot to far-side features or phase rows, but does to lat 0 / lon 0', () => {
    stubGl()
    const w = mountView({ features: [
      atPlace('far', 'Far side', 10, 180), atPlace('mid', 'Centre', 0, 0),
      feature({ id: 'p', name: 'Man in the Moon', kind: 'phase', lat: undefined, lon: undefined })] })
    expect(dots(w).map((d) => d.attributes('aria-label'))).toEqual(['Centre'])
  })

  it('follows the tier filter', async () => {
    stubGl()
    const w = mountView({ features: spread })
    expect(dots(w)).toHaveLength(3)
    await tab(w, 'binoculars').trigger('click')
    expect(dots(w)).toHaveLength(1)
  })

  it('opens a tooltip with the feature name on click, and closes it on outside click or Esc', async () => {
    stubGl()
    const w = mountView({ features: [atPlace('a', 'Alpha', 10, 20), atPlace('b', 'Beta', -30, -60)] })
    expect(w.find('.moon-tip').exists()).toBe(false)
    await dots(w)[1].trigger('click')
    expect(w.find('.moon-tip').text()).toBe('Beta')
    document.dispatchEvent(new MouseEvent('click'))
    await flushPromises()
    expect(w.find('.moon-tip').exists()).toBe(false)
    await dots(w)[0].trigger('click')
    expect(w.find('.moon-tip').text()).toBe('Alpha')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(w.find('.moon-tip').exists()).toBe(false)
  })

  it('closes the tooltip when the tier filter removes its feature', async () => {
    stubGl()
    const w = mountView({ features: spread })
    await dots(w)[0].trigger('click') // Mare Imbrium (eyes)
    expect(w.find('.moon-tip').exists()).toBe(true)
    await tab(w, 'telescope').trigger('click')
    expect(w.find('.moon-tip').exists()).toBe(false)
  })

  it('renders no map and no dots without WebGL, and the table still works', () => {
    const w = mountView() // jsdom has no WebGLRenderingContext
    expect(w.find('.moon-map').exists()).toBe(false)
    expect(w.findAll('tr.data-row')).toHaveLength(3)
  })

  it('hides the whole map when the texture fails to load', async () => {
    stubGl()
    vi.stubGlobal('Image', class { set src(_) { queueMicrotask(() => this.onerror?.()) } })
    const w = mountView()
    await flushPromises()
    expect(w.find('.moon-map').exists()).toBe(false)
  })

  it('merges features at the same spot into one dot that names them all', async () => {
    stubGl()
    const w = mountView({ features: [atPlace('a', 'Clavius', -58.4, -14.4), atPlace('b', 'Clavius craterlets', -58.4, -14.4),
                                     atPlace('c', 'Copernicus', 9.6, -20)] })
    expect(dots(w).map((d) => d.attributes('aria-label'))).toEqual(['Clavius · Clavius craterlets', 'Copernicus'])
    await dots(w)[0].trigger('click')
    expect(w.find('.moon-tip').text()).toBe('Clavius · Clavius craterlets')
  })

  it('redraws the Moon for the new time when the lunar data is reloaded', async () => {
    stubGl()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-10T00:00:00Z'))
    const w = mountView({ features: [atPlace('a', 'Near limb', 0, 60)], moon: { note: 'a' } })
    const before = dots(w)[0].attributes('style')
    vi.setSystemTime(new Date('2026-10-17T00:00:00Z')) // libration has moved a few degrees
    await w.setProps({ moon: { note: 'b' } })
    expect(dots(w)[0].attributes('style')).not.toBe(before)
  })
})
