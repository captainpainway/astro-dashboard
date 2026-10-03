const NWS = 'https://api.weather.gov'
const HOUR = 3_600_000

/** Round a coordinate to 2 decimals (~1 km), so stored/sent locations stay coarse. */
export const roundCoord = (x) => Math.round(x * 100) / 100

const validCoords = (lat, lon) =>
  Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180

async function getJson(url) {
  const res = await fetch(url)
  if (res.status === 404 && url.includes('/points/')) throw new Error('No NWS forecast for this location (US only)')
  if (!res.ok) throw new Error(`NWS ${res.status} ${res.statusText}`)
  return res.json()
}

/** NWS /points metadata (forecast URLs, timezone, place) for rounded coordinates. */
export const pointProps = async (lat, lon) => (await getJson(`${NWS}/points/${lat},${lon}`)).properties

/**
 * Resolve coordinates to a location via NWS /points (same shape as the API's `location`).
 * Throws a readable Error for invalid coordinates, places NWS doesn't cover, or NWS failures.
 */
export async function resolvePoint(lat, lon) {
  if (!validCoords(lat, lon)) throw new Error('Latitude must be -90 to 90 and longitude -180 to 180')
  const latitude = roundCoord(lat)
  const longitude = roundCoord(lon)
  const props = await pointProps(latitude, longitude)
  const { city, state } = props.relativeLocation.properties
  // Elevation isn't in /points; the gridpoint fetch supplies it.
  return { name: `${city}, ${state}`, latitude, longitude, elevationM: null, timezone: props.timeZone }
}

/** Hourly forecast periods (~156 h ahead). */
export const fetchHourly = async (props) => (await getJson(props.forecastHourly)).properties.periods

/** Night periods ("Tonight", "Monday Night", ...) of the 12-hour forecast, earliest first. */
export const fetchNightPeriods = async (props) =>
  (await getJson(props.forecast)).properties.periods.filter((p) => !p.isDaytime)

/** Gridpoint sky cover (hourly Map) and grid-cell elevation in metres. */
export async function fetchGridpoint(props) {
  const g = (await getJson(props.forecastGridData)).properties
  return { skyCover: expandDurationSeries(g.skyCover?.values ?? []), elevationM: g.elevation?.value ?? null }
}

/**
 * Expand an NWS ISO-duration series ("…/PT2H", "…/P1DT6H") into Map<utcMs, value>,
 * one entry per hour. (astro-cli only parsed "PTnH", so day durations collapsed to 1 h.)
 */
export function expandDurationSeries(values) {
  const out = new Map()
  for (const { validTime, value } of values) {
    const [start, duration] = validTime.split('/')
    const m = /^P(?:(\d+)D)?(?:T(\d+)H)?/.exec(duration)
    const hours = (Number(m?.[1] ?? 0) * 24 + Number(m?.[2] ?? 0)) || 1
    const t0 = Date.parse(start)
    for (let h = 0; h < hours; h++) out.set(t0 + h * HOUR, value)
  }
  return out
}

/** Latest observation from the nearest station: { station: "ID (name)", obs } or null if none are listed. */
export async function fetchObservation(props) {
  const stations = (await getJson(props.observationStations)).features
  if (!stations?.length) return null
  const { stationIdentifier: id, name } = stations[0].properties
  const obs = (await getJson(`${NWS}/stations/${id}/observations/latest`)).properties
  return { station: `${id} (${name})`, obs }
}
