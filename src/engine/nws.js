const NWS = 'https://api.weather.gov'

/** Round a coordinate to 2 decimals (~1 km), so stored/sent locations stay coarse. */
export const roundCoord = (x) => Math.round(x * 100) / 100

const validCoords = (lat, lon) =>
  Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180

/**
 * Resolve coordinates to a location via NWS /points (same shape as the API's `location`).
 * Throws a readable Error for invalid coordinates, places NWS doesn't cover, or NWS failures.
 */
export async function resolvePoint(lat, lon) {
  if (!validCoords(lat, lon)) throw new Error('Latitude must be -90 to 90 and longitude -180 to 180')
  const latitude = roundCoord(lat)
  const longitude = roundCoord(lon)
  const res = await fetch(`${NWS}/points/${latitude},${longitude}`)
  if (res.status === 404) throw new Error('No NWS forecast for this location (US only)')
  if (!res.ok) throw new Error(`NWS ${res.status} ${res.statusText}`)
  const props = (await res.json()).properties
  const { city, state } = props.relativeLocation.properties
  // Elevation isn't in /points; the gridpoint fetch supplies it.
  return { name: `${city}, ${state}`, latitude, longitude, elevationM: null, timezone: props.timeZone }
}
