import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppHeader from '../src/components/AppHeader.vue'

const header = (night) => mount(AppHeader, { props: { night, generatedAt: '' } }).find('.muted').text().replace(/\s+/g, ' ')

describe('AppHeader observing window', () => {
  it('names both days when the window runs past midnight', () => {
    expect(header({ startLocal: '2026-10-03T21:00:00-05:00', endLocal: '2026-10-04T05:00:00-05:00' }))
      .toBe('Sat, Oct 3 · 9:00 PM – Sun, Oct 4 · 5:00 AM')
  })

  it('names the day once when the window stays within it', () => {
    expect(header({ startLocal: '2026-10-04T02:28:10-05:00', endLocal: '2026-10-04T15:03:00-05:00' }))
      .toBe('Sun, Oct 4 · 2:28 AM – 3:03 PM')
  })
})

describe('AppHeader generated line', () => {
  const generated = (generatedAt) => mount(AppHeader, { props: { generatedAt } }).find('.generated')

  it('holds an invisible full-width stand-in until the weather is in, so nothing below shifts when it arrives', () => {
    // a blank line could sit beside a short location name, then wrap under it once the time arrived (CLS 0.38)
    const pending = generated('')
    expect(pending.classes()).toContain('pending')
    expect(pending.text()).toMatch(/^Generated @ \w{3} \d+, \d+:\d{2} [AP]M$/)
    const done = generated('2026-08-31T02:41:03+00:00')
    expect(done.classes()).not.toContain('pending')
    expect(done.text()).toMatch(/^Generated @ /)
  })
})
