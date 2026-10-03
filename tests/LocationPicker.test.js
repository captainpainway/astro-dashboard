import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LocationPicker from '../src/components/LocationPicker.vue'
import { searchPlaces } from '../src/engine/geocode'
import { DEMO_LOCATION } from '../src/composables/useLocation'

vi.mock('../src/engine/geocode', () => ({ searchPlaces: vi.fn() }))

const seattle = { name: 'Seattle, WA', latitude: 47.61, longitude: -122.33, elevationM: null, timezone: 'America/Los_Angeles' }
const base = { location: DEMO_LOCATION, isDemo: true, error: null, resolving: false }
const make = (over = {}) => mount(LocationPicker, { props: { ...base, ...over } })
const search = async (w, text) => {
  await w.find('input[aria-label="city or ZIP code"]').setValue(text)
  await w.find('form.lp-search').trigger('submit')
  await flushPromises()
}
const coords = async (w, text) => {
  await w.find('input[aria-label="latitude and longitude"]').setValue(text)
  await w.find('form.lp-coords').trigger('submit')
}

beforeEach(() => { searchPlaces.mockReset().mockResolvedValue([]) }) // braces: a returned mock would run as vitest's cleanup

describe('LocationPicker', () => {
  it('shows the current location, flags the demo one, and hides reset while on the demo', () => {
    const w = make()
    expect(w.text()).toContain('Big Bend National Park, TX')
    expect(w.text()).toContain('demo location')
    expect(w.find('button.lp-reset').exists()).toBe(false)
  })

  it('offers reset to demo for a chosen location, and emits it', async () => {
    const w = make({ location: seattle, isDemo: false })
    expect(w.text()).not.toContain('demo location')
    await w.find('button.lp-reset').trigger('click')
    expect(w.emitted('reset')).toHaveLength(1)
  })

  it('searches on submit, lists US matches, and emits the picked place coordinates', async () => {
    searchPlaces.mockResolvedValue([{ id: 1, name: 'Austin', state: 'Texas', latitude: 30.26715, longitude: -97.74306 },
                                    { id: 2, name: 'Austin', state: 'Minnesota', latitude: 43.66663, longitude: -92.97464 }])
    const w = make()
    await search(w, 'Austin')
    expect(searchPlaces).toHaveBeenCalledWith('Austin')
    expect(w.findAll('.lp-results button').map((b) => b.text())).toEqual(['Austin, Texas', 'Austin, Minnesota'])
    await w.findAll('.lp-results button')[1].trigger('click')
    expect(w.emitted('set')).toEqual([[43.66663, -92.97464]])
  })

  it('renders a place name containing markup as plain text', async () => {
    searchPlaces.mockResolvedValue([{ id: 1, name: '<img src=x onerror=alert(1)>', state: 'TX', latitude: 1, longitude: 2 }])
    const w = make()
    await search(w, 'evil')
    expect(w.find('.lp-results img').exists()).toBe(false)
    expect(w.find('.lp-results').text()).toContain('<img src=x onerror=alert(1)>')
  })

  it('says when nothing matches, and when the search fails', async () => {
    const w = make()
    await search(w, 'zzzz')
    expect(w.text()).toContain('no US places found')
    searchPlaces.mockRejectedValue(new Error('City search failed (429)'))
    await search(w, 'Austin')
    expect(w.find('.lp-search-error').text()).toBe('City search failed (429)')
    expect(w.text()).not.toContain('no US places found')
  })

  it('emits locate for "use my location"', async () => {
    const w = make()
    await w.find('button.lp-locate').trigger('click')
    expect(w.emitted('locate')).toHaveLength(1)
  })

  it.each([['29.33, -103.21'], ['29.33 -103.21'], ['  29.33,-103.21 ']])('parses typed coordinates %j', async (text) => {
    const w = make()
    await coords(w, text)
    expect(w.emitted('set')).toEqual([[29.33, -103.21]])
  })

  it.each([['abc'], ['29.33'], ['1,2,3'], ['']])('rejects malformed coordinates %j without emitting', async (text) => {
    const w = make()
    await coords(w, text)
    expect(w.emitted('set')).toBeUndefined()
    expect(w.find('.lp-coords-error').text()).toMatch(/like 29\.33, -103\.21/)
  })

  it('shows the lookup error from the parent and disables the controls while resolving', () => {
    const w = make({ error: 'No NWS forecast for this location (US only)', resolving: true })
    expect(w.find('[role="alert"]').text()).toContain('US only')
    for (const sel of ['button.lp-locate', 'form.lp-search button', 'form.lp-coords button']) {
      expect(w.find(sel).attributes('disabled')).toBeDefined()
    }
  })

  it('explains what is stored and what leaves the browser', () => {
    expect(make().find('.lp-privacy').text()).toMatch(/this browser.*open-meteo\.com.*weather\.gov/i)
  })
})
