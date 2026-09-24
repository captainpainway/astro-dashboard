<script setup>
import { computed } from 'vue'
import { fmtTime, weatherEmoji } from '../format'
import { ratingStyle, normalizeRating } from '../ratings'
import NightTimes from './NightTimes.vue'

const props = defineProps({
  hours: { type: Array, required: true },
  night: { type: Object, default: null },
  twilight: { type: Object, default: null },
  loading: { type: Boolean, default: false },
})

const darkHours = computed(() => props.hours.filter((h) => h.isDark))
const best = computed(() =>
  darkHours.value.reduce((a, b) => (b.score > (a?.score ?? -Infinity) ? b : a), null))
</script>

<template>
  <section class="forecast">
    <NightTimes v-if="twilight" :twilight="twilight" />

    <div v-if="best" class="best-window panel">
      <span class="rating" :class="ratingStyle(best.rating).css">
        {{ ratingStyle(best.rating).label }}
      </span>
      best window around <strong>{{ fmtTime(best.time) }}</strong>
      <span class="muted small">— {{ best.shortForecast }}, {{ best.reasons[0] ?? '' }}</span>
    </div>

    <div v-if="loading && !hours.length" class="muted">loading forecast…</div>
    <div v-else-if="!hours.length" class="muted">no hourly forecast available</div>

    <div v-else class="hours">
      <article v-for="h in hours" :key="h.time"
               class="hour-card panel"
               :class="[`rc-${normalizeRating(h.rating)}`, { 'not-dark': !h.isDark, daylight: h.daylight }]">
        <header class="hour-head">
          <strong class="hour-time">{{ fmtTime(h.time) }}</strong>
          <span class="rating" :class="ratingStyle(h.rating).css">
            {{ ratingStyle(h.rating).label }}
          </span>
        </header>
        <div class="hour-forecast" :title="h.shortForecast">
          <span class="hour-emoji" aria-hidden="true">{{ weatherEmoji(h) }}</span>
          <span class="hour-forecast-text">{{ h.shortForecast }}</span>
        </div>
        <p v-if="h.daylight" class="hour-daylight">☀️ sun up — not observing time</p>

        <div class="hour-cloud">
          <span class="hour-cloud-value">{{ h.skyCover ?? '—' }}<small v-if="h.skyCover != null">%</small></span>
          <span class="hour-cloud-label">cloud cover</span>
        </div>
        <div v-if="h.skyCover != null" class="hour-cloud-bar">
          <span :style="{ width: `${h.skyCover}%` }" />
        </div>

        <dl class="hour-stats">
          <div><dt>temp</dt><dd>{{ h.tempF ?? '—' }}°F</dd></div>
          <div><dt>wind</dt><dd>{{ h.windMph ?? '—' }} mph</dd></div>
          <div><dt>humidity</dt><dd>{{ h.humidity ?? '—' }}%</dd></div>
          <div><dt>moon</dt><dd>{{ h.moonUp ? `${Math.round(h.moonIllum * 100)}% up` : 'down' }}</dd></div>
        </dl>

        <ul v-if="h.reasons?.length" class="hour-reasons">
          <li v-for="r in h.reasons" :key="r">{{ r }}</li>
        </ul>
      </article>
    </div>
  </section>
</template>