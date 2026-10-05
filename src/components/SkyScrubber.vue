<script setup>
import { computed } from 'vue'

const props = defineProps({
  sky: { type: Object, required: true }, // useSkyView()
  bestHour: { type: String, default: null }, // ISO start of the best dark hour, for its tick
})
const emit = defineEmits(['scrub'])

const STEP = 5 * 60_000
// Ticks for now and the best hour, as % of the night.
const pct = (t) => {
  const { start, end } = props.sky.range
  return t >= start && t <= end ? ((t - start) / (end - start)) * 100 : null
}
const nowTick = computed(() => pct(props.sky.now.getTime()))
const bestTick = computed(() => (props.bestHour ? pct(Date.parse(props.bestHour)) : null))
function onInput(e) {
  props.sky.setTime(Number(e.target.value))
  emit('scrub')
}
</script>

<template>
  <div class="sky-track">
    <input type="range" class="sky-range" aria-label="time" :min="sky.range.start.getTime()"
           :max="sky.range.end.getTime()" :step="STEP" :value="sky.time" :aria-valuetext="sky.timeLabel" @input="onInput">
    <i v-if="nowTick != null" class="sky-tick" :style="{ left: `${nowTick}%` }" title="now" />
    <i v-if="bestTick != null" class="sky-tick sky-tick-best" :style="{ left: `${bestTick}%` }" title="best hour" />
  </div>
</template>
