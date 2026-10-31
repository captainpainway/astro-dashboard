<script setup>
import { computed, ref } from 'vue'
import { bestDarkHour, summarizeHours } from '../engine/forecast'
import { fmtTime, lunarEmpty, weatherEmoji } from '../format'
import { ratingStyle, normalizeRating } from '../ratings'
import NightTimes from './NightTimes.vue'
import SkyPanorama from './SkyPanorama.vue'

const props = defineProps({
  location: { type: Object, default: null },
  sky: { type: Object, default: null }, // useSkyView()
  tonight: { type: Object, default: null },
  forecast: { type: Object, default: null },
  lunar: { type: Object, default: null },
  twilight: { type: Object, default: null },
  tonightLoading: { type: Boolean, default: false },
  forecastLoading: { type: Boolean, default: false },
  lunarLoading: { type: Boolean, default: false },
})
const emit = defineEmits(['expand', 'details']) // details: a sky tile target to open in Tonight
const skyFailed = ref(false)

const INSTRUMENT_LABELS = { dob_8inch: '8" Dobsonian', dwarf_mini: 'Dwarf Mini' }

// Tonight's conditions come from the hourly rows, the same summary the forecast tab shows for tonight; the
// tonight page's weather averages stand in until the hourly forecast arrives.
const conditions = computed(() => {
  const n = summarizeHours(props.forecast?.hours ?? [])
  return n ? { rating: n.rating, cloudCoverAvg: n.cloudCover, temperatureF: n.tempF, windMphAvg: n.windMph }
    : props.tonight?.weather?.summary ?? null
})
const current = computed(() => props.tonight?.weather?.current ?? null)

const picks = computed(() => {
  const out = []
  for (const [ins, targets] of Object.entries(props.tonight?.instruments ?? {})) {
    const best = targets
      .filter((t) => t.score != null && t.score > 0)
      .reduce((a, b) => (b.score > (a?.score ?? -Infinity) ? b : a), null)
    if (best) out.push({ instrument: INSTRUMENT_LABELS[ins] ?? ins, target: best })
  }
  return out
})

const bestWindow = computed(() => bestDarkHour(props.forecast?.hours ?? []))

// The hourly chip whose hour contains the sky tile's time.
const scrubTime = ref(null)
const scrubHour = computed(() => (props.forecast?.hours ?? []).find((h) => {
  const t = Date.parse(h.time)
  return scrubTime.value >= t && scrubTime.value < t + 3_600_000
})?.time ?? null)

const topLunar = computed(() => {
  const f = props.lunar?.features ?? []
  return f.length ? { top: f[0], more: f.length - 1 } : null
})
</script>

<template>
  <div class="overview">
  <SkyPanorama v-if="location && sky && !skyFailed" :sky="sky" :location="location" :tonight="tonight"
               :best-hour="bestWindow?.time ?? null" @time="scrubTime = $event" @failed="skyFailed = true"
               @expand="emit('expand')" @details="emit('details', $event)" />
  <section class="bento">
    <!-- Conditions: the hero — "is tonight worth it?" -->
    <article v-if="tonight" class="panel ov-card tile-hero card-conditions">
      <h2>tonight's conditions</h2>
      <template v-if="conditions">
        <span class="rating ov-hero-rating" :class="ratingStyle(conditions.rating).css">
          {{ ratingStyle(conditions.rating).label }} night
        </span>
        <dl class="ov-stats">
          <div><dt>cloud avg</dt><dd class="ov-stat-value">{{ Math.round(conditions.cloudCoverAvg ?? 0) }}%</dd></div>
          <div><dt>temp</dt><dd class="ov-stat-value">{{ conditions.temperatureF != null ? Math.round(conditions.temperatureF) : '—' }}°F</dd></div>
          <div>
            <dt>wind avg</dt>
            <dd class="ov-stat-value">{{ conditions.windMphAvg != null ? Math.round(conditions.windMphAvg) : '—' }} mph</dd>
          </div>
        </dl>
        <p v-if="current" class="ov-now muted small">
          <span class="ov-now-label">now</span>
          {{ current.description ?? '—' }}, {{ current.cloudCover ?? '—' }}% cloud — {{ current.station }}
        </p>
      </template>
      <p v-else class="muted small">conditions unavailable</p>
    </article>
    <article v-else-if="tonightLoading" class="panel ov-card tile-hero card-loading">
      <p class="muted">loading tonight…</p>
    </article>

    <!-- Top picks per instrument -->
    <article v-if="tonight" class="panel ov-card tile-wide card-picks">
      <h2>top targets</h2>
      <ul v-if="picks.length" class="ov-picks">
        <li v-for="p in picks" :key="p.target.id">
          <span class="ov-pick-instrument">{{ p.instrument }}</span>
          <div class="ov-pick-main">
            <span class="ov-pick-name">{{ p.target.name }}</span>
            <span class="badge">{{ p.target.targetClass }}</span>
          </div>
          <div class="muted small">
            best {{ fmtTime(p.target.bestTime) }} ·
            alt {{ p.target.altAtBest?.toFixed(0) ?? '—' }}° · score {{ p.target.score.toFixed(0) }}
          </div>
        </li>
      </ul>
      <p v-else class="muted small">no displayable targets tonight</p>
    </article>

    <!-- Best dark hour -->
    <article v-if="bestWindow" class="panel ov-card tile-sm card-best">
      <h2>best hour</h2>
      <div class="ov-best-main">
        <span class="ov-best-emoji">{{ weatherEmoji(bestWindow) }}</span>
        <span class="ov-best-time">{{ fmtTime(bestWindow.time) }}</span>
      </div>
      <p class="muted small ov-foot">
        <span class="rating" :class="ratingStyle(bestWindow.rating).css">{{ ratingStyle(bestWindow.rating).label }}</span>
        score {{ bestWindow.score?.toFixed(0) ?? '—' }}
        <template v-if="bestWindow.skyCover != null"> · {{ bestWindow.skyCover }}% cloud</template>
      </p>
    </article>

    <!-- Lunar highlight -->
    <article v-if="lunar" class="panel ov-card tile-sm card-lunar">
      <h2>lunar highlight</h2>
      <template v-if="topLunar">
        <div class="ov-pick-main">
          <span class="ov-pick-name">{{ topLunar.top.name }}</span>
          <span class="badge">{{ topLunar.top.tier }}</span>
        </div>
        <p class="muted small">{{ topLunar.top.reason }} · best {{ fmtTime(topLunar.top.bestTime) }}</p>
        <p v-if="topLunar.more > 0" class="muted small ov-foot">+{{ topLunar.more }} more</p>
      </template>
      <p v-else class="muted small">{{ lunarEmpty(lunar.moon) }}</p>
    </article>
    <article v-else-if="lunarLoading" class="panel ov-card tile-sm card-loading">
      <p class="muted">loading lunar…</p>
    </article>

    <!-- Night times: tall column, times listed vertically -->
    <NightTimes v-if="twilight" :twilight="twilight" class="ov-card tile-tall card-night" />

    <!-- Hourly strip: one scrolling row -->
    <article v-if="forecast?.hours?.length" class="panel ov-card tile-strip card-hourly">
      <h2>hourly</h2>
      <div class="ov-hours">
        <div v-for="h in forecast.hours" :key="h.time"
             class="hour-chip"
             :class="[`rc-${normalizeRating(h.rating)}`, { best: bestWindow && h.time === bestWindow.time, at: h.time === scrubHour }]">
          <span class="hour-chip-time">{{ fmtTime(h.time) }}</span>
          <span class="hour-chip-emoji">{{ weatherEmoji(h) }}</span>
          <span class="hour-chip-temp">{{ h.tempF != null ? h.tempF + '°' : '—' }}</span>
          <span class="hour-chip-cloud muted small">{{ h.skyCover != null ? h.skyCover + '%' : '—' }}</span>
        </div>
      </div>
    </article>
    <article v-else-if="forecastLoading" class="panel ov-card tile-strip card-loading">
      <p class="muted">loading hourly…</p>
    </article>
  </section>
  </div>
</template>
