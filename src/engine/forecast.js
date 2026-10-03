import { altitude, moonIllumination, observerFor, twilightEvents } from './astro'
import { cloudPenalty, deduct, precipPenalty, scoreToRating, tempPenalty, windPenalty } from './rating'
import { fetchGridpoint, fetchHourly, pointProps, weatherFetchedAt } from './nws'
import { addDays, localDate, toLocalIso, zonedTime } from './time'

export const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10)

/** NWS wind string ("5 mph", "10 to 15 mph") → mph, taking the high end of a range. */
export function parseWindMph(s) {
  const nums = String(s ?? '').match(/\d+/g)
  return nums ? Number(nums.at(-1)) : null
}

function twilightPhase(sunAlt) {
  if (sunAlt <= -18) return 'dark'
  if (sunAlt <= -12) return 'astro twilight'
  if (sunAlt <= -6) return 'nautical twilight'
  if (sunAlt <= 0) return 'civil twilight'
  return 'daylight'
}

const TWILIGHT_PENALTY = {
  'civil twilight': [35, 'civil twilight'],
  'nautical twilight': [20, 'nautical twilight'],
  'astro twilight': [10, 'astronomical twilight'],
  daylight: [50, 'daylight'],
}

function humidityPenalty(h) {
  if (h == null) return [0]
  if (h >= 90) return [12, `very humid (${h.toFixed(0)}%) — heavy dew`]
  if (h >= 80) return [6, `humid (${h.toFixed(0)}%) — dew likely`]
  return [h >= 70 ? 2 : 0]
}

/** Per-hour score: shared brackets plus humidity, moonlight and twilight (not clamped). */
function rateHour(h) {
  const moon = h.moonUp && h.moonIllum != null
    ? [h.moonIllum * 20, `moon up (${(h.moonIllum * 100).toFixed(0)}%)`] : [0]
  const { score, reasons } = deduct([
    cloudPenalty(h.skyCover), precipPenalty(h.precipProb), humidityPenalty(h.humidity),
    tempPenalty(h.tempF), windPenalty(h.windMph), moon,
    h.isDark ? [0] : TWILIGHT_PENALTY[h.twilightPhase] ?? [0],
  ])
  return { rating: scoreToRating(score), reasons, score: round1(score) }
}

/** Rated rows for the NWS hourly periods starting in [start, end) (epoch ms). */
export function buildHours({ periods, start, end, sky, observer, moonIllum }) {
  return periods
    .filter((p) => { const t = Date.parse(p.startTime); return t >= start && t < end })
    .map((p) => {
      const t = new Date(p.startTime)
      const sunAlt = altitude('sun', t, observer)
      const moonAlt = altitude('moon', t, observer)
      const phase = twilightPhase(sunAlt)
      const h = {
        time: p.startTime,
        tempF: p.temperature ?? null,
        dewpointF: p.dewpoint?.value != null ? round1(p.dewpoint.value * 9 / 5 + 32) : null,
        skyCover: sky?.get(t.getTime()) ?? null,
        windMph: parseWindMph(p.windSpeed ?? '0 mph'),
        windDir: p.windDirection ?? '',
        humidity: p.relativeHumidity?.value ?? null,
        precipProb: p.probabilityOfPrecipitation?.value ?? null,
        shortForecast: p.shortForecast ?? '',
        sunAlt: round1(sunAlt),
        moonAlt: round1(moonAlt),
        moonIllum,
        twilightPhase: phase,
        moonUp: moonAlt > 0,
        isDark: phase === 'dark',
      }
      return { ...h, ...rateHour(h) }
    })
}

/** 19:00 local on `date` (default: today in `tz`) to 07:00 the next morning. */
function forecastWindow(now, date, tz) {
  if (date != null && !(/^\d{4}-\d{2}-\d{2}$/.test(date) && addDays(date, 0) === date)) {
    throw new Error(`Invalid date '${date}'. Use YYYY-MM-DD.`)
  }
  const day = date ?? localDate(now, tz)
  return { day, start: zonedTime(day, 19, 0, tz), end: zonedTime(addDays(day, 1), 7, 0, tz) }
}

/** Mark hours before sunset or after sunrise, from the almanac rather than the hourly sun altitude. */
function flagDaylight(hours, twilight) {
  const start = Date.parse(twilight.sunset ?? twilight.civilDusk)
  const end = Date.parse(twilight.sunrise ?? twilight.civilDawn)
  for (const h of hours) {
    const t = Date.parse(h.time)
    h.daylight = t < start || t > end
  }
}

/** Client-side equivalent of astro-cli GET /forecast: hourly conditions, evening to dawn. */
export async function buildForecast(location, { date } = {}, now = new Date()) {
  const tz = location.timezone
  const { day, start, end } = forecastWindow(now, date, tz)
  const errors = []
  let hours = []
  let elevationM = location.elevationM
  try {
    const props = await pointProps(location.latitude, location.longitude)
    // Gridpoint is optional: without it hours just lack sky cover.
    const [periods, grid] = await Promise.all([fetchHourly(props), fetchGridpoint(props).catch(() => null)])
    elevationM ??= grid?.elevationM == null ? null : Math.round(grid.elevationM)
    hours = buildHours({ periods, start: start.getTime(), end: end.getTime(), sky: grid?.skyCover,
                         observer: observerFor(location),
                         moonIllum: moonIllumination(new Date((start.getTime() + end.getTime()) / 2)) })
  } catch (e) {
    errors.push(`forecast: ${e.message}`)
  }
  const twilight = twilightEvents(location, day)
  flagDaylight(hours, twilight)
  return {
    generatedAt: weatherFetchedAt(),
    location: { ...location, elevationM },
    night: { startLocal: toLocalIso(start, tz), endLocal: toLocalIso(end, tz),
             startUtc: toLocalIso(start, 'UTC'), endUtc: toLocalIso(end, 'UTC'), timezone: tz },
    twilight,
    hours,
    errors,
  }
}
