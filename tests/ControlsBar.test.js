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

  it('choosing a time emits it as HH:MM', async () => {
    const w = make({ mode: 'instant' })
    await timeSelect(w).find('.glass-select-trigger').trigger('click')
    await timeSelect(w).findAll('[role="option"]').find((o) => o.text() === '11:00 PM').trigger('click')
    expect(w.emitted('update:atTime')).toEqual([['23:00']])
    w.unmount()
  })

  const chip = (w, label) => w.findAll('.controls button').find((b) => b.text() === label)

  it('shows a chasing light on the clicked class chip until loading settles', async () => {
    const w = make({ activeClasses: ['planet', 'moon'] })
    await chip(w, 'moon').trigger('click')
    expect(w.emitted('update:activeClasses')).toEqual([[['planet']]])
    await w.setProps({ loading: true })
    expect(chip(w, 'moon').classes()).toContain('chasing')
    expect(chip(w, 'moon').attributes('aria-busy')).toBe('true')
    expect(w.findAll('.chasing')).toHaveLength(1)
    await w.setProps({ loading: false })
    expect(w.find('.chasing').exists()).toBe(false)
    expect(chip(w, 'moon').attributes('aria-busy')).toBeUndefined()
    // a later refresh not started by a chip lights nothing
    await w.setProps({ loading: true })
    expect(w.find('.chasing').exists()).toBe(false)
    w.unmount()
  })

  it('no chasing light for clicks that do not refetch', async () => {
    const w = make()
    await chip(w, 'tonight').trigger('click') // already the active mode
    await chip(w, 'planet').trigger('click') // protected last class
    expect(w.emitted('update:mode')).toBeUndefined()
    await w.setProps({ loading: true })
    expect(w.find('.chasing').exists()).toBe(false)
    w.unmount()
  })

  it('the light follows the most recently clicked chip', async () => {
    const w = make({ activeClasses: ['planet', 'moon'] })
    await chip(w, 'moon').trigger('click')
    await w.setProps({ loading: true })
    await chip(w, 'at time').trigger('click')
    expect(w.emitted('update:mode')).toEqual([['instant']])
    expect(w.findAll('.chasing').map((b) => b.text())).toEqual(['at time'])
    w.unmount()
  })

  it('changing the time lights the "at time" chip', async () => {
    const w = make({ mode: 'instant' })
    await timeSelect(w).find('.glass-select-trigger').trigger('click')
    await timeSelect(w).findAll('[role="option"]').find((o) => o.text() === '11:00 PM').trigger('click')
    await w.setProps({ loading: true })
    expect(w.findAll('.chasing').map((b) => b.text())).toEqual(['at time'])
    await w.setProps({ loading: false })
    expect(w.find('.chasing').exists()).toBe(false)
    w.unmount()
  })

  it('re-choosing the current time does not light anything', async () => {
    const w = make({ mode: 'instant' })
    await timeSelect(w).find('.glass-select-trigger').trigger('click')
    await timeSelect(w).findAll('[role="option"]').find((o) => o.text() === '10:30 PM').trigger('click')
    await w.setProps({ loading: true })
    expect(w.find('.chasing').exists()).toBe(false)
    w.unmount()
  })
})
