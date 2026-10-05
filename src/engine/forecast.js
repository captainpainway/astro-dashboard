import { altitude, moonIllumination, observerFor, twilightEvents } from './astro'
import { cloudPenalty, deduct, precipPenalty, rateConditions, scoreToRating, tempPenalty, windPenalty } from './rating'
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

/** The night of `date` as 'YYYY-MM-DD'; by default tonight: the night in progress until its sunrise, else today's. */
function forecastDay(location, now, date) {
  if (date != null && !(/^\d{4}-\d{2}-\d{2}$/.test(date) && addDays(date, 0) === date)) {
    throw new Error(`Invalid date '${date}'. Use YYYY-MM-DD.`)
  }
  if (date != null) return date
  const today = localDate(now, location.timezone)
  const last = addDays(today, -1)
  const sunrise = twilightEvents(location, last).sunrise
  return sunrise && now < new Date(sunrise) ? last : today
}

/**
 * One summary of a night from its hourly rows, shared by every view that shows a night so they agree: weather averages
 * over the dark hours (all hours if none is dark), rated by the mean of those hours' scores. null without sky-cover
 * data, since an hour with unknown cloud scores as clear.
 */
export function summarizeHours(hours) {
  const dark = hours.filter((h) => h.isDark)
  const use = dark.length ? dark : hours
  const vals = (key) => use.map((h) => h[key]).filter((v) => v != null)
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const cloud = vals('skyCover')
  if (!cloud.length) return null
  const [temps, rain] = [vals('tempF'), vals('precipProb')]
  const cloudCover = mean(cloud)
  const windMph = mean(vals('windMph'))
  const tempF = temps.length ? Math.min(...temps) : null
  const precipProb = rain.length ? Math.max(...rain) : null
  const score = mean(vals('score').map((v) => Math.max(v, 0))) // hour scores are unclamped; a night's isn't
  const { reasons } = rateConditions(cloudCover, windMph, tempF, precipProb)
  return { cloudCover, tempF, windMph, precipProb, score, rating: scoreToRating(score), reasons }
}

const HOUR = 3_600_000
export const floorHour = (d) => Math.floor(d / HOUR) * HOUR // NWS periods start on the hour

/** Sunset to the next sunrise; 19:00 to 07:00 local where the Sun doesn't set or rise that night. */
function forecastWindow(day, twilight, tz) {
  return {
    start: twilight.sunset ? new Date(twilight.sunset) : zonedTime(day, 19, 0, tz),
    end: twilight.sunrise ? new Date(twilight.sunrise) : zonedTime(addDays(day, 1), 7, 0, tz),
  }
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

/** Client-side take on astro-cli GET /forecast: hourly conditions from sunset to sunrise. */
export async function buildForecast(location, { date } = {}, now = new Date()) {
  const tz = location.timezone
  const day = forecastDay(location, now, date)
  const twilight = twilightEvents(location, day)
  const { start, end } = forecastWindow(day, twilight, tz)
  const errors = []
  let hours = []
  let elevationM = location.elevationM
  try {
    const props = await pointProps(location.latitude, location.longitude)
    // Gridpoint is optional: without it hours just lack sky cover.
    const [periods, grid] = await Promise.all([fetchHourly(props), fetchGridpoint(props).catch(() => null)])
    elevationM ??= grid?.elevationM == null ? null : Math.round(grid.elevationM)
    // Hours run from the one containing sunset to the one containing sunrise.
    hours = buildHours({ periods, start: floorHour(start), end: floorHour(end) + HOUR, sky: grid?.skyCover,
                         observer: observerFor(location),
                         moonIllum: moonIllumination(new Date((start.getTime() + end.getTime()) / 2)) })
  } catch (e) {
    errors.push(`forecast: ${e.message}`)
  }
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

/** The dark hour with the best score, or null when no hour is dark. */
export function bestDarkHour(hours) {
  return hours.filter((h) => h.isDark).reduce((a, b) => (b.score > (a?.score ?? -Infinity) ? b : a), null)
}
