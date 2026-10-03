import { buildForecast } from './engine/forecast'
import { buildOutlook } from './engine/outlook'
import { buildTonight } from './engine/tonight'

const BASE = '/api'

/** Tonight's ranked plan (or the sky at `at`), computed in the browser for `location`. */
export const fetchTonight = ({ at, include, location } = {}) => buildTonight(location, { at, include })

/** Hourly conditions for one night, computed in the browser for `location`. */
export const fetchForecast = ({ date, location } = {}) => buildForecast(location, { date })

/** One rated row per upcoming night, computed in the browser for `location`. */
export const fetchOutlook = ({ nights, location } = {}) => buildOutlook(location, { nights })

export function buildDiscoverQuery({ limit, charts } = {}) {
  const parts = []
  if (limit != null) parts.push(`limit=${limit}`)
  if (charts) parts.push('charts=true')
  return parts.length ? `?${parts.join('&')}` : ''
}

export async function fetchDiscover(opts = {}) {
  const res = await fetch(`${BASE}/discover${buildDiscoverQuery(opts)}`)
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try { const body = await res.json(); if (body?.detail) detail = String(body.detail) } catch { /* keep status text */ }
    throw new Error(detail)
  }
  return res.json()
}
