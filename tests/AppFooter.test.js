import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppFooter from '../src/components/AppFooter.vue'

describe('AppFooter', () => {
  it('links to the repository and to the credits file beside the page', () => {
    const links = mount(AppFooter).findAll('a').map((a) => [a.text(), a.attributes('href')])
    expect(links).toEqual([
      ['GitHub', 'https://github.com/captainpainway/astro-dashboard'],
      ['credits', `${import.meta.env.BASE_URL}credits.txt`],
    ])
  })
})
