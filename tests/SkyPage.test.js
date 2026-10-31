import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import SkyPage from '../src/components/SkyPage.vue'
import { useSkyView } from '../src/composables/useSkyView'
import { nightRange, stepTime } from '../src/engine/sky'
import { toLocalIso } from '../src/engine/time'
import { fmtTime } from '../src/format'
import skyData from '../src/engine/sky.json'

const location = { name: 'Big Bend National Park, TX', latitude: 29.33, longitude: -103.21, elevationM: 1111,
                   timezone: 'America/Chicago' }
// 00:00 CDT on 2026-10-06 at Big Bend: M45 is 28° up in the ENE, Saturn 54° and SS Cyg 68° up, M42 below the horizon.
const NIGHT = new Date('2026-10-06T05:00:00Z')
const target = (id, name, targetClass, score) => ({
  id, name, targetClass, score, maxAlt: 60, bestTime: '2026-10-06T01:00:00-05:00', altAtBest: 60, azAtBest: 90,
  window: { start: '2026-10-05T20:52:00-05:00', end: '2026-10-06T06:10:00-05:00' }, moonInterference: 0, notes: '',
})
const tonight = { mode: 'window', instruments: {
  dob_8inch: [target('M45', 'Pleiades', 'messier', 95), target('Saturn', 'Saturn', 'planet', 60),
              target('SS Cyg', 'SS Cyg', 'variable', 50), target('M42', 'Orion Nebula', 'messier', 40),
              target('nowhere', 'Nowhere', 'messier', 30)],
  dwarf_mini: [target('M45', 'Pleiades', 'cluster', 90), target('M42', 'Orion Nebula', 'messier', 20)],
} }

const stubGl = () => {
  vi.stubGlobal('WebGLRenderingContext', function () {})
  const gl = new Proxy({}, { get: () => () => ({}) }) // every GL call is a no-op
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl)
}
const media = ({ reduce = false, coarse = false } = {}) => vi.stubGlobal('matchMedia', (q) => ({
  matches: (q === '(prefers-reduced-motion: reduce)' && reduce) || (q === '(pointer: coarse)' && coarse),
}))
const at = (date, extra = {}) => { vi.useFakeTimers({ toFake: ['Date'], ...extra }); vi.setSystemTime(date) }
const mounted = []
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
  localStorage.clear()
})
const mountPage = async ({ gl = true, ...props } = {}) => {
  if (gl) stubGl()
  const sky = useSkyView()
  const w = mount(SkyPage, {
    props: { sky, location, tonight, bestHour: '2026-10-05T23:00:00-05:00', ...props },
    attachTo: document.body,
  })
  mounted.push(w)
  await flushPromises()
  return { w, sky }
}
const rowNames = (w) => w.findAll('.sky-target-name').map((n) => n.text())
const ringLabels = (w) => w.findAll('.sky-ring').map((b) => b.attributes('aria-label'))
const chip = (w, label) => w.findAll('.sky-targets-filter button').find((b) => b.text() === label)
const row = (w, name) => w.findAll('.sky-target-row').find((r) => r.find('.sky-target-name').text() === name)

describe('SkyPage targets', () => {
  it('lists every displayable target once, best score first, with where it is at the shown time', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w } = await mountPage()
    expect(rowNames(w)).toEqual(['Pleiades', 'Saturn', 'SS Cyg', 'Orion Nebula', 'Nowhere'])
    const where = w.findAll('.sky-target-where').map((n) => n.text())
    expect(where[0]).toBe('28° ENE')
    expect(where[3]).toBe('below horizon')
    expect(where[4]).toBe('—')
  })

  it('rings exactly what the instrument filter leaves', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w } = await mountPage()
    expect(ringLabels(w)).toEqual(['Pleiades, messier, 28° up, ENE'])
    expect(w.findAll('.sky-edge')).toHaveLength(2) // Saturn and SS Cyg, above the view
    await chip(w, 'Dwarf Mini').trigger('click')
    expect(rowNames(w)).toEqual(['Pleiades', 'Orion Nebula'])
    expect(w.findAll('.sky-edge')).toHaveLength(0)
  })

  it('hides targets below the horizon when asked', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w } = await mountPage()
    await w.find('.sky-targets-up input').setValue(true)
    expect(rowNames(w)).toEqual(['Pleiades', 'Saturn', 'SS Cyg'])
  })

  it('says so when the filters leave nothing, and rings nothing', async () => {
    at(NIGHT)
    media({ reduce: true })
    const only = { mode: 'window', instruments: { dwarf_mini: [target('M42', 'Orion Nebula', 'messier', 20)] } }
    const { w } = await mountPage({ tonight: only })
    await w.find('.sky-targets-up input').setValue(true)
    expect(w.find('.sky-targets').text()).toContain('No targets match these filters')
    expect(w.findAll('.sky-ring')).toHaveLength(0)
  })

  it('turns to a picked target and keeps its tooltip up', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w } = await mountPage()
    await row(w, 'Saturn').trigger('click')
    expect(w.find('.sky-ring.active').attributes('aria-label')).toMatch(/^Saturn, planet/)
    expect(w.find('.sky-tip').text()).toContain('Saturn')
    expect(row(w, 'Saturn').classes()).toContain('active')
  })

  it("shows a ring's tooltip while its row is hovered", async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w } = await mountPage()
    await row(w, 'Pleiades').trigger('mouseenter')
    expect(w.find('.sky-tip').text()).toContain('Pleiades')
    await row(w, 'Pleiades').trigger('mouseleave')
    await flushPromises()
    expect(w.find('.sky-tip').exists()).toBe(false)
  })

  it('links each row to its details in Tonight, on the tab the list is filtered to', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w } = await mountPage()
    const details = (name) => w.find(`.sky-target-details[aria-label="${name} details in Tonight"]`)
    await details('Pleiades').trigger('click')
    expect(w.emitted('details').at(-1)).toEqual([{ id: 'M45', instrument: 'dob_8inch' }])
    await chip(w, 'Dwarf Mini').trigger('click')
    await details('Pleiades').trigger('click')
    expect(w.emitted('details').at(-1)).toEqual([{ id: 'M45', instrument: 'dwarf_mini' }])
    expect(w.find('.sky-ring.active').exists()).toBe(false) // the link doesn't also pick the target
  })

  it('puts a Tonight link in the picked target’s tooltip only', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w } = await mountPage()
    expect(w.find('.sky-tip-link').exists()).toBe(false)
    await row(w, 'Pleiades').trigger('click')
    const link = w.find('.sky-tip-link')
    expect(link.text()).toBe('Details in Tonight →')
    await link.trigger('click')
    expect(w.emitted('details').at(-1)).toEqual([{ id: 'M45', instrument: 'dob_8inch' }])
  })

  it('opened from Tonight, picks the target and keeps the time when it is up', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w, sky } = await mountPage({ focusId: 'Saturn' })
    const time = sky.time
    expect(w.find('.sky-target-row.active .sky-target-name').text()).toBe('Saturn')
    expect(w.emitted('focused')).toHaveLength(1)
    expect(sky.time).toBe(time)
    expect(sky.view.pitch).toBeGreaterThan(30) // turned up toward Saturn, 54° up
  })

  it('opened from Tonight for a target below the horizon, moves to its best time and says so', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w, sky } = await mountPage({ focusId: 'M42' })
    const { start, end } = sky.range
    const best = Date.parse(target('M42').bestTime)
    expect(sky.time).toBe(Math.min(end.getTime(), Math.max(start.getTime(), best)))
    expect(w.find('.sky-notice').text()).toMatch(/Orion Nebula/)
    expect(w.find('.sky-target-row.active .sky-target-name').text()).toBe('Orion Nebula')
  })

  it('waits for the plan before showing a target from Tonight', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w } = await mountPage({ focusId: 'M45', tonight: null })
    expect(w.emitted('focused')).toBeUndefined()
    await w.setProps({ tonight })
    expect(w.emitted('focused')).toHaveLength(1)
    expect(w.find('.sky-target-row.active .sky-target-name').text()).toBe('Pleiades')
  })

  it('hides and shows the list', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w } = await mountPage()
    const toggle = w.find('.sky-targets-toggle')
    expect(toggle.text()).toBe('Targets (5)')
    await toggle.trigger('click')
    expect(w.find('.sky-targets').exists()).toBe(false)
    await toggle.trigger('click')
    await w.find('.sky-targets-close').trigger('click')
    expect(w.find('.sky-targets').exists()).toBe(false)
  })

  it('still lists the targets without WebGL', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w } = await mountPage({ gl: false })
    expect(w.find('.sky-nogl').text()).toContain('WebGL is unavailable')
    expect(rowNames(w)).toHaveLength(5)
  })

  it('shows loading and failure states', async () => {
    at(NIGHT)
    media({ reduce: true })
    const loading = await mountPage({ tonight: null, loading: true })
    expect(loading.w.find('.sky-targets').text()).toContain('loading targets…')
    const failed = await mountPage({ tonight: null, error: 'network down' })
    expect(failed.w.find('.sky-targets').text()).toContain('network down')
  })
})

const DAY = new Date('2026-10-05T18:00:00Z') // 13:00 CDT, before sunset
const timeText = (w) => w.find('.sky-time').text()
const label = (ms) => fmtTime(toLocalIso(new Date(ms), location.timezone))
const button = (w, text) => w.findAll('.sky-timebar button').find((b) => b.text() === text)

describe('SkyPage time controls', () => {
  it("steps by an hour on the scrubber's grid, and stays inside the night", async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w, sky } = await mountPage()
    await w.find('[aria-label="Forward one hour"]').trigger('click')
    expect(timeText(w)).toBe(label(stepTime(NIGHT.getTime(), sky.range, 3_600_000)))
    for (let i = 0; i < 12; i++) await w.find('[aria-label="Back one hour"]').trigger('click')
    expect(sky.time).toBe(sky.range.start.getTime())
  })

  it('jumps to now and to the best hour', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w } = await mountPage()
    await w.find('[aria-label="Forward one hour"]').trigger('click')
    await button(w, 'Now').trigger('click')
    expect(timeText(w)).toBe('12:00 AM')
    await button(w, 'Best').trigger('click')
    expect(timeText(w)).toBe('11:00 PM')
  })

  it('hides Best until there is a best hour, and disables Now outside the night', async () => {
    at(DAY)
    media({ reduce: true })
    const { w } = await mountPage({ bestHour: null })
    expect(button(w, 'Best')).toBeUndefined()
    expect(button(w, 'Now').attributes('disabled')).toBeDefined()
  })

  it('plays an hour per second with reduced motion, and stops at sunrise', async () => {
    at(NIGHT, { toFake: ['Date', 'setInterval', 'clearInterval'] })
    media({ reduce: true })
    const { w, sky } = await mountPage()
    await w.find('[aria-label="Play the night"]').trigger('click')
    vi.advanceTimersByTime(2000)
    await flushPromises()
    expect(sky.time).toBe(NIGHT.getTime() + 2 * 3_600_000)
    vi.advanceTimersByTime(20_000)
    await flushPromises()
    expect(sky.time).toBe(sky.range.end.getTime())
    expect(w.find('[aria-label="Play the night"]').exists()).toBe(true)
  })

  it('pauses when the scrubber moves, and plays from sunset when started at sunrise', async () => {
    at(NIGHT, { toFake: ['Date', 'setInterval', 'clearInterval'] })
    media({ reduce: true })
    const { w, sky } = await mountPage()
    await w.find('[aria-label="Play the night"]').trigger('click')
    const t = sky.range.start.getTime() + 10 * 60_000
    await w.find('.sky-range').setValue(String(t))
    vi.advanceTimersByTime(2000)
    await flushPromises()
    expect(sky.time).toBe(t)
    expect(w.find('[aria-label="Play the night"]').exists()).toBe(true)
    sky.setTime(sky.range.end.getTime())
    await w.find('[aria-label="Play the night"]').trigger('click')
    expect(sky.time).toBe(sky.range.start.getTime())
  })
})

const openLayers = (w) => w.findAll('.sky-toolbar button').find((b) => b.text() === 'Layers').trigger('click')
const layerBox = (w, text) => w.findAll('.sky-layers-menu label').find((l) => l.text() === text).find('input')

describe('SkyPage layers', () => {
  it('draws deep-sky markers only with their layer on, and remembers the choice', async () => {
    at(NIGHT)
    media({ reduce: true })
    const first = await mountPage()
    expect(first.w.findAll('.sky-dso')).toHaveLength(0)
    await openLayers(first.w)
    await layerBox(first.w, 'Deep-sky catalogue').setValue(true)
    expect(first.w.findAll('.sky-dso').length).toBeGreaterThan(0)
    expect(JSON.parse(localStorage.getItem('astrodash.skyLayers')).deepSky).toBe(true)
    const again = await mountPage()
    expect(again.w.findAll('.sky-dso').length).toBeGreaterThan(0)
  })

  it('hides the constellation names with their layer off', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w } = await mountPage()
    expect(w.findAll('.sky-name').length).toBeGreaterThan(0)
    await openLayers(w)
    await layerBox(w, 'Constellation names').setValue(false)
    expect(w.findAll('.sky-name')).toHaveLength(0)
  })

  it('names the brightest stars, and fainter named stars from 2× zoom', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w, sky } = await mountPage()
    await openLayers(w)
    await layerBox(w, 'Star names').setValue(true)
    Object.assign(sky.view, { yaw: 0, pitch: 30 }) // north, with Polaris 29° up
    await flushPromises()
    const faint = new Set(skyData.starNames.filter(([, , , mag]) => mag > 2).map(([name]) => name))
    const names = () => w.findAll('.sky-star-name').map((s) => s.text())
    expect(names()).toContain('Polaris')
    expect(names().some((n) => faint.has(n))).toBe(false)
    sky.view.zoom = 2
    await flushPromises()
    expect(names().some((n) => faint.has(n))).toBe(true)
  })

  it('falls back to the default layers when storage is unavailable', async () => {
    at(NIGHT)
    media({ reduce: true })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    const { w } = await mountPage()
    expect(w.findAll('.sky-name').length).toBeGreaterThan(0)
    await openLayers(w)
    await layerBox(w, 'Deep-sky catalogue').setValue(true)
    expect(w.findAll('.sky-dso').length).toBeGreaterThan(0)
  })
})

const searchBox = (w) => w.find('.sky-search-input')
const find = async (w, text) => {
  await searchBox(w).setValue(text)
  await searchBox(w).trigger('keydown', { key: 'Enter' })
}

describe('SkyPage search', () => {
  it('turns to a found star and marks it', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w } = await mountPage()
    await find(w, 'polaris')
    expect(w.find('.sky-pick').exists()).toBe(true)
    expect(w.find('.sky-tip').text()).toContain('Polaris')
  })

  it('says when the pick is below the horizon', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w } = await mountPage()
    await find(w, 'acrux') // never rises at 29°N
    expect(w.find('.sky-notice').text()).toBe('Acrux is below the horizon at 12:00 AM')
    expect(w.find('.sky-pick').exists()).toBe(false)
  })

  it('moves through results with the arrow keys and clears with Escape', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w } = await mountPage()
    await searchBox(w).setValue('veil')
    await searchBox(w).trigger('keydown', { key: 'ArrowDown' })
    await searchBox(w).trigger('keydown', { key: 'Enter' })
    expect(searchBox(w).element.value).toBe('Veil Nebula (Western)')
    await searchBox(w).trigger('keydown', { key: 'Escape' })
    expect(searchBox(w).element.value).toBe('')
    expect(w.find('.sky-pick').exists()).toBe(false)
  })

  it('focuses the search box with /', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w } = await mountPage()
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))
    expect(document.activeElement).toBe(searchBox(w).element)
  })

  it('re-opens the sky in the new night and drops the pick when the location changes', async () => {
    at(NIGHT)
    media({ reduce: true })
    const { w, sky } = await mountPage()
    await find(w, 'polaris')
    const seattle = { name: 'Seattle, WA', latitude: 47.61, longitude: -122.33, timezone: 'America/Los_Angeles' }
    await w.setProps({ location: seattle })
    await flushPromises()
    expect(sky.range.start.getTime()).toBe(nightRange(seattle, new Date()).start.getTime())
    expect(w.find('.sky-pick').exists()).toBe(false)
  })
})
