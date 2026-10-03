import { altitude, moonIllumination, observerFor, twilightEvents } from './astro'
import { buildHours, floorHour, parseWindMph, round1, summarizeHours } from './forecast'
import { fetchGridpoint, fetchHourly, fetchNightPeriods, pointProps, weatherFetchedAt } from './nws'
import { rateConditions } from './rating'
import { localDate, toLocalIso } from './time'

const HOUR = 3_600_000
const MOON_STEP = 30 * 60_000

// Longest phrases first so "mostly clear" isn't read as "clear"; precip-only words last.
const CLOUD_WORDS = [
  ['mostly clear', 10], ['mostly sunny', 10], ['partly cloudy', 40], ['partly sunny', 40],
  ['mostly cloudy', 75], ['clear', 0], ['cloudy', 90], ['overcast', 100], ['fair', 10],
  ['fog', 80], ['haze', 30], ['thunderstorm', 85], ['showers', 75], ['rain', 85], ['drizzle', 70],
]

/** Cloud cover % estimated from forecast text ("Partly Cloudy" → 40), or null. */
export function cloudFromText(text) {
  const t = (text ?? '').toLowerCase()
  return CLOUD_WORDS.find(([phrase]) => t.includes(phrase))?.[1] ?? null
}

/** Mean gridded sky cover over [start, end), or null unless the grid covers at least half of it. */
function gridCloudForWindow(sky, start, end) {
  if (!sky?.size || end <= start) return null
  const keys = [...sky.keys()].sort((a, b) => a - b)
  let total = 0
  let covered = 0
  for (let cur = start; cur < end; cur += HOUR) {
    const k = keys.findLast((key) => key <= cur)
    if (k !== undefined && cur < k + HOUR) {
      total += sky.get(k)
      covered += 1
    }
  }
  return covered === 0 || covered < 0.5 * ((end - start) / HOUR) ? null : total / covered
}

function tempToF(p) {
  if (p.temperature == null) return null
  return p.temperatureUnit === 'C' ? round1(p.temperature * 9 / 5 + 32) : Number(p.temperature)
}

/** Client-side equivalent of astro-cli GET /outlook: one rated row per upcoming night. */
export async function buildOutlook(location, { nights = 7 } = {}) {
  const tz = location.timezone
  const observer = observerFor(location)
  const errors = []
  const rows = []
  let elevationM = location.elevationM
  try {
    const props = await pointProps(location.latitude, location.longitude)
    const periods = (await fetchNightPeriods(props)).slice(0, nights)
    // Gridpoint and hourly are optional: text cloud estimates / no hourly detail instead.
    const [grid, hourly] = periods.length
      ? await Promise.all([fetchGridpoint(props).catch(() => null), fetchHourly(props).catch(() => null)])
      : [null, null]
    elevationM ??= grid?.elevationM == null ? null : Math.round(grid.elevationM)

    // Each night runs from sunset to sunrise (the NWS period's own hours where the Sun doesn't set or rise).
    const twilightByDay = new Map()
    const spans = periods.map((p) => {
      const periodStart = Date.parse(p.startTime)
      const periodEnd = Date.parse(p.endTime)
      if (Number.isNaN(periodStart) || Number.isNaN(periodEnd)) return null
      const day = localDate(new Date(periodStart), tz)
      // A period already under way after midnight belongs to the evening before.
      const nightDay = localDate(new Date(periodStart - 12 * HOUR), tz)
      if (!twilightByDay.has(nightDay)) twilightByDay.set(nightDay, twilightEvents(location, nightDay))
      const twilight = twilightByDay.get(nightDay)
      return { p, day, twilight,
               start: twilight.sunset ? Date.parse(twilight.sunset) : periodStart,
               end: twilight.sunrise ? Date.parse(twilight.sunrise) : periodEnd }
    }).filter(Boolean)

    // One Moon altitude curve over the whole span, sampled like astro-cli (30 min).
    const moonCurve = []
    if (spans.length) {
      const last = Math.max(...spans.map((n) => n.end)) + HOUR
      for (let t = Math.min(...spans.map((n) => n.start)) - HOUR; t <= last; t += MOON_STEP) {
        moonCurve.push([t, altitude('moon', new Date(t), observer)])
      }
    }

    for (const { p, day, twilight, start, end } of spans) {
      // The night's numbers and rating come from its hourly rows (as on the home page); the NWS period's own
      // cloud, temperature, wind and rain only stand in where there is no hourly data with sky cover.
      const hours = hourly ? buildHours({ periods: hourly, start: floorHour(start), end: floorHour(end) + HOUR,
                                          sky: grid?.skyCover, observer, moonIllum: moonIllumination(new Date((start + end) / 2)) }) : []
      const summary = summarizeHours(hours)
      let cloudCover = gridCloudForWindow(grid?.skyCover, start, end)
      let cloudSource = cloudCover != null ? 'grid' : ''
      if (cloudCover == null) {
        cloudCover = cloudFromText(p.shortForecast)
        cloudSource = cloudCover != null ? 'text' : ''
      }

      const samples = moonCurve.filter(([t]) => t >= start && t < end)
      const up = samples.filter(([, alt]) => alt > 0).length
      const moonIllum = moonIllumination(new Date((start + end) / 2))
      const period = { tempF: tempToF(p), windMph: parseWindMph(p.windSpeed), precipProb: p.probabilityOfPrecipitation?.value ?? null }
      const night = summary ?? { cloudCover, ...period, ...rateConditions(cloudCover, period.windMph, period.tempF, period.precipProb) }
      rows.push({
        date: day,
        label: p.name ?? '',
        start: toLocalIso(new Date(start), tz),
        end: toLocalIso(new Date(end), tz),
        tempF: night.tempF,
        windMph: night.windMph,
        windDir: p.windDirection ?? '',
        cloudCover: night.cloudCover,
        cloudSource: summary ? 'grid' : cloudSource,
        precipProb: night.precipProb,
        shortForecast: p.shortForecast ?? '',
        moonIllum,
        moonUpFraction: samples.length ? up / samples.length : null,
        darkHours: samples.length ? (samples.length - up) * ((end - start) / HOUR / samples.length) : null,
        rating: night.rating,
        reasons: night.reasons,
        score: round1(night.score),
        hours,
        twilight,
      })
    }
  } catch (e) {
    errors.push(`outlook: ${e.message}`)
  }
  return { generatedAt: weatherFetchedAt(), location: { ...location, elevationM }, timezone: tz,
           nights: rows, errors }
}
