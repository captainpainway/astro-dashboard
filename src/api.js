const BASE = '/api'

export function buildTonightQuery({ at, include } = {}) {
  // `:` is a legal unencoded query char and FastAPI decodes either form,
  // but keep it literal for readable URLs / test expectations.
  const parts = []
  if (at) parts.push(`at=${at}`)
  if (include?.length) for (const c of include) parts.push(`include=${c}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

export function buildForecastQuery({ date } = {}) {
  return date ? `?date=${date}` : ''
}

export async function fetchForecast(opts = {}) {
  const res = await fetch(`${BASE}/forecast${buildForecastQuery(opts)}`)
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