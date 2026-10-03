const GEOCODER = 'https://geocoding-api.open-meteo.com/v1/search'

/** US places matching a city name or ZIP code (Open-Meteo geocoder: CORS-enabled, no key). */
export async function searchPlaces(query) {
  const q = query.trim()
  if (q.length < 2) return []
  const res = await fetch(`${GEOCODER}?name=${encodeURIComponent(q)}&count=8&language=en&format=json&countryCode=US`)
  if (!res.ok) throw new Error(`City search failed (${res.status})`)
  const { results = [] } = await res.json()
  return results.filter((r) => r.country_code === 'US')
    .map((r) => ({ id: r.id, name: r.name, state: r.admin1 ?? '', latitude: r.latitude, longitude: r.longitude }))
}
