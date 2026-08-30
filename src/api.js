const BASE = '/api'

export function buildTonightQuery({ at, include } = {}) {
  const params = new URLSearchParams()
  if (at) params.set('at', at)
  if (include?.length) for (const c of include) params.append('include', c)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
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