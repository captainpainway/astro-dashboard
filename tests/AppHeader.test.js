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
