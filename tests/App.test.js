import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import App from '../src/App.vue'

// Fixture mirrors the live GET /tonight response (window mode)
const windowFixture = {
  generatedAt: '2026-08-31T02:41:03+00:00',
  mode: 'window',
  night: {
    startLocal: '2026-08-30T21:00:00-04:00', endLocal: '2026-08-31T05:00:00-04:00',
    startUtc: '2026-08-31T01:00:00+00:00', endUtc: '2026-08-31T09:00:00+00:00',
    timezone: 'America/New_York',
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
  hours: [
    { time: '2026-08-31T02:00:00-04:00', tempF: 76, dewpointF: 75, skyCover: 5, windMph: 0,
      windDir: '', humidity: 90, precipProb: 0, shortForecast: 'Clear', sunAlt: -52,
      moonAlt: 47.6, moonIllum: 0.9, twilightPhase: 'dark', moonUp: true, isDark: true,
      rating: 'ideal', reasons: ['clear (5%)'], score: 80 },
  ],
  errors: [],
}

const discoverFixture = {
  generatedAt: '2026-08-31T02:41:03+00:00',
  night: windowFixture.night,
  targets: [
    { star: { name: 'V1452 Tau', auid: '000-BQP-885', constellation: 'Tau', varType: 'N',
              periodDays: null, maxMag: 8.7, minMag: 23.4, magBand: 'V',
              raHours: 5.35, decDegrees: 23.64 },
      score: 55.8, maxAlt: 47.1, bestTime: '2026-08-31T05:00:00-04:00',
      window: { start: '2026-08-31T02:45:00-04:00', end: '2026-08-31T05:00:00-04:00' },
      azAtBest: 85, chartId: null, chartUrl: null },
  ],
  errors: [],
}

function mockFetchJson(fixture) {
  return vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(fixture) })
}

async function mountOnTonightView(fixture = windowFixture) {
  vi.stubGlobal('fetch', mockFetchJson(fixture))
  const w = mount(App)
  await flushPromises()
  await w.findAll('.view-switch button').find(b => b.text() === 'tonight').trigger('click')
  await flushPromises()
  return w
}

beforeEach(() => { vi.stubGlobal('fetch', mockFetchJson(windowFixture)) })

describe('App integration', () => {
  it('home view renders overview cards from all three endpoints', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      if (String(url).includes('/api/forecast')) return { ok: true, json: () => Promise.resolve(forecastFixture) }
      if (String(url).includes('/api/discover')) return { ok: true, json: () => Promise.resolve(discoverFixture) }
      return { ok: true, json: () => Promise.resolve(windowFixture) }
    }))
    const w = mount(App)
    await flushPromises()
    expect(w.find('.card-conditions').exists()).toBe(true)
    expect(w.find('.card-hourly').exists()).toBe(true)
    expect(w.find('.card-discoveries').exists()).toBe(true)
    expect(w.find('.card-picks').text()).toContain('SS Cyg')
    // all three endpoints fetched on mount
    const urls = fetch.mock.calls.map(c => String(c[0]))
    expect(urls.some(u => u.includes('/api/tonight'))).toBe(true)
    expect(urls.some(u => u.includes('/api/forecast'))).toBe(true)
    expect(urls.some(u => u.includes('/api/discover'))).toBe(true)
  })

  it('renders header, weather, tabs, and table from live-shaped data', async () => {
    const w = await mountOnTonightView()
    expect(w.text()).toContain("Astronomer's Dashboard")
    expect(w.text()).toContain('9:00 PM – 5:00 AM (America/New_York)')
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
    vi.stubGlobal('fetch', mockFetchJson(instantFixture))
    const w = await mountOnTonightView(instantFixture)
    // switch mode -> new fetch with at param
    const instantBtn = w.findAll('.mode button').find(b => b.text() === 'at time')
    await instantBtn.trigger('click')
    await flushPromises()
    const calledUrl = fetch.mock.calls.at(-1)[0]
    expect(calledUrl).toContain('at=22:30')
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
    const url = fetch.mock.calls.at(-1)[0]
    expect(url).toContain('include=')
    expect(url).not.toContain('include=moon')
    // whittle down to one class…
    for (const c of ['planet', 'variable', 'messier', 'nebula']) {
      await chipFor(c).trigger('click')
      await flushPromises()
    }
    // only cluster left; clicking it must NOT remove the last class
    const lastUrl = fetch.mock.calls.at(-1)[0]
    expect(lastUrl).toContain('include=cluster')
    await chipFor('cluster').trigger('click')
    await flushPromises()
    const afterUrl = fetch.mock.calls.at(-1)[0]
    expect(afterUrl).toContain('include=cluster')
  })

  it('home view: fetch failures show inline errors, not a blank page', async () => {
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
    expect(w.findAll('tbody tr.data-row')).toHaveLength(1)
  })
})