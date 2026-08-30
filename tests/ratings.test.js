import { describe, expect, it } from 'vitest'
import { ratingStyle } from '../src/ratings'

describe('ratingStyle', () => {
  it('maps known ratings to labels and css classes', () => {
    expect(ratingStyle('good')).toEqual({ label: 'Good', css: 'rating-good' })
    expect(ratingStyle('ideal').css).toBe('rating-ideal')
  })
  it('falls back for unknown or null', () => {
    expect(ratingStyle('weird')).toEqual({ label: 'weird', css: 'rating-none' })
    expect(ratingStyle(null)).toEqual({ label: '—', css: 'rating-none' })
  })
})