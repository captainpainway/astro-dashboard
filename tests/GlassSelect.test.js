import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import GlassSelect from '../src/components/GlassSelect.vue'

describe('GlassSelect', () => {
  const options = [
    { value: 'score', label: 'score' },
    { value: 'bestTime', label: 'best time' },
    { value: 'maxAlt', label: 'altitude' },
    { value: 'name', label: 'name' },
  ]
  const make = (over = {}) =>
    mount(GlassSelect, { props: { options, modelValue: 'score', label: 'sort by', ...over }, attachTo: document.body })
  const trigger = (w) => w.find('.glass-select-trigger')
  const listbox = (w) => w.find('[role="listbox"]')

  it('shows the current option on the trigger, menu closed', () => {
    const w = make({ modelValue: 'maxAlt' })
    expect(trigger(w).text()).toBe('altitude')
    expect(trigger(w).attributes('aria-expanded')).toBe('false')
    expect(listbox(w).exists()).toBe(false)
    w.unmount()
  })

  it('opens on click and marks the current option selected', async () => {
    const w = make()
    await trigger(w).trigger('click')
    const opts = w.findAll('[role="option"]')
    expect(opts.map((o) => o.text())).toEqual(['score', 'best time', 'altitude', 'name'])
    expect(opts[0].attributes('aria-selected')).toBe('true')
    expect(trigger(w).attributes('aria-expanded')).toBe('true')
    w.unmount()
  })

  it('clicking an option emits its value and closes', async () => {
    const w = make()
    await trigger(w).trigger('click')
    await w.findAll('[role="option"]')[3].trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['name']])
    expect(listbox(w).exists()).toBe(false)
    w.unmount()
  })

  it('arrow down then Enter picks the next option', async () => {
    const w = make()
    await trigger(w).trigger('keydown', { key: 'ArrowDown' })
    await listbox(w).trigger('keydown', { key: 'ArrowDown' })
    const active = listbox(w).attributes('aria-activedescendant')
    expect(w.find(`[id="${active}"]`).text()).toBe('best time')
    await listbox(w).trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')).toEqual([['bestTime']])
    w.unmount()
  })

  it('Escape closes without choosing and refocuses the trigger', async () => {
    const w = make()
    await trigger(w).trigger('click')
    await listbox(w).trigger('keydown', { key: 'Escape' })
    expect(listbox(w).exists()).toBe(false)
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(document.activeElement).toBe(trigger(w).element)
    w.unmount()
  })

  it('clicking outside closes the menu', async () => {
    const w = make()
    await trigger(w).trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(listbox(w).exists()).toBe(false)
    w.unmount()
  })

  it('without a visible label, names the trigger and menu from ariaLabel', async () => {
    const w = make({ label: '', ariaLabel: 'time' })
    expect(w.find('.glass-select-label').exists()).toBe(false)
    expect(trigger(w).attributes('aria-label')).toBe('time score')
    await trigger(w).trigger('click')
    expect(listbox(w).attributes('aria-label')).toBe('time')
    w.unmount()
  })
})
