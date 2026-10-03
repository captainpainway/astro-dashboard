import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ControlsBar from '../src/components/ControlsBar.vue'

describe('ControlsBar', () => {
  const props = { mode: 'window', atTime: '22:30', activeClasses: ['planet'], sortKey: 'score' }
  const make = (over = {}) => mount(ControlsBar, { props: { ...props, ...over }, attachTo: document.body })
  const timeSelect = (w) => w.find('.time-select')

  it('sort menu emits update:sortKey', async () => {
    const w = make()
    await w.find('.sorts .glass-select-trigger').trigger('click')
    await w.findAll('.sorts [role="option"]')[2].trigger('click')
    expect(w.emitted('update:sortKey')).toEqual([['maxAlt']])
    w.unmount()
  })

  it('no time select in tonight mode', () => {
    const w = make()
    expect(timeSelect(w).exists()).toBe(false)
    w.unmount()
  })

  it('at-time mode lists 6:00 PM to 6:00 AM in 30-minute steps, current time selected', async () => {
    const w = make({ mode: 'instant' })
    expect(timeSelect(w).find('.glass-select-trigger').text()).toBe('10:30 PM')
    await timeSelect(w).find('.glass-select-trigger').trigger('click')
    const opts = timeSelect(w).findAll('[role="option"]')
    expect(opts).toHaveLength(25)
    expect(opts[0].text()).toBe('6:00 PM')
    expect(opts[12].text()).toBe('12:00 AM')
    expect(opts.at(-1).text()).toBe('6:00 AM')
    expect(timeSelect(w).find('[aria-selected="true"]').text()).toBe('10:30 PM')
    w.unmount()
  })

  it('at-time mode runs from sunset to sunrise, each rounded to the nearest half hour', async () => {
    const twilight = { sunset: '2026-10-03T19:09:30-05:00', sunrise: '2026-10-04T07:47:10-05:00' }
    const w = make({ mode: 'instant', twilight })
    await timeSelect(w).find('.glass-select-trigger').trigger('click')
    const opts = timeSelect(w).findAll('[role="option"]').map((o) => o.text())
    expect(opts[0]).toBe('7:00 PM') // sunset 7:09
    expect(opts.at(-1)).toBe('8:00 AM') // sunrise 7:47
    expect(opts).toHaveLength(27)
    expect(opts).toContain('12:00 AM')
    w.unmount()
  })

  it('falls back to 6:00 PM - 6:00 AM where the Sun does not set or rise', async () => {
    const w = make({ mode: 'instant', twilight: { sunset: null, sunrise: null } })
    await timeSelect(w).find('.glass-select-trigger').trigger('click')
    const opts = timeSelect(w).findAll('[role="option"]').map((o) => o.text())
    expect([opts[0], opts.at(-1), opts.length]).toEqual(['6:00 PM', '6:00 AM', 25])
    w.unmount()
  })

  it('choosing a time emits it as HH:MM', async () => {
    const w = make({ mode: 'instant' })
    await timeSelect(w).find('.glass-select-trigger').trigger('click')
    await timeSelect(w).findAll('[role="option"]').find((o) => o.text() === '11:00 PM').trigger('click')
    expect(w.emitted('update:atTime')).toEqual([['23:00']])
    w.unmount()
  })

  const chip = (w, label) => w.findAll('.controls button').find((b) => b.text() === label)

  it('toggling a class chip emits the new set, and the last class cannot be deselected', async () => {
    const w = make({ activeClasses: ['planet', 'moon'] })
    await chip(w, 'moon').trigger('click')
    expect(w.emitted('update:activeClasses')).toEqual([[['planet']]])
    await w.setProps({ activeClasses: ['planet'] })
    await chip(w, 'planet').trigger('click')
    expect(w.emitted('update:activeClasses')).toHaveLength(1)
    w.unmount()
  })

  it('mode buttons emit only when the mode changes', async () => {
    const w = make()
    await chip(w, 'tonight').trigger('click') // already the active mode
    expect(w.emitted('update:mode')).toBeUndefined()
    await chip(w, 'at time').trigger('click')
    expect(w.emitted('update:mode')).toEqual([['instant']])
    w.unmount()
  })

  it('re-choosing the current time emits nothing', async () => {
    const w = make({ mode: 'instant' })
    await timeSelect(w).find('.glass-select-trigger').trigger('click')
    await timeSelect(w).findAll('[role="option"]').find((o) => o.text() === '10:30 PM').trigger('click')
    expect(w.emitted('update:atTime')).toBeUndefined()
    w.unmount()
  })
})
