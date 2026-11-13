import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppDock from '../src/components/AppDock.vue'

describe('AppDock', () => {
  const items = (w) => w.findAll('.dock-items button')

  it('renders one button per page, labelled by text only', () => {
    const w = mount(AppDock, { props: { modelValue: 'home' } })
    expect(items(w).map((b) => b.text())).toEqual(['home', 'sky', 'tonight', 'hourly', 'forecast', 'lunar'])
  })

  it('marks the current page active', () => {
    const w = mount(AppDock, { props: { modelValue: 'outlook' } }) // the outlook view is labelled "forecast"
    const active = items(w).filter((b) => b.classes().includes('active'))
    expect(active).toHaveLength(1)
    expect(active[0].text()).toBe('forecast')
    expect(active[0].attributes('aria-current')).toBe('page')
  })

  it('renders a single indicator inside the active item', async () => {
    const w = mount(AppDock, { props: { modelValue: 'tonight' } })
    expect(w.findAll('.dock-indicator')).toHaveLength(1)
    expect(w.find('.dock-item.active .dock-indicator').exists()).toBe(true)
    await w.setProps({ modelValue: 'lunar' })
    expect(w.findAll('.dock-indicator')).toHaveLength(1)
    expect(w.find('.dock-item.active').text()).toBe('lunar')
    expect(w.find('.dock-item.active .dock-indicator').exists()).toBe(true)
  })

  it('emits the chosen view on click', async () => {
    const w = mount(AppDock, { props: { modelValue: 'home' } })
    await items(w)[3].trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['forecast']]) // the fourth button is "hourly", whose view id is still 'forecast'
  })

  it('refresh emits, and is disabled while loading', async () => {
    const w = mount(AppDock, { props: { modelValue: 'home' } })
    await w.find('.refresh').trigger('click')
    expect(w.emitted('refresh')).toHaveLength(1)
    await w.setProps({ loading: true })
    expect(w.find('.refresh').attributes('disabled')).toBeDefined()
    expect(w.find('.refresh').classes()).toContain('spinning')
  })

  it('red toggle turns red mode on and off for the whole page', async () => {
    const w = mount(AppDock, { props: { modelValue: 'home' } })
    const btn = w.find('.red-toggle')
    expect(btn.attributes('aria-pressed')).toBe('false')
    await btn.trigger('click')
    expect(document.documentElement.classList.contains('red-mode')).toBe(true)
    expect(btn.attributes('aria-pressed')).toBe('true')
    await btn.trigger('click')
    expect(document.documentElement.classList.contains('red-mode')).toBe(false)
  })
})
