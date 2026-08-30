<script setup>
import { computed } from 'vue'
import { fmtTime } from '../format'
import { ratingStyle } from '../ratings'

const props = defineProps({
  hours: { type: Array, required: true },
  night: { type: Object, default: null },
  loading: { type: Boolean, default: false },
})

const darkHours = computed(() => props.hours.filter((h) => h.isDark))
const best = computed(() =>
  darkHours.value.reduce((a, b) => (b.score > (a?.score ?? -Infinity) ? b : a), null))
</script>

<template>
  <section class="forecast">
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
      <div v-for="h in hours" :key="h.time"
           class="hour-card panel" :class="{ 'not-dark': !h.isDark }">
        <div class="hour-head">
          <strong>{{ fmtTime(h.time) }}</strong>
          <span class="rating" :class="ratingStyle(h.rating).css">
            {{ ratingStyle(h.rating).label }}
          </span>
        </div>
        <div class="hour-forecast">{{ h.shortForecast }}</div>
        <dl class="hour-stats">
          <div><dt>cloud</dt><dd>{{ h.skyCover ?? '—' }}%</dd></div>
          <div><dt>temp</dt><dd>{{ h.tempF ?? '—' }}°F</dd></div>
          <div><dt>wind</dt><dd>{{ h.windMph ?? '—' }} mph</dd></div>
          <div><dt>humidity</dt><dd>{{ h.humidity ?? '—' }}%</dd></div>
          <div><dt>moon</dt><dd>{{ h.moonUp ? `${Math.round(h.moonIllum * 100)}% up` : 'down' }}</dd></div>
        </dl>
        <ul class="hour-reasons">
          <li v-for="r in h.reasons" :key="r">{{ r }}</li>
        </ul>
      </div>
    </div>
  </section>
</template>