<script setup>
import { computed } from 'vue'
import { fmtTime, weatherEmoji } from '../format'
import { ratingStyle } from '../ratings'

const props = defineProps({
  tonight: { type: Object, default: null },
  forecast: { type: Object, default: null },
  discover: { type: Object, default: null },
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
  <section class="overview">
    <!-- Conditions -->
    <article v-if="tonight" class="panel ov-card card-conditions">
      <h2>tonight's conditions</h2>
      <div v-if="conditions" class="ov-conditions">
        <span class="rating" :class="ratingStyle(conditions.rating).css">
          {{ ratingStyle(conditions.rating).label }} night
        </span>
        <dl>
          <div><dt>cloud avg</dt><dd>{{ Math.round(conditions.cloudCoverAvg ?? 0) }}%</dd></div>
          <div><dt>temp</dt><dd>{{ conditions.temperatureF ?? '—' }}°F</dd></div>
          <div><dt>wind avg</dt><dd>{{ Math.round(conditions.windMphAvg) ?? '—' }} mph</dd></div>
        </dl>
        <p v-if="current" class="muted small">
          now: {{ current.description ?? '—' }}, {{ current.cloudCover ?? '—' }}% cloud — {{ current.station }}
        </p>
      </div>
      <p v-else class="muted small">conditions unavailable</p>
    </article>

    <!-- Best observing window -->
    <article v-if="forecast" class="panel ov-card card-window">
      <h2>best window</h2>
      <div v-if="bestWindow">
        <span class="rating" :class="ratingStyle(bestWindow.rating).css">
          {{ ratingStyle(bestWindow.rating).label }}
        </span>
        <p class="ov-big">{{ fmtTime(bestWindow.time) }}</p>
        <p class="muted small">{{ bestWindow.shortForecast }} — {{ bestWindow.reasons[0] ?? '' }}</p>
      </div>
      <p v-else class="muted small">no dark hours in the forecast</p>
    </article>

    <!-- Hourly strip -->
    <article v-if="forecast?.hours?.length" class="panel ov-card card-hourly">
      <h2>hourly</h2>
      <div class="ov-hours">
        <div v-for="h in forecast.hours" :key="h.time"
             class="hour-chip" :class="{ best: bestWindow && h.time === bestWindow.time }">
          <span class="hour-chip-time">{{ fmtTime(h.time) }}</span>
          <span class="hour-chip-emoji">{{ weatherEmoji(h) }}</span>
          <span class="hour-chip-temp">{{ h.tempF != null ? h.tempF + '°' : '—' }}</span>
          <span class="hour-chip-cloud muted small">{{ h.skyCover != null ? h.skyCover + '%' : '—' }}</span>
        </div>
      </div>
    </article>

    <!-- Top picks per instrument -->
    <article v-if="tonight" class="panel ov-card card-picks">
      <h2>top targets</h2>
      <ul v-if="picks.length" class="ov-picks">
        <li v-for="p in picks" :key="p.target.id">
          <div class="ov-pick-main">
            <span class="ov-pick-name">{{ p.target.name }}</span>
            <span class="badge">{{ p.target.targetClass }}</span>
          </div>
          <div class="muted small">
            {{ p.instrument }} · best {{ fmtTime(p.target.bestTime) }} ·
            alt {{ p.target.altAtBest?.toFixed(0) ?? '—' }}° · score {{ p.target.score.toFixed(0) }}
          </div>
        </li>
      </ul>
      <p v-else class="muted small">no displayable targets tonight</p>
    </article>

    <!-- Fresh discoveries -->
    <article v-if="discover" class="panel ov-card card-discoveries">
      <h2>fresh discoveries</h2>
      <div v-if="topDiscovery">
        <div class="ov-pick-main">
          <span class="ov-pick-name">{{ topDiscovery.top.star.name }}</span>
          <span class="badge">{{ topDiscovery.top.star.varType }}</span>
        </div>
        <p class="muted small">
          {{ fmtMagRange(topDiscovery.top.star) }} ·
          best {{ fmtTime(topDiscovery.top.bestTime) }} ·
          score {{ topDiscovery.top.score.toFixed(0) }}
        </p>
        <p v-if="topDiscovery.more > 0" class="muted small">+{{ topDiscovery.more }} more</p>
      </div>
      <p v-else class="muted small">no under-observed stars found</p>
    </article>

    <!-- Loading placeholders -->
    <article v-if="tonightLoading" class="panel ov-card card-loading"><p class="muted">loading tonight…</p></article>
    <article v-if="forecastLoading" class="panel ov-card card-loading"><p class="muted">loading forecast…</p></article>
    <article v-if="discoverLoading" class="panel ov-card card-loading"><p class="muted">loading discover…</p></article>
  </section>
</template>