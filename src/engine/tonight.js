import { twilightEvents } from './astro'
import { round1 } from './forecast'
import { fetchGridpoint, fetchHourly, fetchObservation, pointProps, weatherFetchedAt } from './nws'
import { cloudFromText } from './outlook'
import { rateConditions } from './rating'
import { TARGET_CLASSES, generatePlan, timeGrid } from './scoring'
import { localDate, nextOccurrence, toLocalIso, tonightWindow } from './time'

const AT_RE = /^([01]?\d|2[0-3]):[0-5]\d$/
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** NWS wind string → mph: "5 to 10 mph" gives the integer midpoint (astro-cli), "10 mph" gives 10. */
function windMid(s) {
  const n = String(s ?? '').match(/\d+/g)?.map(Number)
  return n ? Math.floor(n.reduce((a, b) => a + b, 0) / n.length) : null
}

/** Gridded sky cover valid at `ms`: the exact hour, else the nearest bucket. */
function skyAt(sky, ms) {
  if (!sky?.size) return null
  if (sky.has(ms)) return sky.get(ms)
  let best = null
  let bestDiff = Infinity
  for (const [t, v] of sky) {
    if (Math.abs(t - ms) < bestDiff) { best = v; bestDiff = Math.abs(t - ms) }
  }
  return best
}

/** Averages over the hourly periods starting in [start, end] (epoch ms), rated on the shared scale. */
function summarizeNight(periods, sky, start, end) {
  const inWindow = periods.filter((p) => { const t = Date.parse(p.startTime); return t >= start && t <= end })
  // astro-cli returns an all-null summary (no rating at all) when no hourly period falls in the window.
  if (!inWindow.length) {
    return { cloudCoverAvg: null, temperatureF: null, windMphAvg: null, precipProbAvg: null, rating: null, score: null, reasons: [] }
  }
  const cloud = []
  const temps = []
  const winds = []
  const precip = []
  for (const p of inWindow) {
    const c = skyAt(sky, Date.parse(p.startTime)) ?? cloudFromText(p.shortForecast)
    if (c != null) cloud.push(c)
    if (p.temperature != null) temps.push(p.temperature)
    const pp = p.probabilityOfPrecipitation?.value
    if (pp != null) precip.push(pp)
    const w = windMid(p.windSpeed)
    if (w != null) winds.push(w)
  }
  const cloudCoverAvg = mean(cloud)
  const windMphAvg = mean(winds)
  const precipProbAvg = mean(precip)
  const temperatureF = temps.length ? Math.min(...temps) : null
  const { score, rating, reasons } = rateConditions(cloudCoverAvg, windMphAvg, temperatureF, precipProbAvg)
  return { cloudCoverAvg, temperatureF, windMphAvg, precipProbAvg, rating, score, reasons }
}

/** Hourly period closest to `when` (epoch ms), with its cloud estimate and rating. */
function weatherAtTime(periods, sky, when) {
  let best = null
  let bestDiff = Infinity
  for (const p of periods) {
    const d = Math.abs(Date.parse(p.startTime) - when)
    if (d < bestDiff) { best = p; bestDiff = d }
  }
  if (!best) return { cloudCover: null, temperatureF: null, windMph: null, rating: null, forecast: 'N/A' }
  const cloudCover = skyAt(sky, when) ?? cloudFromText(best.shortForecast)
  const temperatureF = best.temperature ?? null
  const windMph = windMid(best.windSpeed)
  const { rating } = rateConditions(cloudCover, windMph, temperatureF, best.probabilityOfPrecipitation?.value ?? null)
  return { cloudCover, temperatureF, windMph, rating, forecast: best.shortForecast ?? 'N/A' }
}

const LAYER_CLOUD = { FEW: 15, SCT: 40, BKN: 75, OVC: 100, VV: 100 }

/** Cloud % from an observation's layers; a ceilometer sees only low cloud, so this is a fallback. */
function cloudFromLayers(layers) {
  if (!layers?.length) return null
  let total = 0
  for (const { amount } of layers) {
    const a = (amount ?? '').toUpperCase()
    if (a === 'CLR' || a === 'SKC') return 0
    total = Math.max(total, LAYER_CLOUD[a] ?? 0)
  }
  return total || null
}

const describeSky = (c) => (c == null ? 'Unknown' : c <= 5 ? 'Clear' : c <= 35 ? 'Mostly clear'
  : c <= 65 ? 'Partly cloudy' : c <= 87 ? 'Mostly cloudy' : 'Overcast')

/** Latest station observation; cloud prefers the gridded value (it sees high cloud), then layers, then text. */
async function currentConditions(props, sky, now) {
  const found = await fetchObservation(props)
  if (!found) return { cloudCover: null, temperatureF: null, windMph: null, description: 'No stations', station: null, timestamp: null }
  const { station, obs } = found
  const cloudCover = skyAt(sky, now.getTime()) ?? cloudFromLayers(obs.cloudLayers) ?? cloudFromText(obs.textDescription ?? 'Unknown')
  const tempC = obs.temperature?.value
  const kmh = obs.windSpeed?.value
  return {
    cloudCover,
    temperatureF: tempC == null ? null : round1(tempC * 9 / 5 + 32),
    windMph: kmh == null ? null : round1(kmh * 0.621371),
    description: describeSky(cloudCover),
    station,
    timestamp: obs.timestamp ?? null,
  }
}

/** Client-side equivalent of astro-cli GET /tonight: ranked plan for tonight, or the sky at `at` (HH:MM). */
export async function buildTonight(location, { at, include } = {}, now = new Date()) {
  const tz = location.timezone
  if (at != null && !AT_RE.test(at)) throw new Error(`Invalid time '${at}'. Use HH:MM.`)
  const bad = (include ?? []).filter((c) => !TARGET_CLASSES.includes(c))
  if (bad.length) throw new Error(`Unknown target class(es) ${JSON.stringify(bad)}; choose from ${JSON.stringify(TARGET_CLASSES)}`)

  let instant = null
  if (at != null) {
    const [h, m] = at.split(':').map(Number)
    instant = nextOccurrence(now, h, m, tz)
  }
  const { start, end } = instant ? { start: instant, end: instant } : tonightWindow(now, tz)

  const errors = []
  const fail = (e) => errors.push(`weather: ${e.message}`)
  let hourly = null
  let grid = null
  let current = null
  try {
    const props = await pointProps(location.latitude, location.longitude)
    // Gridpoint is optional: without it cloud falls back to forecast text.
    const gridP = fetchGridpoint(props).catch(() => null)
    const [h, c] = await Promise.allSettled([fetchHourly(props), gridP.then((g) => currentConditions(props, g?.skyCover, now))])
    grid = await gridP
    if (h.status === 'fulfilled') hourly = h.value; else fail(h.reason)
    if (c.status === 'fulfilled') current = c.value; else fail(c.reason)
  } catch (e) {
    fail(e)
  }

  const elevationM = location.elevationM ?? (grid?.elevationM == null ? null : Math.round(grid.elevationM))
  const loc = { ...location, elevationM }
  const instruments = generatePlan(loc, instant ? [instant] : timeGrid(start, end), include?.length ? include : TARGET_CLASSES)
  const twilight = twilightEvents(loc, localDate(start, tz))
  const sky = grid?.skyCover
  const common = { generatedAt: weatherFetchedAt(), location: loc, twilight, instruments, errors: [...new Set(errors)] }
  if (instant) {
    return { ...common, mode: 'instant',
             at: { local: toLocalIso(instant, tz), utc: toLocalIso(instant, 'UTC'), timezone: tz },
             weather: { current, atTime: hourly && weatherAtTime(hourly, sky, instant.getTime()) } }
  }
  return { ...common, mode: 'window',
           night: { startLocal: toLocalIso(start, tz), endLocal: toLocalIso(end, tz),
                    startUtc: toLocalIso(start, 'UTC'), endUtc: toLocalIso(end, 'UTC'), timezone: tz },
           weather: { summary: hourly && summarizeNight(hourly, sky, start.getTime(), end.getTime()), current } }
}
