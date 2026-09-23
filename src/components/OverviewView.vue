<script setup>
import { computed } from 'vue'
import { fmtTime, weatherEmoji } from '../format'
import { ratingStyle, normalizeRating } from '../ratings'
import NightTimes from './NightTimes.vue'

const props = defineProps({
  tonight: { type: Object, default: null },
  forecast: { type: Object, default: null },
  discover: { type: Object, default: null },
  twilight: { type: Object, default: null },
  tonightLoading: { type: Boolean, default: false },
  forecastLoading: { type: Boolean, default: false },
  discoverLoading: { type: Boolean, default: false },
})

const INSTRUMENT_LABELS = { dob_8inch: '8" Dobsonian', dwarf_mini: 'Dwarf Mini' }

const conditions = computed(() => props.tonight?.weather?.summary ?? null)
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

const bestWindow = computed(() => {
  const dark = (props.forecast?.hours ?? []).filter((h) => h.isDark)
  return dark.reduce((a, b) => (b.score > (a?.score ?? -Infinity) ? b : a), null)
})

const topDiscovery = computed(() => {
  const scored = (props.discover?.targets ?? []).filter((t) => t.score != null && t.score > 0)
  return scored.length ? { top: scored[0], more: scored.length - 1 } : null
})

const fmtMagRange = (star) => {
  if (star.maxMag == null || star.minMag == null) return '—'
  return `${star.maxMag}–${star.minMag} ${star.magBand ?? ''}`.trim()
}
</script>

<template>
  <section class="overview bento">
    <!-- Conditions: the hero — "is tonight worth it?" -->
    <article v-if="tonight" class="panel ov-card tile-hero card-conditions">
      <h2>tonight's conditions</h2>
      <template v-if="conditions">
        <span class="rating ov-hero-rating" :class="ratingStyle(conditions.rating).css">
          {{ ratingStyle(conditions.rating).label }} night
        </span>
        <dl class="ov-stats">
          <div><dt>cloud avg</dt><dd class="ov-stat-value">{{ Math.round(conditions.cloudCoverAvg ?? 0) }}%</dd></div>
          <div><dt>temp</dt><dd class="ov-stat-value">{{ conditions.temperatureF ?? '—' }}°F</dd></div>
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

    <!-- Fresh discoveries -->
    <article v-if="discover" class="panel ov-card tile-sm card-discoveries">
      <h2>fresh discoveries</h2>
      <template v-if="topDiscovery">
        <div class="ov-pick-main">
          <span class="ov-pick-name">{{ topDiscovery.top.star.name }}</span>
          <span class="badge">{{ topDiscovery.top.star.varType }}</span>
        </div>
        <p class="muted small">
          {{ fmtMagRange(topDiscovery.top.star) }} ·
          best {{ fmtTime(topDiscovery.top.bestTime) }} ·
          score {{ topDiscovery.top.score.toFixed(0) }}
        </p>
        <p v-if="topDiscovery.more > 0" class="muted small ov-foot">+{{ topDiscovery.more }} more</p>
      </template>
      <p v-else class="muted small">no under-observed stars found</p>
    </article>
    <article v-else-if="discoverLoading" class="panel ov-card tile-sm card-loading">
      <p class="muted">loading discover…</p>
    </article>

    <!-- Night times: tall column, times listed vertically -->
    <NightTimes v-if="twilight" :twilight="twilight" class="ov-card tile-tall card-night" />

    <!-- Hourly strip: one scrolling row -->
    <article v-if="forecast?.hours?.length" class="panel ov-card tile-strip card-hourly">
      <h2>hourly</h2>
      <div class="ov-hours">
        <div v-for="h in forecast.hours" :key="h.time"
             class="hour-chip"
             :class="[`rc-${normalizeRating(h.rating)}`, { best: bestWindow && h.time === bestWindow.time }]">
          <span class="hour-chip-time">{{ fmtTime(h.time) }}</span>
          <span class="hour-chip-emoji">{{ weatherEmoji(h) }}</span>
          <span class="hour-chip-temp">{{ h.tempF != null ? h.tempF + '°' : '—' }}</span>
          <span class="hour-chip-cloud muted small">{{ h.skyCover != null ? h.skyCover + '%' : '—' }}</span>
        </div>
      </div>
    </article>
    <article v-else-if="forecastLoading" class="panel ov-card tile-strip card-loading">
      <p class="muted">loading forecast…</p>
    </article>
  </section>
</template>
