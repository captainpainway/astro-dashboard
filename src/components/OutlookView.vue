<script setup>
import { computed } from 'vue'
import { fmtTime, fmtDate, weatherEmoji } from '../format'
import { ratingStyle, normalizeRating } from '../ratings'
import NightTimes from './NightTimes.vue'

const props = defineProps({
  nights: { type: Array, required: true },
  loading: { type: Boolean, default: false },
})

const bestHourOf = (night) =>
  (night.hours ?? [])
    .filter((h) => h.isDark)
    .reduce((a, b) => (b.score > (a?.score ?? -Infinity) ? b : a), null)

const rows = computed(() =>
  props.nights.map((night) => ({ night, bestHour: bestHourOf(night) })))
</script>

<template>
  <section class="outlook">
    <div v-if="loading && !nights.length" class="muted">loading outlook…</div>
    <div v-else-if="!nights.length" class="muted">no nightly outlook available</div>

    <article v-for="{ night, bestHour } in rows" :key="night.date" class="panel outlook-night">
      <div class="outlook-night-head">
        <div class="outlook-night-title">
          <h2>{{ night.label }}</h2>
          <span class="muted small">{{ fmtDate(night.date) }} · {{ fmtTime(night.start) }} – {{ fmtTime(night.end) }}</span>
        </div>
        <span class="rating" :class="ratingStyle(night.rating).css">
          {{ ratingStyle(night.rating).label }} · {{ Math.round(night.score ?? 0) }}
        </span>
      </div>

      <dl class="outlook-stats">
        <div><dt>cloud</dt><dd>{{ night.cloudCover != null ? Math.round(night.cloudCover) + '%' : '—' }}{{ night.cloudSource === 'text' ? ' ~' : '' }}</dd></div>
        <div><dt>temp</dt><dd>{{ night.tempF != null ? Math.round(night.tempF) + '°F' : '—' }}</dd></div>
        <div><dt>wind</dt><dd>{{ night.windMph != null ? `${Math.round(night.windMph)} mph ${night.windDir ?? ''}`.trim() : '—' }}</dd></div>
        <div><dt>rain</dt><dd>{{ night.precipProb != null ? night.precipProb + '%' : '—' }}</dd></div>
        <div><dt>moon</dt><dd>{{ Math.round((night.moonIllum ?? 0) * 100) }}% · up {{ Math.round((night.moonUpFraction ?? 0) * 100) }}%</dd></div>
        <div><dt>dark hrs</dt><dd>{{ night.darkHours != null ? night.darkHours + 'h' : '—' }}</dd></div>
      </dl>

      <p v-if="night.shortForecast" class="muted small outlook-forecast">{{ night.shortForecast }}</p>

      <NightTimes v-if="night.twilight" :twilight="night.twilight" compact />

      <ul class="outlook-reasons">
        <li v-for="r in night.reasons" :key="r">{{ r }}</li>
      </ul>

      <div v-if="night.hours?.length" class="ov-hours">
        <div v-for="h in night.hours" :key="h.time"
             class="hour-chip"
             :class="[
               `rc-${normalizeRating(h.rating)}`,
               { best: bestHour && h.time === bestHour.time, 'not-dark': !h.isDark },
             ]">
          <span class="hour-chip-time">{{ fmtTime(h.time) }}</span>
          <span class="hour-chip-emoji">{{ weatherEmoji(h) }}</span>
          <span class="hour-chip-temp">{{ h.tempF != null ? h.tempF + '°' : '—' }}</span>
          <span class="hour-chip-cloud muted small">{{ h.skyCover != null ? h.skyCover + '%' : '—' }}</span>
        </div>
      </div>
      <p v-else class="muted small">no hourly detail for this night</p>
    </article>
  </section>
</template>