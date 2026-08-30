import { describe, expect, it } from 'vitest'
import { buildTonightQuery } from '../src/api'

describe('buildTonightQuery', () => {
  it('builds at + repeatable include params', () => {
    expect(buildTonightQuery({ at: '22:30', include: ['planet', 'moon'] }))
      .toBe('?at=22:30&include=planet&include=moon')
  })
  it('returns empty string for no options', () => {
    expect(buildTonightQuery()).toBe('')
    expect(buildTonightQuery({ include: [] })).toBe('')
  })
  it('skips at when not provided', () => {
    expect(buildTonightQuery({ include: ['nebula'] })).toBe('?include=nebula')
  })
})