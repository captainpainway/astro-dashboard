import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import OverviewView from '../src/components/OverviewView.vue'
import { Draggable } from 'gsap/Draggable'
import SkyPanorama from '../src/components/SkyPanorama.vue'
import { nightRange } from '../src/engine/sky'
import { toLocalIso } from '../src/engine/time'
import { fmtTime } from '../src/format'

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
      tempF: 78, windMph: 4, skyCover: 90, shortForecast: 'Cloudy', reasons: ['cloudy (90%)'] },
    { time: '2026-08-31T02:00:00-04:00', isDark: true, score: 80, rating: 'ideal',
      tempF: 74, windMph: 8, skyCover: 5, shortForecast: 'Clear', reasons: ['clear (5%)', 'calm'] },
    { time: '2026-08-31T03:00:00-04:00', isDark: false, score: 99, rating: 'ideal',
      tempF: 72, skyCover: 4, shortForecast: 'Sunny', reasons: [] },
  ],
}

const lunar = {
  moon: { maxAlt: 40 },
  features: [
    { id: 'aristoteles', name: 'Aristoteles', tier: 'binoculars', kind: 'place', score: 83,
      bestTime: '2026-08-31T01:00:00-04:00', reason: 'terminator, Sun 7°' },
    { id: 'eudoxus', name: 'Eudoxus', tier: 'binoculars', kind: 'place', score: 80,
      bestTime: '2026-08-31T01:00:00-04:00', reason: 'terminator, Sun 8°' },
  ],
}

const allProps = { tonight, forecast, lunar,
                   tonightLoading: false, forecastLoading: false, lunarLoading: false }

describe('OverviewView', () => {
  it('renders conditions card with rating chip and key numbers', () => {
    const w = mount(OverviewView, { props: allProps })
    const card = w.find('.card-conditions')
    // from the dark hourly rows: cloud (90 + 5) / 2, coldest temp, mean wind, rated by mean score (30 + 80) / 2
    expect(card.text()).toContain('Good')
    expect(card.text()).toContain('48%')
    expect(card.text()).toContain('74°F')
    expect(card.text()).toContain('6 mph')
    expect(card.text()).toContain('Mostly cloudy') // the current observation
  })

  it('rates the night from the mean dark-hour score, so one great hour does not make it a great night', () => {
    const hour = (h, score, isDark = true) => ({ ...forecast.hours[0], time: `2026-08-31T0${h}:00:00-04:00`, score, isDark })
    const hours = [hour(0, 10), hour(1, 10), hour(2, 5), hour(3, 70), hour(4, 99, false)] // one great dark hour (70)
    const w = mount(OverviewView, { props: { ...allProps, tonight: { ...tonight, weather: { ...tonight.weather,
      summary: { ...tonight.weather.summary, rating: 'great' } } }, forecast: { ...forecast, hours } } })
    expect(w.find('.ov-hero-rating').text()).toBe('Bad night') // mean of 10, 10, 5, 70 is 23.75 (the 99 is not a dark hour), though the weather averages say great
  })

  it('falls back to the weather-average rating when the forecast has no dark hours', () => {
    const w = mount(OverviewView, { props: { ...allProps, forecast: null } })
    expect(w.find('.ov-hero-rating').text()).toBe('Good night')
    expect(w.find('.card-conditions').text()).toContain('46%') // the tonight page's weather averages
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

  it('renders the lunar highlight with the top feature, its reason, best time and remaining count', () => {
    const w = mount(OverviewView, { props: allProps })
    const card = w.find('.card-lunar')
    expect(card.text()).toContain('Aristoteles')
    expect(card.text()).toContain('terminator, Sun 7°')
    expect(card.text()).toContain('1:00 AM')
    expect(card.text()).toContain('+1 more')  // 2 listed, 1 shown
  })

  it('explains an empty lunar list instead of showing a blank card', () => {
    const w = mount(OverviewView, { props: { ...allProps, lunar: { moon: { maxAlt: 4 }, features: [] } } })
    expect(w.find('.card-lunar').text()).toContain('below 10°')
  })

  it('shows per-section loading placeholders while sections load', () => {
    const w = mount(OverviewView, {
      props: { tonight: null, forecast: null, lunar: null,
               tonightLoading: true, forecastLoading: true, lunarLoading: true },
    })
    const placeholders = w.findAll('.card-loading')
    expect(placeholders).toHaveLength(3) // one per data source (tonight, forecast, lunar)
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
      props: { tonight, forecast: null, lunar,
               tonightLoading: false, forecastLoading: false, lunarLoading: false },
    })
    expect(w.find('.card-hourly').exists()).toBe(false)
  })

  it('hides sections whose data failed to arrive (no error text)', () => {
    const w = mount(OverviewView, {
      props: { tonight, forecast: null, lunar: null,
               tonightLoading: false, forecastLoading: false, lunarLoading: false },
    })
    expect(w.find('.card-hourly').exists()).toBe(false)
    expect(w.find('.card-lunar').exists()).toBe(false)
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
    const w = mount(OverviewView, { props: { ...allProps, tonight: t, forecast: null } })
    expect(w.find('.card-conditions').text()).not.toContain('NaN')
    expect(w.find('.card-conditions').text()).toContain('— mph')
  })
})

const location = { name: 'Big Bend National Park, TX', latitude: 29.33, longitude: -103.21, elevationM: 1111,
                   timezone: 'America/Chicago' }
const stubGl = () => {
  vi.stubGlobal('WebGLRenderingContext', function () {})
  const gl = new Proxy({}, { get: () => () => ({}) }) // every GL call is a no-op
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl)
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers() })

describe('OverviewView sky tile', () => {
  it('has no sky tile without a location', () => {
    stubGl()
    expect(mount(OverviewView, { props: allProps }).find('.sky-tile').exists()).toBe(false)
  })

  it('shows the sky tile above the bento when WebGL works', async () => {
    stubGl()
    const w = mount(OverviewView, { props: { ...allProps, location } })
    await flushPromises()
    expect(w.find('.sky-tile canvas').exists()).toBe(true)
    expect(w.find('.sky-tile').attributes('aria-label')).toBe('Sky over Big Bend National Park, TX tonight')
    expect(w.find('.sky-tile').element.nextElementSibling.classList.contains('bento')).toBe(true)
  })

  it('drops the sky tile and keeps the bento when WebGL is missing', async () => {
    const w = mount(OverviewView, { props: { ...allProps, location } }) // jsdom has no WebGLRenderingContext
    await flushPromises()
    expect(w.find('.sky-tile').exists()).toBe(false)
    expect(w.find('.card-conditions').exists()).toBe(true)
  })

  it('drops the sky tile when the WebGL context is lost', async () => {
    stubGl()
    const w = mount(OverviewView, { props: { ...allProps, location } })
    await flushPromises()
    w.find('.sky-tile canvas').element.dispatchEvent(new Event('webglcontextlost'))
    await flushPromises()
    expect(w.find('.sky-tile').exists()).toBe(false)
  })
})

// 00:00 CDT on 2026-10-06 at Big Bend: M45 is 28° up in the ENE, Saturn (54°) and SS Cyg (68°) are above a view that
// faces M45, and M42 is below the horizon. 13:00 CDT the day before is daytime, before the 19:33 sunset.
const NIGHT = new Date('2026-10-06T05:00:00Z')
const DAY = new Date('2026-10-05T18:00:00Z')
const target = (id, name, targetClass, score) => ({
  id, name, targetClass, score, maxAlt: 60, bestTime: '2026-10-06T01:00:00-05:00', altAtBest: 60, azAtBest: 90,
  window: { start: '2026-10-05T20:52:00-05:00', end: '2026-10-06T06:10:00-05:00' }, moonInterference: 0, notes: '',
})
const skyTonight = { ...tonight, instruments: {
  dob_8inch: [target('M45', 'Pleiades', 'messier', 95), target('Saturn', 'Saturn', 'planet', 60),
              target('SS Cyg', 'SS Cyg', 'variable', 50), target('M42', 'Orion Nebula', 'messier', 40),
              target('nowhere', 'Nowhere', 'messier', 30)],
  dwarf_mini: [target('M45', 'Pleiades', 'cluster', 90)],
} }
const hour = (time, score) => ({ ...forecast.hours[0], time, isDark: true, score })
const skyForecast = { ...forecast, hours: [hour('2026-10-05T21:00:00-05:00', 50), hour('2026-10-05T23:00:00-05:00', 80),
                                           hour('2026-10-06T00:00:00-05:00', 70)] }
const media = ({ reduce = false, coarse = false } = {}) => vi.stubGlobal('matchMedia', (q) => ({
  matches: (q === '(prefers-reduced-motion: reduce)' && reduce) || (q === '(pointer: coarse)' && coarse),
}))
const at = (date, extra = {}) => { vi.useFakeTimers({ toFake: ['Date'], ...extra }); vi.setSystemTime(date) }
const mountSky = async (props = {}) => {
  stubGl()
  const w = mount(OverviewView, { props: { ...allProps, location, tonight: skyTonight, forecast: skyForecast, ...props } })
  await flushPromises()
  return w
}
const ringLabels = (w) => w.findAll('.sky-ring').map((b) => b.attributes('aria-label'))
const edgeLabels = (w) => w.findAll('.sky-edge').map((b) => b.attributes('aria-label')).sort()
const timeText = (w) => w.find('.sky-time').text()
const atChips = (w) => w.findAll('.hour-chip').map((c) => c.classes().includes('at'))
const near = (a, b, tol) => expect(Math.abs(a - b)).toBeLessThan(tol)

describe('SkyPanorama overlay and time', () => {
  it('rings on-screen targets once each, pins the others to the edge, and skips targets below the horizon or unknown', async () => {
    at(NIGHT)
    media({ reduce: true })
    const w = await mountSky()
    expect(ringLabels(w)).toEqual(['Pleiades, messier, 28° up, ENE']) // the view opens facing the #1 target
    expect(edgeLabels(w)).toEqual(['Turn to SS Cyg', 'Turn to Saturn'])
    expect(w.find('.sky-tile').text()).not.toContain('Orion Nebula')
    expect(w.find('.sky-tile').text()).not.toContain('Nowhere')
  })

  it('still rings the targets when the tonight plan is in instant mode', async () => {
    at(NIGHT)
    media({ reduce: true })
    const w = await mountSky({ tonight: { ...skyTonight, mode: 'instant' } })
    expect(ringLabels(w)).toEqual(['Pleiades, messier, 28° up, ENE'])
  })

  it('splits the ring of a target both instruments list, and names both in its tooltip', async () => {
    at(NIGHT)
    media({ reduce: true })
    const w = await mountSky()
    const ring = w.find('.sky-ring')
    expect(ring.element.style.getPropertyValue('--ring-a')).toBe('#7aa2ff')
    expect(ring.element.style.getPropertyValue('--ring-b')).toBe('#f0abfc')
    await ring.trigger('mouseenter')
    const tip = w.find('.sky-tip')
    expect(tip.text()).toContain('Pleiades')
    expect(tip.text()).toContain('8" Dobsonian · Dwarf Mini')
    expect(tip.text()).toContain('Best at 1:00 AM')
    await ring.trigger('mouseleave')
    await flushPromises()
    expect(w.find('.sky-tip').exists()).toBe(false)
  })

  it('opens at the current time at night, in the site time zone, and highlights that hour', async () => {
    at(NIGHT)
    media({ reduce: true })
    const w = await mountSky()
    expect(timeText(w)).toBe('12:00 AM')
    expect(atChips(w)).toEqual([false, false, true])
  })

  it('shows the site clock, not the viewer clock', async () => {
    at(NIGHT)
    media({ reduce: true })
    const w = await mountSky({ location: { ...location, timezone: 'America/New_York' } })
    expect(timeText(w)).toBe('1:00 AM')
  })

  it('moves the time and the hourly highlight with the scrubber', async () => {
    at(NIGHT)
    media({ reduce: true })
    const w = await mountSky()
    const input = w.find('.sky-range')
    const min = Number(input.attributes('min'))
    await input.setValue(String(min + 90 * 60_000)) // 90 minutes after sunset, on the 5-minute grid
    expect(timeText(w)).toBe(fmtTime(toLocalIso(new Date(min + 90 * 60_000), 'America/Chicago')))
    expect(atChips(w)).toEqual([true, false, false]) // 19:33 sunset + 90 min falls in the 21:00 hour
  })

  it('opens on the best dark hour in daytime when motion is reduced', async () => {
    at(DAY)
    media({ reduce: true })
    expect(timeText(await mountSky())).toBe('11:00 PM') // the 23:00 hour scores best
  })

  it('opens at astronomical dusk in daytime before the forecast has loaded', async () => {
    at(DAY)
    media({ reduce: true })
    expect(timeText(await mountSky({ forecast: null }))).toBe('8:52 PM')
  })

  it('plays the intro from sunset in daytime, and a key press stops it', async () => {
    at(DAY, { shouldAdvanceTime: true })
    media()
    const w = await mountSky()
    expect(timeText(w)).toBe('7:33 PM')
    await vi.waitFor(() => expect(timeText(w)).not.toBe('7:33 PM'), { timeout: 3000 })
    await w.find('.sky-stage').trigger('keydown', { key: 'ArrowLeft' })
    const stopped = timeText(w)
    await new Promise((r) => setTimeout(r, 300))
    expect(timeText(w)).toBe(stopped)
  })

  it('restarts in the new night when the location changes mid-intro', async () => {
    at(DAY, { shouldAdvanceTime: true })
    media()
    const w = await mountSky()
    const seattle = { name: 'Seattle, WA', latitude: 47.61, longitude: -122.33, timezone: 'America/Los_Angeles' }
    await w.setProps({ location: seattle })
    await flushPromises()
    const range = nightRange(seattle, new Date())
    expect(w.find('.sky-range').attributes('min')).toBe(String(range.start.getTime()))
    await new Promise((r) => setTimeout(r, 300))
    const last = w.findComponent(SkyPanorama).emitted('time').at(-1)[0]
    expect(last >= range.start.getTime() && last <= range.end.getTime()).toBe(true)
  })

  it('turns to a target when its edge marker is clicked', async () => {
    at(NIGHT)
    media({ reduce: true })
    const w = await mountSky()
    await w.findAll('.sky-edge').find((b) => b.text().includes('Saturn')).trigger('click')
    expect(ringLabels(w).some((l) => l.startsWith('Saturn'))).toBe(true)
    expect(edgeLabels(w)).not.toContain('Turn to Saturn')
  })

  it('keeps edge markers from overlapping, favouring the best targets', async () => {
    at(NIGHT)
    media({ reduce: true })
    const crab = target('M1', 'Crab Nebula supernova remnant', 'messier', 20) // near M45 with a long name
    const w = await mountSky({ tonight: { ...skyTonight, instruments: { ...skyTonight.instruments, dwarf_mini: [crab] } } })
    for (let i = 0; i < 18; i++) await w.find('.sky-stage').trigger('keydown', { key: 'ArrowLeft' }) // face away
    const chips = w.findAll('.sky-edge').map((b) =>
      ({ x: parseFloat(b.element.style.left), y: parseFloat(b.element.style.top), w: 7 * b.text().length + 20 }))
    expect(edgeLabels(w)).toContain('Turn to Pleiades')
    for (const [i, a] of chips.entries()) {
      for (const b of chips.slice(i + 1)) expect(Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.y - b.y) >= 24).toBe(true)
    }
  })

  it('never draws a ring cut off by the tile edge', async () => {
    at(NIGHT)
    media({ reduce: true })
    const w = await mountSky()
    for (let i = 0; i < 36; i++) {
      for (const r of w.findAll('.sky-ring')) {
        const [x, y] = [parseFloat(r.element.style.left), parseFloat(r.element.style.top)]
        expect(x >= 12 && x <= 988 && y >= 12 && y <= 373, `${x},${y}`).toBe(true) // jsdom tile is 1000 × 385
      }
      await w.find('.sky-stage').trigger('keydown', { key: i % 2 ? 'ArrowRight' : 'ArrowUp' })
    }
  })

  // How far the Pleiades ring sits from the centre of the 1000 × 385 jsdom tile: it grows as the view zooms in.
  const spread = (w) => {
    const s = w.find('.sky-ring').element.style
    return Math.hypot(parseFloat(s.left) - 500, parseFloat(s.top) - 192.5)
  }

  it('zooms with the + and − buttons and keys, between the full field and 4×', async () => {
    at(NIGHT)
    media({ reduce: true })
    const w = await mountSky()
    const zoomIn = w.find('[aria-label="zoom in"]')
    const zoomOut = w.find('[aria-label="zoom out"]')
    const wide = spread(w)
    expect(zoomOut.attributes('disabled')).toBeDefined()
    await zoomIn.trigger('click')
    expect(spread(w)).toBeGreaterThan(wide * 1.3)
    for (let i = 0; i < 6; i++) await zoomIn.trigger('click')
    expect(zoomIn.attributes('disabled')).toBeDefined()
    near(spread(w) / wide, 4.5, 0.5) // 143° → 36°: stereographic magnifies by tan(35.7°) / tan(8.9°) ≈ 4.6
    await w.find('.sky-stage').trigger('keydown', { key: '-' })
    expect(spread(w)).toBeLessThan(wide * 3.5)
    for (let i = 0; i < 6; i++) await w.find('.sky-stage').trigger('keydown', { key: '-' })
    near(spread(w), wide, 0.01)
    await w.find('.sky-stage').trigger('keydown', { key: '+' })
    expect(spread(w)).toBeGreaterThan(wide * 1.3)
  })

  it('zooms with Ctrl + scroll, and leaves a plain scroll to the page with a hint', async () => {
    at(NIGHT)
    media({ reduce: true })
    const w = await mountSky()
    const stage = w.find('.sky-stage').element
    const wide = spread(w)
    const plain = new WheelEvent('wheel', { deltaY: -100, cancelable: true })
    stage.dispatchEvent(plain)
    await flushPromises()
    expect(plain.defaultPrevented).toBe(false)
    expect(spread(w)).toBe(wide)
    expect(w.find('.sky-hint').text()).toMatch(/(Ctrl|⌘) \+ scroll to zoom/)
    const ctrl = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, cancelable: true })
    stage.dispatchEvent(ctrl)
    await flushPromises()
    expect(ctrl.defaultPrevented).toBe(true)
    expect(spread(w)).toBeGreaterThan(wide * 1.1)
  })

  it('zooms with a two-finger pinch', async () => {
    at(NIGHT)
    media({ reduce: true, coarse: true })
    const w = await mountSky()
    const stage = w.find('.sky-stage').element
    const pointer = (type, pointerId, clientX) =>
      stage.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { pointerId, clientX, clientY: 200 }))
    const wide = spread(w)
    pointer('pointerdown', 1, 400)
    pointer('pointerdown', 2, 500)
    pointer('pointermove', 2, 600) // fingers twice as far apart
    await flushPromises()
    near(spread(w) / wide, 2, 0.3)
    pointer('pointerup', 2, 600)
    pointer('pointerup', 1, 400)
    pointer('pointerdown', 3, 400)
    pointer('pointermove', 3, 700) // one finger alone doesn't zoom
    await flushPromises()
    near(spread(w) / wide, 2, 0.3)
  })

  it('tilts with a two-finger vertical drag, and says so on the first touch', async () => {
    at(NIGHT)
    media({ reduce: true, coarse: true })
    const w = await mountSky()
    const stage = w.find('.sky-stage').element
    const pointer = (type, pointerId, clientY) => stage.dispatchEvent(
      Object.assign(new Event(type, { bubbles: true }), { pointerId, pointerType: 'touch', clientX: 400 + 100 * pointerId, clientY }))
    const top = () => parseFloat(w.find('.sky-ring').element.style.top)
    const before = top()
    pointer('pointerdown', 1, 100)
    await flushPromises()
    expect(w.find('.sky-hint').text()).toBe('Two fingers to tilt and zoom')
    pointer('pointerdown', 2, 100)
    pointer('pointermove', 1, 160)
    pointer('pointermove', 2, 160) // both fingers 60px down: the sky follows them, so the view tilts up
    await flushPromises()
    expect(top()).toBeGreaterThan(before + 30)
  })

  it('turns the view with the arrow keys', async () => {
    at(NIGHT)
    media({ reduce: true })
    const w = await mountSky()
    const x = () => parseFloat(w.find('.sky-ring').element.style.left)
    const before = x()
    await w.find('.sky-stage').trigger('keydown', { key: 'ArrowRight' })
    expect(x()).toBeLessThan(before)
  })

  it('faces the #1 target when the plan arrives after the tile opened', async () => {
    at(NIGHT)
    media({ reduce: true })
    const w = await mountSky({ tonight: null })
    expect(w.findAll('.sky-ring')).toHaveLength(0)
    await w.setProps({ tonight: skyTonight })
    await flushPromises()
    expect(ringLabels(w)).toEqual(['Pleiades, messier, 28° up, ENE'])
  })

  it('announces the time and how many targets are up once the time settles', async () => {
    at(NIGHT, { toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    media({ reduce: true })
    const w = await mountSky()
    vi.advanceTimersByTime(500)
    await flushPromises()
    expect(w.find('.sky-tile [role="status"]').text()).toBe('12:00 AM, 3 of 4 targets above the horizon')
  })

  it('drags only sideways on touch screens so vertical swipes scroll the page', async () => {
    at(NIGHT)
    const create = vi.spyOn(Draggable, 'create')
    media({ coarse: true })
    await mountSky()
    expect(create.mock.calls.at(-1)[1].type).toBe('x')
    media()
    await mountSky()
    expect(create.mock.calls.at(-1)[1].type).toBe('x,y')
  })
})
