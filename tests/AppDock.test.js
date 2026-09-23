import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppDock from '../src/components/AppDock.vue'

describe('AppDock', () => {
  const items = (w) => w.findAll('.dock-items button')

  it('renders one button per page, labelled by text only', () => {
    const w = mount(AppDock, { props: { modelValue: 'home' } })
    expect(items(w).map((b) => b.text())).toEqual(['home', 'tonight', 'forecast', 'outlook', 'discover'])
  })

  it('marks the current page active', () => {
    const w = mount(AppDock, { props: { modelValue: 'outlook' } })
    const active = items(w).filter((b) => b.classes().includes('active'))
    expect(active).toHaveLength(1)
    expect(active[0].text()).toBe('outlook')
    expect(active[0].attributes('aria-current')).toBe('page')
  })

  it('emits the chosen view on click', async () => {
    const w = mount(AppDock, { props: { modelValue: 'home' } })
    await items(w)[2].trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['forecast']])
  })

  it('refresh emits, and is disabled while loading', async () => {
    const w = mount(AppDock, { props: { modelValue: 'home' } })
    await w.find('.refresh').trigger('click')
    expect(w.emitted('refresh')).toHaveLength(1)
    await w.setProps({ loading: true })
    expect(w.find('.refresh').attributes('disabled')).toBeDefined()
    expect(w.find('.refresh').classes()).toContain('spinning')
  })
})
