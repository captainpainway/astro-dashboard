<script setup>
import { computed, watch } from 'vue'
import { ZOOM_STEP } from '../composables/useSkyView'
import { topTargets } from '../engine/sky'
import SkyStage from './SkyStage.vue'

const props = defineProps({
  sky: { type: Object, required: true }, // useSkyView(), shared with the sky page
  location: { type: Object, required: true },
  tonight: { type: Object, default: null },
  bestHour: { type: String, default: null }, // ISO start of the best dark hour, once the forecast is in
})
const emit = defineEmits(['time', 'failed'])

const STEP = 5 * 60_000
const targets = computed(() => topTargets(props.tonight?.instruments))
props.sky.follow(() => props.location, { targets: () => targets.value, bestHour: () => props.bestHour })
watch(() => props.sky.time, (t) => emit('time', t), { immediate: true })

// Scrubber ticks, as % of the night.
const pct = (t) => {
  const { start, end } = props.sky.range
  return t >= start && t <= end ? ((t - start) / (end - start)) * 100 : null
}
const nowTick = computed(() => pct(props.sky.now.getTime()))
const bestTick = computed(() => (props.bestHour ? pct(Date.parse(props.bestHour)) : null))
</script>

<template>
  <section class="panel sky-tile" :aria-label="`Sky over ${location.name} tonight`">
    <SkyStage :sky="sky" :location="location" :targets="targets" @failed="emit('failed')" />
    <div class="sky-scrub">
      <div class="sky-track">
        <input type="range" class="sky-range" aria-label="time" :min="sky.range.start.getTime()"
               :max="sky.range.end.getTime()" :step="STEP" :value="sky.time" :aria-valuetext="sky.timeLabel"
               @input="sky.setTime(Number($event.target.value))">
        <i v-if="nowTick != null" class="sky-tick" :style="{ left: `${nowTick}%` }" title="now" />
        <i v-if="bestTick != null" class="sky-tick sky-tick-best" :style="{ left: `${bestTick}%` }" title="best hour" />
      </div>
      <div class="btn-group zoom" role="group" aria-label="zoom">
        <button aria-label="zoom out" :disabled="sky.view.zoom <= 1" @click="sky.zoomBy(1 / ZOOM_STEP)">−</button>
        <button aria-label="zoom in" :disabled="sky.view.zoom >= sky.zoomMax" @click="sky.zoomBy(ZOOM_STEP)">+</button>
      </div>
      <span class="sky-time">{{ sky.timeLabel }}</span>
    </div>
  </section>
</template>
