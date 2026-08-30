import { describe, expect, it } from 'vitest'
import { buildForecastQuery } from '../src/api'

describe('buildForecastQuery', () => {
  it('builds date param when provided', () => {
    expect(buildForecastQuery({ date: '2026-09-01' })).toBe('?date=2026-09-01')
  })
  it('returns empty string when no date', () => {
    expect(buildForecastQuery()).toBe('')
    expect(buildForecastQuery({})).toBe('')
  })
})