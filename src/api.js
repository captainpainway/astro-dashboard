import { buildForecast } from './engine/forecast'
import { buildOutlook } from './engine/outlook'

const BASE = '/api'

export function buildTonightQuery({ at, include } = {}) {
  // `:` is a legal unencoded query char and FastAPI decodes either form,
  // but keep it literal for readable URLs / test expectations.
  const parts = []
  if (at) parts.push(`at=${at}`)
  if (include?.length) for (const c of include) parts.push(`include=${c}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

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

export async function fetchTonight(opts = {}) {
  const res = await fetch(`${BASE}/tonight${buildTonightQuery(opts)}`)
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try { const body = await res.json(); if (body?.detail) detail = String(body.detail) } catch { /* keep status text */ }
    throw new Error(detail)
  }
  return res.json()
}