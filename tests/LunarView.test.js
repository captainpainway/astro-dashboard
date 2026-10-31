import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { moonVisibleTimes } from '../src/engine/moonview'
import LunarView from '../src/components/LunarView.vue'
import lunarWiki from '../src/engine/lunarWiki.json'

const feature = (over = {}) => ({
  id: 'copernicus', name: 'Copernicus', tier: 'binoculars', kind: 'place', type: 'Crater', ageDays: 10, lat: 9.62, lon: -20.08,
  score: 80, sunAlt: 10.4, moonAlt: 41.2, bestTime: '2026-08-31T01:00:00-04:00', reason: 'terminator, Sun 10°', ...over,
})
const features = [
  feature({ id: 'mare-imbrium', name: 'Mare Imbrium', tier: 'eyes', type: 'Mare', score: 90, sunAlt: 6 }),
  feature(),
  feature({ id: 'rupes-recta', name: 'Rupes Recta', tier: 'telescope', type: 'Rupes', score: 70, sunAlt: 4 }),
]
const location = { latitude: 40, longitude: -75, timezone: 'America/New_York' }
const moon = { maxAlt: 40, note: 'First Quarter (46% illuminated)' }
const mountView = (props) => mount(LunarView, { props: { features, moon, location, loading: false, ...props } })
const tab = (w, label) => w.findAll('[aria-label="instrument tier"] button').find((b) => b.text().startsWith(label))

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

  it('adds the bundled Wikipedia summary and photo to an expanded row that names an article, without a request', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const copernicus = lunarWiki['Copernicus (lunar crater)']
    const w = mountView({ features: [feature({ wiki: 'Copernicus (lunar crater)' }), feature({ id: 'x', name: 'No article' })] })
    await w.findAll('tr.data-row')[0].trigger('click')
    await vi.waitFor(() => expect(w.find('.detail-row .td-wiki').exists()).toBe(true))
    const block = w.find('.detail-row .td-wiki')
    expect(block.text()).toContain(copernicus.extract.slice(0, 40))
    expect(block.find('img').attributes('src')).toBe(copernicus.thumbnail)
    expect(block.find('a').attributes('href')).toBe(copernicus.url)
    expect(block.text()).toContain('CC BY-SA 4.0')
    expect(w.find('.detail-row').text()).toContain('~10 days old') // the facts stay above it

    await w.findAll('tr.data-row')[1].trigger('click')
    await flushPromises()
    expect(w.find('.detail-row .td-wiki').exists()).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
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
    expect(w.findAll('[aria-label="instrument tier"] button').map((b) => b.text())).toEqual(
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

const stubGl = () => {
  vi.stubGlobal('WebGLRenderingContext', function () {})
  const gl = new Proxy({}, { get: () => () => ({}) }) // every GL call is a no-op
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl)
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers() })
const toggle = (w, label) => w.findAll('.view-toggle button').find((b) => b.text() === label)
const mountMap = async (props) => {
  const w = mountView(props)
  await toggle(w, 'map').trigger('click')
  return w
}

describe('LunarView list/map toggle', () => {
  it('opens on the list: table shown, no map, list button active', () => {
    stubGl()
    const w = mountView()
    expect(w.findAll('.view-toggle button').map((b) => b.text())).toEqual(['list', 'map'])
    expect(toggle(w, 'list').classes()).toContain('active')
    expect(w.find('.targets-panel').exists()).toBe(true)
    expect(w.find('.moon-map').exists()).toBe(false)
  })

  it('swaps the table for the map and back, keeping the Moon note and the tier filter', async () => {
    stubGl()
    const w = mountView({ features: [feature({ id: 'a', name: 'Alpha', lat: 10, lon: 20, tier: 'eyes' }),
                                     feature({ id: 'b', name: 'Beta', lat: -30, lon: -60, tier: 'telescope' })] })
    await toggle(w, 'map').trigger('click')
    expect(w.find('.targets-panel').exists()).toBe(false)
    expect(w.findAll('.moon-dot')).toHaveLength(2)
    expect(w.text()).toContain('First Quarter')
    await tab(w, 'telescope').trigger('click')
    expect(w.findAll('.moon-dot')).toHaveLength(1)
    await toggle(w, 'list').trigger('click')
    expect(w.find('.moon-map').exists()).toBe(false)
    expect(w.findAll('tr.data-row')).toHaveLength(1)
  })

  it('keeps an expanded row open across a toggle', async () => {
    stubGl()
    const w = mountView()
    await w.findAll('tr.data-row')[1].trigger('click')
    await toggle(w, 'map').trigger('click')
    await toggle(w, 'list').trigger('click')
    expect(w.find('.detail-row').exists()).toBe(true)
  })

  it('falls back to the list and drops the toggle when WebGL is missing', async () => {
    const w = await mountMap() // jsdom has no WebGLRenderingContext
    expect(w.find('.moon-map').exists()).toBe(false)
    expect(w.findAll('tr.data-row')).toHaveLength(3)
    expect(w.find('.view-toggle').exists()).toBe(false)
  })

  it('falls back to the list and drops the toggle when the texture fails to load', async () => {
    stubGl()
    vi.stubGlobal('Image', class { set src(_) { queueMicrotask(() => this.onerror?.()) } })
    const w = await mountMap()
    await flushPromises()
    expect(w.find('.moon-map').exists()).toBe(false)
    expect(w.findAll('tr.data-row')).toHaveLength(3)
    expect(w.find('.view-toggle').exists()).toBe(false)
  })
})

describe('LunarView moon map', () => {
  const dots = (w) => w.findAll('.moon-dot')
  const atPlace = (id, name, lat, lon, over = {}) => feature({ id, name, lat, lon, ...over })
  const spread = [atPlace('mare-imbrium', 'Mare Imbrium', 30, -20, { tier: 'eyes' }),
    atPlace('copernicus', 'Copernicus', 9.6, -20, { tier: 'binoculars' }),
    atPlace('rupes-recta', 'Rupes Recta', -22, -8, { tier: 'telescope' })]

  it('draws one dot per near-side feature, labelled with its name', async () => {
    stubGl()
    const w = await mountMap({ features: [atPlace('a', 'Alpha', 10, 20), atPlace('b', 'Beta', -30, -60)] })
    expect(w.find('.moon-map canvas').exists()).toBe(true)
    expect(dots(w).map((d) => d.attributes('aria-label'))).toEqual(['Alpha', 'Beta'])
  })

  it('gives no dot to far-side features or phase rows, but does to lat 0 / lon 0', async () => {
    stubGl()
    const w = await mountMap({ features: [
      atPlace('far', 'Far side', 10, 180), atPlace('mid', 'Centre', 0, 0),
      feature({ id: 'p', name: 'Man in the Moon', kind: 'phase', lat: undefined, lon: undefined })] })
    expect(dots(w).map((d) => d.attributes('aria-label'))).toEqual(['Centre'])
  })

  it('follows the tier filter', async () => {
    stubGl()
    const w = await mountMap({ features: spread })
    expect(dots(w)).toHaveLength(3)
    await tab(w, 'binoculars').trigger('click')
    expect(dots(w)).toHaveLength(1)
  })

  const reduceMotion = () => vi.stubGlobal('matchMedia', () => ({ matches: true })) // GSAP tweens finish at once

  it('shows a tooltip with the feature name and its details on hover, and hides it on mouse-out or Esc', async () => {
    stubGl()
    reduceMotion()
    const w = await mountMap({ features: [atPlace('a', 'Alpha', 10, 20), atPlace('b', 'Beta', -30, -60)] })
    expect(w.find('.moon-tip').exists()).toBe(false)
    await dots(w)[1].trigger('mouseenter')
    expect(w.find('.moon-tip').text()).toContain('Beta')
    expect(w.find('.moon-tip').text()).toContain('Best at 1:00 AM')
    await dots(w)[1].trigger('mouseleave')
    await flushPromises()
    expect(w.find('.moon-tip').exists()).toBe(false)
    await dots(w)[0].trigger('focus')
    expect(w.find('.moon-tip').text()).toContain('Alpha')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(w.find('.moon-tip').exists()).toBe(false)
  })

  it('closes the tooltip when the tier filter removes its feature', async () => {
    stubGl()
    reduceMotion()
    const w = await mountMap({ features: spread })
    await dots(w)[0].trigger('mouseenter') // Mare Imbrium (eyes)
    expect(w.find('.moon-tip').exists()).toBe(true)
    await tab(w, 'telescope').trigger('click')
    await flushPromises()
    expect(w.find('.moon-tip').exists()).toBe(false)
  })

  it('merges features at the same spot into one dot whose tooltip lists them all', async () => {
    stubGl()
    const w = await mountMap({ features: [atPlace('a', 'Clavius', -58.4, -14.4), atPlace('b', 'Clavius craterlets', -58.4, -14.4),
                                          atPlace('c', 'Copernicus', 9.6, -20)] })
    expect(dots(w).map((d) => d.attributes('aria-label'))).toEqual(['Clavius, Clavius craterlets', 'Copernicus'])
    await dots(w)[0].trigger('mouseenter')
    expect(w.findAll('.moon-tip-item').map((i) => i.find('strong').text())).toEqual(['Clavius', 'Clavius craterlets'])
  })

  it('starts north-up; the sky view adds a time dropdown (now, moonrise to moonset) and turns the Moon', async () => {
    stubGl()
    reduceMotion()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T23:00:00Z'))
    const w = await mountMap({ features: [atPlace('a', 'Alpha', 10, 20)] })
    const modes = () => w.findAll('[aria-label="orientation"] button')
    expect(modes().map((b) => b.text())).toEqual(['north up', 'sky view'])
    expect(modes()[0].classes()).toContain('active')
    expect(w.find('.moon-controls .glass-select').exists()).toBe(false)
    const northUp = dots(w)[0].attributes('style')

    await modes()[1].trigger('click')
    expect(dots(w)[0].attributes('style')).not.toBe(northUp)
    await w.find('.glass-select-trigger').trigger('click')
    const opts = w.findAll('[role="option"]').map((o) => o.text())
    expect(opts[0]).toBe('now')
    expect(opts[1]).toMatch(/^moonrise /)
    expect(opts.at(-1)).toMatch(/^moonset /)

    const atNow = dots(w)[0].attributes('style')
    await w.findAll('[role="option"]').at(-1).trigger('click') // moonset
    expect(dots(w)[0].attributes('style')).not.toBe(atNow)

    await modes()[0].trigger('click')
    expect(dots(w)[0].attributes('style')).toBe(northUp)
  })

  it('in the sky view says the Moon is below the horizon, or else gives its altitude and azimuth', async () => {
    stubGl()
    vi.useFakeTimers({ toFake: ['Date'] })
    const times = moonVisibleTimes(location, new Date('2026-10-03T23:00:00Z'))
    const sky = async (now) => {
      vi.setSystemTime(now)
      const w = await mountMap({ features: [atPlace('a', 'Alpha', 10, 20)] })
      expect(w.find('[role="status"]').exists()).toBe(false) // north-up: nothing
      await w.findAll('[aria-label="orientation"] button')[1].trigger('click')
      return w.find('[role="status"]').text()
    }
    expect(await sky(new Date(times[0].date - 2 * 3_600_000))).toContain('below the horizon')
    expect(await sky(times[3].date)).toMatch(/^Moon altitude \d+° · azimuth \d+° [NESW]{1,3}$/)
  })

  it('turns the Moon gradually, not in one jump, when the orientation changes', async () => {
    stubGl()
    const w = await mountMap({ features: [atPlace('a', 'Alpha', 10, 20)] })
    const style = () => dots(w)[0].attributes('style')
    const northUp = style()
    await w.findAll('[aria-label="orientation"] button')[1].trigger('click')
    expect(style()).toBe(northUp) // the turn has begun, not finished
    await vi.waitFor(() => expect(style()).not.toBe(northUp), { timeout: 3000 })
    const mid = style()
    await vi.waitFor(() => expect(style()).not.toBe(mid), { timeout: 3000 }) // still moving after the first change
  })

  it('zooms the Moon out in 10% steps to 50% and back, or jumps to either end, disabling buttons at the limits', async () => {
    stubGl()
    reduceMotion()
    const w = await mountMap({ features: [atPlace('a', 'Alpha', 10, 20)] })
    const btn = (label) => w.find(`.zoom [aria-label="${label}"]`)
    const zoom = () => w.find('.moon-map').attributes('style')
    expect(zoom() ?? '').not.toContain('--zoom') // starts at the stylesheet's full width
    expect(['zoom in', 'full size'].map((l) => btn(l).attributes('disabled'))).not.toContain(undefined)
    await btn('zoom out').trigger('click')
    expect(zoom()).toContain('--zoom: 0.9')
    for (let i = 0; i < 4; i++) await btn('zoom out').trigger('click')
    expect(zoom()).toContain('--zoom: 0.5')
    expect(['zoom out', 'smallest'].map((l) => btn(l).attributes('disabled'))).not.toContain(undefined)
    await btn('zoom in').trigger('click')
    expect(zoom()).toContain('--zoom: 0.6')
    await btn('full size').trigger('click')
    expect(zoom()).toContain('--zoom: 1')
    await btn('smallest').trigger('click')
    expect(zoom()).toContain('--zoom: 0.5')
  })

  it('limits the sky-view times to the observing window', async () => {
    stubGl()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T23:00:00Z'))
    const times = moonVisibleTimes(location, new Date())
    const night = { startUtc: times[2].date.toISOString(), endUtc: times[6].date.toISOString() }
    const w = await mountMap({ features: [atPlace('a', 'Alpha', 10, 20)], night })
    await w.findAll('[aria-label="orientation"] button')[1].trigger('click')
    await w.find('.glass-select-trigger').trigger('click')
    const opts = w.findAll('[role="option"]').map((o) => o.text())
    expect(opts).toHaveLength(1 + 5) // now + five half-hour marks
    expect(opts.some((o) => /moon(rise|set)/.test(o))).toBe(false)
  })

  it('leaves times already past out of the sky-view times', async () => {
    stubGl()
    vi.useFakeTimers({ toFake: ['Date'] })
    const times = moonVisibleTimes(location, new Date('2026-10-03T23:00:00Z'))
    vi.setSystemTime(new Date(times[3].date.getTime() + 60_000))
    const w = await mountMap({ features: [atPlace('a', 'Alpha', 10, 20)] })
    await w.findAll('[aria-label="orientation"] button')[1].trigger('click')
    await w.find('.glass-select-trigger').trigger('click')
    const opts = w.findAll('[role="option"]').map((o) => o.text())
    expect(opts).toHaveLength(1 + times.length - 4) // now + the times after times[3]
    expect(opts.some((o) => /^moonrise/.test(o))).toBe(false)
    expect(opts.at(-1)).toMatch(/^moonset /)
  })

  it('redraws the Moon for the new time when the lunar data is reloaded', async () => {
    stubGl()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-10T00:00:00Z'))
    const w = await mountMap({ features: [atPlace('a', 'Near limb', 0, 60)], moon: { note: 'a' } })
    const before = dots(w)[0].attributes('style')
    vi.setSystemTime(new Date('2026-10-17T00:00:00Z')) // libration has moved a few degrees
    await w.setProps({ moon: { note: 'b' } })
    expect(dots(w)[0].attributes('style')).not.toBe(before)
  })
})
