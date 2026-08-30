<script setup>
import { ratingStyle } from '../ratings'

defineProps({
  weather: { type: Object, default: null },
  mode: { type: String, required: true }, // 'window' | 'instant'
})
</script>

<template>
  <section v-if="weather" class="weather panel">
    <template v-if="mode === 'window' && weather.summary">
      <span class="rating" :class="ratingStyle(weather.summary.rating).css">
        {{ ratingStyle(weather.summary.rating).label }} night
      </span>
      <dl>
        <div><dt>cloud avg</dt><dd>{{ weather.summary.cloudCoverAvg != null ? Math.round(weather.summary.cloudCoverAvg) : '—' }}%</dd></div>
        <div><dt>temp</dt><dd>{{ weather.summary.temperatureF ?? '—' }}°F</dd></div>
        <div><dt>wind avg</dt><dd>{{ Math.round(weather.summary.windMphAvg) ?? '—' }} mph</dd></div>
      </dl>
    </template>
    <template v-else-if="mode === 'instant' && weather.atTime">
      <span class="rating" :class="ratingStyle(weather.atTime.rating).css">
        {{ ratingStyle(weather.atTime.rating).label }} at that time
      </span>
      <dl>
        <div><dt>cloud</dt><dd>{{ weather.atTime.cloudCover ?? '—' }}%</dd></div>
        <div><dt>temp</dt><dd>{{ weather.atTime.temperatureF ?? '—' }}°F</dd></div>
        <div><dt>wind</dt><dd>{{ weather.atTime.windMph ?? '—' }} mph</dd></div>
        <div><dt>forecast</dt><dd>{{ weather.atTime.forecast ?? '—' }}</dd></div>
      </dl>
    </template>
    <p v-if="weather.current" class="current muted">
      now: {{ weather.current.description ?? '—' }}, {{ weather.current.cloudCover ?? '—' }}% cloud,
      {{ weather.current.temperatureF ?? '—' }}°F — {{ weather.current.station }}
    </p>
  </section>
</template>