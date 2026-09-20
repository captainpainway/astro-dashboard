import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NightTimes from '../src/components/NightTimes.vue'

// Mirrors the live GET /forecast twilight block (site 28.8N, 2026-09-18).
const twilight = {
  date: '2026-09-18',
  sunset: '2026-09-18T19:27:46-04:00',
  sunrise: '2026-09-19T07:13:32-04:00',
  civilDusk: '2026-09-18T19:51:23-04:00',
  civilDawn: '2026-09-19T06:49:54-04:00',
  nauticalDusk: '2026-09-18T20:18:56-04:00',
  nauticalDawn: '2026-09-19T06:22:19-04:00',
  astroDusk: '2026-09-18T20:46:46-04:00',
  astroDawn: '2026-09-19T05:54:28-04:00',
  midnightSun: false,
  polarNight: false,
}

const polarNight = {
  date: '2026-12-21',
  sunset: null, sunrise: null,
  civilDusk: null, civilDawn: null,
  nauticalDusk: '2026-12-21T12:52:00+01:00',
  nauticalDawn: '2026-12-22T10:58:00+01:00',
  astroDusk: '2026-12-21T16:13:00+01:00',
  astroDawn: '2026-12-22T07:37:00+01:00',
  midnightSun: false,
  polarNight: true,
}

describe('NightTimes', () => {
  it('lists every twilight boundary with a time', () => {
    const w = mount(NightTimes, { props: { twilight } })
    const text = w.text()
    expect(text).toContain('sunset')
    expect(text).toContain('civil dusk')
    expect(text).toContain('nautical dusk')
    expect(text).toContain('full dark')
    expect(text).toContain('dark ends')
    expect(text).toContain('sunrise')
    expect(text).toContain('7:27 PM')
    expect(text).toContain('8:46 PM')
    expect(text).toContain('5:54 AM')
    expect(text).toContain('7:13 AM')
  })

  it('shows the sun-altitude thresholds so the phases are unambiguous', () => {
    const w = mount(NightTimes, { props: { twilight } })
    expect(w.text()).toContain('sun −6°')
    expect(w.text()).toContain('sun −12°')
    expect(w.text()).toContain('sun −18°')
  })

  it('reports sunset→sunrise and full-dark spans', () => {
    const w = mount(NightTimes, { props: { twilight } })
    // 19:27:46 → 07:13:32 = 11h 46m; 20:46:46 → 05:54:28 = 9h 08m
    expect(w.text()).toContain('11h 46m sunset → sunrise')
    expect(w.text()).toContain('9h 08m fully dark')
  })

  it('renders one bar segment per occurring phase, sized by duration', () => {
    const w = mount(NightTimes, { props: { twilight } })
    const segs = w.findAll('.tw-seg')
    expect(segs).toHaveLength(7)
    // Full darkness is the widest phase of the night at this latitude.
    const widths = segs.map((s) => parseFloat(s.attributes('style').match(/width: ([\d.]+)%/)[1]))
    expect(Math.max(...widths)).toBe(widths[3])
    expect(widths.every((x) => x > 0)).toBe(true)
  })

  it('omits boundaries that do not occur, and flags polar night', () => {
    const w = mount(NightTimes, { props: { twilight: polarNight } })
    expect(w.text()).toContain('polar night')
    expect(w.text()).not.toContain('sunset')
    expect(w.text()).not.toContain('civil dusk')
    // Two twilight boundaries each side of the dark window → 3 segments
    // (nautical→astro, astro→astro, astro→nautical); no civil segments.
    const segs = w.findAll('.tw-seg')
    expect(segs).toHaveLength(3)
    expect(segs.filter((s) => s.classes().includes('tw-dark'))).toHaveLength(1)
    expect(segs.filter((s) => s.classes().includes('tw-civil'))).toHaveLength(0)
  })

  it('compact mode drops the heading and the deep-twilight rows', () => {
    const w = mount(NightTimes, { props: { twilight, compact: true } })
    expect(w.find('h2').exists()).toBe(false)
    expect(w.text()).not.toContain('civil dusk')
    // The two rows that matter for planning a session stay.
    expect(w.text()).toContain('full dark')
    expect(w.text()).toContain('dark ends')
    expect(w.text()).toContain('9h 08m fully dark')
  })

  it('renders a placeholder when there is no twilight data', () => {
    const w = mount(NightTimes, { props: { twilight: null } })
    expect(w.text()).toContain('no sun or twilight times')
    expect(w.find('.tw-bar').exists()).toBe(false)
  })

  it('handles an all-null twilight object without a bar', () => {
    const w = mount(NightTimes, {
      props: { twilight: { date: '2026-09-18', sunset: null, sunrise: null, astroDusk: null, astroDawn: null } },
    })
    expect(w.text()).toContain('no sun or twilight times')
    expect(w.find('.tw-bar').exists()).toBe(false)
  })
})
