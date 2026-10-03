import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import App from '../src/App.vue'
import { DEMO_LOCATION } from '../src/composables/useLocation'

// Tonight, forecast and outlook are computed in the browser; stub them at the api boundary.
const engine = vi.hoisted(() => ({ tonight: vi.fn(), forecast: vi.fn(), outlook: vi.fn() }))
vi.mock('../src/api', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchTonight: (opts) => engine.tonight(opts),
  fetchForecast: (opts) => engine.forecast(opts),
  fetchOutlook: (opts) => engine.outlook(opts),
}))

// Fixture mirrors the live GET /tonight response (window mode)
const windowFixture = {
  generatedAt: '2026-08-31T02:41:03+00:00',
  location: { name: 'Big Bend National Park, TX', latitude: 29.33, longitude: -103.21,
              elevationM: 56, timezone: 'America/New_York' },
  mode: 'window',
  night: {
    startLocal: '2026-08-30T21:00:00-04:00', endLocal: '2026-08-31T05:00:00-04:00',
    startUtc: '2026-08-31T01:00:00+00:00', endUtc: '2026-08-31T09:00:00+00:00',
    timezone: 'America/New_York',
  },
  twilight: {
    date: '2026-08-30',
    sunset: '2026-08-30T19:27:46-04:00', sunrise: '2026-08-31T07:13:32-04:00',
    civilDusk: '2026-08-30T19:51:23-04:00', civilDawn: '2026-08-31T06:49:54-04:00',
    nauticalDusk: '2026-08-30T20:18:56-04:00', nauticalDawn: '2026-08-31T06:22:19-04:00',
    astroDusk: '2026-08-30T20:46:46-04:00', astroDawn: '2026-08-31T05:54:28-04:00',
    midnightSun: false, polarNight: false,
  },
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
        altAtBest: 75.1, azAtBest: 2, moonInterference: 0.0, notes: 'dwarf nova' },
    ],
    dwarf_mini: [
      { id: 'NGC 6960', name: 'Veil Nebula (Western)', targetClass: 'nebula', score: 72.8, maxAlt: 87.9,
        bestTime: '2026-08-30T23:15:00-04:00',
        window: { start: '2026-08-30T21:00:00-04:00', end: '2026-08-31T05:00:00-04:00' },
        altAtBest: 87.9, azAtBest: 14, moonInterference: 0.4, notes: 'supernova remnant' },
    ],
  },
  errors: [],
}

const instantFixture = {
  generatedAt: '2026-08-31T02:41:03+00:00',
  mode: 'instant',
  at: { local: '2026-08-30T22:30:00-04:00', utc: '2026-08-31T02:30:00+00:00',
        timezone: 'America/New_York' },
  weather: {
    current: windowFixture.weather.current,
    atTime: { cloudCover: 57, temperatureF: 77, windMph: 5, rating: 'poor', forecast: 'Mostly Cloudy' },
  },
  instruments: { dob_8inch: windowFixture.instruments.dob_8inch,
                  dwarf_mini: windowFixture.instruments.dwarf_mini },
  errors: [],
}

const forecastFixture = {
  generatedAt: '2026-08-31T02:41:03+00:00',
  night: { startLocal: '2026-08-30T19:00:00-04:00', endLocal: '2026-08-31T07:00:00-04:00',
           startUtc: '2026-08-30T23:00:00+00:00', endUtc: '2026-08-31T11:00:00+00:00',
           timezone: 'America/New_York' },
  twilight: {
    date: '2026-08-30',
    sunset: '2026-08-30T19:27:46-04:00', sunrise: '2026-08-31T07:13:32-04:00',
    civilDusk: '2026-08-30T19:51:23-04:00', civilDawn: '2026-08-31T06:49:54-04:00',
    nauticalDusk: '2026-08-30T20:18:56-04:00', nauticalDawn: '2026-08-31T06:22:19-04:00',
    astroDusk: '2026-08-30T20:46:46-04:00', astroDawn: '2026-08-31T05:54:28-04:00',
    midnightSun: false, polarNight: false,
  },
  hours: [
    { time: '2026-08-31T02:00:00-04:00', tempF: 76, dewpointF: 75, skyCover: 5, windMph: 0,
      windDir: '', humidity: 90, precipProb: 0, shortForecast: 'Clear', sunAlt: -52,
      moonAlt: 47.6, moonIllum: 0.9, twilightPhase: 'dark', moonUp: true, isDark: true,
      daylight: false, rating: 'ideal', reasons: ['clear (5%)'], score: 80 },
  ],
  errors: [],
}

const discoverFixture = {
  generatedAt: '2026-08-31T02:41:03+00:00',
  night: windowFixture.night,
  targets: [
    { star: { name: 'V1452 Tau', auid: '000-BQP-885', oid: '10875985', constellation: 'Tau', varType: 'N',
              periodDays: null, maxMag: 8.7, minMag: 23.4, magBand: 'V',
              raHours: 5.35, decDegrees: 23.64 },
      score: 55.8, maxAlt: 47.1, bestTime: '2026-08-31T05:00:00-04:00',
      window: { start: '2026-08-31T02:45:00-04:00', end: '2026-08-31T05:00:00-04:00' },
      azAtBest: 85, chartId: null, chartUrl: null },
  ],
  errors: [],
}

const outlookFixture = {
  generatedAt: '2026-09-02T00:54:16+00:00',
  timezone: 'America/New_York',
  nights: [
    {
      date: '2026-09-01', label: 'Tonight',
      start: '2026-09-01T20:00:00-04:00', end: '2026-09-02T06:00:00-04:00',
      tempF: 75.0, windMph: 5.0, windDir: 'NE', cloudCover: 46.5, cloudSource: 'grid',
      precipProb: 19, shortForecast: 'Slight Chance Showers And Thunderstorms then Partly Cloudy',
      moonIllum: 0.73, moonUpFraction: 0.75, darkHours: 2.5,
      rating: 'fair', reasons: ['partly cloudy (46%)'], score: 52.0,
      twilight: {
        date: '2026-09-01',
        sunset: '2026-09-01T19:51:00-04:00', sunrise: '2026-09-02T07:09:00-04:00',
        civilDusk: '2026-09-01T20:15:00-04:00', civilDawn: '2026-09-02T06:45:00-04:00',
        nauticalDusk: '2026-09-01T20:43:00-04:00', nauticalDawn: '2026-09-02T06:18:00-04:00',
        astroDusk: '2026-09-01T21:11:00-04:00', astroDawn: '2026-09-02T05:50:00-04:00',
        midnightSun: false, polarNight: false,
      },
      hours: [
        { time: '2026-09-01T23:00:00-04:00', tempF: 76, skyCover: 48, windMph: 5, windDir: 'NE',
          humidity: 90, precipProb: 19, shortForecast: 'Partly Cloudy', sunAlt: -40,
          moonAlt: 47, moonIllum: 0.73, twilightPhase: 'dark', moonUp: true, isDark: true,
          rating: 'fair', reasons: [], score: 45 },
        { time: '2026-09-02T00:00:00-04:00', tempF: 74, skyCover: 10, windMph: 3, windDir: 'NE',
          humidity: 88, precipProb: 5, shortForecast: 'Clear', sunAlt: -45,
          moonAlt: 50, moonIllum: 0.73, twilightPhase: 'dark', moonUp: true, isDark: true,
          rating: 'great', reasons: [], score: 75 },
      ],
    },
    {
      date: '2026-09-02', label: 'Wednesday Night',
      start: '2026-09-02T18:00:00-04:00', end: '2026-09-03T06:00:00-04:00',
      tempF: 75.0, windMph: 5.0, windDir: 'E', cloudCover: 46.9, cloudSource: 'grid',
      precipProb: 53, shortForecast: 'Chance Showers And Thunderstorms then Partly Cloudy',
      moonIllum: 0.63, moonUpFraction: 0.54, darkHours: 5.5,
      rating: 'poor', reasons: ['rain likely (53%)'], score: 38.2,
      hours: [],
    },
  ],
  errors: [],
}

function mockFetchJson(fixture) {
  return vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(fixture) })
}

async function mountOnTonightView(fixture = windowFixture) {
  engine.tonight.mockResolvedValue(fixture)
  const w = mount(App)
  await flushPromises()
  await w.findAll('.view-switch button').find(b => b.text() === 'tonight').trigger('click')
  await flushPromises()
  return w
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetchJson(discoverFixture)) // discover is the only server call left (Phase 4)
  engine.tonight.mockReset().mockResolvedValue(windowFixture)
  engine.forecast.mockReset().mockResolvedValue(forecastFixture)
  engine.outlook.mockReset().mockResolvedValue(outlookFixture)
})

/** Mount the app on the home view with all three data sources wired. */
async function mountHome() {
  const w = mount(App)
  await flushPromises()
  return w
}

describe('App integration', () => {
  it('home view renders overview cards from all three data sources', async () => {
    const w = mount(App)
    await flushPromises()
    expect(w.find('.card-conditions').exists()).toBe(true)
    expect(w.find('.card-hourly').exists()).toBe(true)
    expect(w.find('.card-discoveries').exists()).toBe(true)
    expect(w.find('.card-picks').text()).toContain('SS Cyg')
    // all three loaded on mount; the forecast for the visitor's location
    const urls = fetch.mock.calls.map(c => String(c[0]))
    expect(engine.tonight).toHaveBeenCalledWith({ at: null, include: null, location: DEMO_LOCATION })
    expect(engine.forecast).toHaveBeenCalledWith({ date: undefined, location: DEMO_LOCATION })
    expect(urls.some(u => u.includes('/api/discover'))).toBe(true)
  })

  it('home header shows the observing location instead of the observing window', async () => {
    const w = await mountHome()
    const header = w.find('.app-header').text()
    expect(header).toContain('Big Bend National Park, TX · 29.33°N 103.21°W')
    expect(header).not.toContain('9:00 PM – 5:00 AM')
    expect(header).toContain('Generated @ Aug 30, 10:41 PM')
  })

  it('renders header, weather, tabs, and table from live-shaped data', async () => {
    const w = await mountOnTonightView()
    expect(w.text()).toContain("Astronomer's Dashboard")
    expect(w.text()).toContain('observing window 9:00 PM – 5:00 AM')
    expect(w.find('.app-header').text()).not.toContain('Big Bend') // location is home-only
    expect(w.text()).toContain('SS Cyg')
    // both instrument tabs render with counts
    const tabs = w.findAll('.tabs button')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].text()).toContain('8" Dobsonian')
    expect(tabs[1].text()).toContain('Dwarf Mini')
    // no errors banner
    expect(w.find('.errors-banner').exists()).toBe(false)
  })

  it('switching to the Dwarf Mini tab shows its targets', async () => {
    const w = await mountOnTonightView()
    await w.findAll('.tabs button')[1].trigger('click')
    expect(w.text()).toContain('Veil Nebula (Western)')
    expect(w.text()).not.toContain('SS Cyg')
  })

  it('instant mode: refetches with at=, shows atTime weather, no night window', async () => {
    const w = await mountOnTonightView(instantFixture)
    // switch mode -> new fetch with at param
    const instantBtn = w.findAll('.mode button').find(b => b.text() === 'at time')
    await instantBtn.trigger('click')
    await flushPromises()
    expect(engine.tonight).toHaveBeenLastCalledWith(expect.objectContaining({ at: '22:30' }))
    expect(w.text()).toContain('Sky at 10:30 PM')
    expect(w.text()).toContain('SS Cyg')
  })

  it('shows the degraded-data banner when errors[] is non-empty', async () => {
    const w = await mountOnTonightView({ ...windowFixture, errors: ['weather: NWS timeout'] })
    expect(w.find('.errors-banner').exists()).toBe(true)
    expect(w.text()).toContain('NWS timeout')
  })

  it('deselecting a class chip refetches with include=; last chip is protected', async () => {
    const w = await mountOnTonightView()
    const chipFor = (label) => w.findAll('.chips button').find(b => b.text() === label)
    await chipFor('moon').trigger('click')
    await flushPromises()
    expect(engine.tonight.mock.calls.at(-1)[0].include).toEqual(['planet', 'variable', 'messier', 'nebula', 'cluster'])
    // whittle down to one class…
    for (const c of ['planet', 'variable', 'messier', 'nebula']) {
      await chipFor(c).trigger('click')
      await flushPromises()
    }
    // only cluster left; clicking it must NOT remove the last class
    expect(engine.tonight.mock.calls.at(-1)[0].include).toEqual(['cluster'])
    await chipFor('cluster').trigger('click')
    await flushPromises()
    expect(engine.tonight.mock.calls.at(-1)[0].include).toEqual(['cluster'])
  })

  it('home view: fetch failures show inline errors, not a blank page', async () => {
    engine.tonight.mockRejectedValue(new Error('Failed to fetch'))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    const w = mount(App)
    await flushPromises()
    expect(w.text()).toContain('failed to load:')
    expect(w.find('.overview').exists()).toBe(true) // card grid renders (empty of cards)
  })

  it('tab counts match displayed rows — zero/negative scores excluded', async () => {
    const fixture = structuredClone(windowFixture)
    fixture.instruments.dob_8inch.push({
      id: 'junk', name: 'Junk Target', targetClass: 'messier', score: 0, maxAlt: 30,
      bestTime: '2026-08-30T22:00:00-04:00',
      window: { start: '2026-08-30T21:00:00-04:00', end: '2026-08-31T05:00:00-04:00' },
      altAtBest: 30, azAtBest: 90, moonInterference: 0, notes: '',
    })
    const w = await mountOnTonightView(fixture)
    const tabs = w.findAll('.tabs button')
    expect(tabs[0].text()).toContain('(1)') // 2 targets from API, 1 hidden by score filter
    expect(w.findAll('tr.data-row')).toHaveLength(1)
  })

  it('outlook view: lazy-loads on tab switch and renders nights with hourly chips', async () => {
    const w = mount(App)
    await flushPromises()
    // not loaded on mount
    expect(engine.outlook).not.toHaveBeenCalled()
    await w.findAll('.view-switch button').find(b => b.text() === 'outlook').trigger('click')
    await flushPromises()
    expect(engine.outlook).toHaveBeenCalledWith({ nights: undefined, location: DEMO_LOCATION })
    const panels = w.findAll('.outlook-night')
    expect(panels).toHaveLength(2)
    expect(panels[0].text()).toContain('Tonight')
    expect(panels[0].find('.rating').classes()).toContain('rating-fair')
    expect(panels[0].findAll('.hour-chip')).toHaveLength(2)
    expect(panels[0].findAll('.hour-chip')[1].classes()).toContain('rc-great')
    expect(panels[0].findAll('.hour-chip')[1].classes()).toContain('best')
    // second night beyond the hourly grid: headline only
    expect(panels[1].text()).toContain('no hourly detail for this night')
  })

  it('outlook view: refresh refetches, errors surface inline, banner shows errors[]', async () => {
    const w = mount(App)
    await flushPromises()
    await w.findAll('.view-switch button').find(b => b.text() === 'outlook').trigger('click')
    await flushPromises()
    // refresh button still triggers an outlook reload
    engine.outlook.mockClear()
    await w.find('.refresh').trigger('click')
    await flushPromises()
    expect(engine.outlook).toHaveBeenCalled()
    // a failed refresh shows the inline error, keeps rendered nights
    engine.outlook.mockRejectedValue(new Error('Failed to fetch'))
    await w.find('.refresh').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('outlook failed:')
    expect(w.findAll('.outlook-night')).toHaveLength(2)
  })

  it('home view: shows sunset, twilight boundaries and the dark span', async () => {
    const w = await mountHome()
    const tw = w.find('.tw-card')
    expect(tw.exists()).toBe(true)
    const text = tw.text()
    expect(text).toContain('sunset')
    expect(text).toContain('7:27 PM')
    expect(text).toContain('8:46 PM')          // full dark
    expect(text).toContain('sunrise')
    expect(text).toContain('7:13 AM')
    expect(text).toContain('fully dark')
    // 8 boundaries → 7 phases between them.
    expect(w.findAll('.tw-seg').length).toBe(7)
  })

  it('forecast view: shows the night-times card and marks daylight hours', async () => {
    const w = await mountHome()
    await w.findAll('.view-switch button').find(b => b.text() === 'forecast').trigger('click')
    await flushPromises()
    expect(w.find('.tw-card').exists()).toBe(true)
    expect(w.find('.tw-card').text()).toContain('7:27 PM')
    // The fixture's only hour is after dark, so no daylight notice.
    expect(w.find('.hour-card').classes()).not.toContain('daylight')
  })

  it('tonight view: shows the compact night-times strip', async () => {
    const w = await mountOnTonightView()
    expect(w.find('.tw-card').exists()).toBe(true)
    expect(w.find('.tw-card').text()).toContain('8:46 PM')
    expect(w.find('.tw-card').text()).toContain('fully dark')
  })

  it('outlook view: each night row carries its own twilight times', async () => {
    const w = mount(App)
    await flushPromises()
    await w.findAll('.view-switch button').find(b => b.text() === 'outlook').trigger('click')
    await flushPromises()
    // Only night 1 carries twilight in the fixture (night 2 is beyond the data).
    expect(w.findAll('.outlook-night .tw-card')).toHaveLength(1)
    const row = w.findAll('.outlook-night')[0]
    // Compact rows keep just the planning-critical boundaries: full dark ↔ dawn.
    expect(row.text()).toContain('9:11 PM')
    expect(row.text()).toContain('5:50 AM')
    expect(row.text()).toContain('fully dark')
  })
})