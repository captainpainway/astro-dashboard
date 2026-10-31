<script setup>
import { computed, ref, watch } from 'vue'
import { ZOOM_STEP } from '../composables/useSkyView'
import { topTargets } from '../engine/sky'
import SkyStage from './SkyStage.vue'
import SkyScrubber from './SkyScrubber.vue'

const props = defineProps({
  sky: { type: Object, required: true }, // useSkyView(), shared with the sky page
  location: { type: Object, required: true },
  tonight: { type: Object, default: null },
  bestHour: { type: String, default: null }, // ISO start of the best dark hour, once the forecast is in
})
// details → { id, instrument }: open that target's row in Tonight
const emit = defineEmits(['time', 'failed', 'expand', 'details'])

const targets = computed(() => topTargets(props.tonight?.instruments))
props.sky.follow(() => props.location, { targets: () => targets.value, bestHour: () => props.bestHour })
watch(() => props.sky.time, (t) => emit('time', t), { immediate: true })

// Clicking a ring picks it, as on the sky page: its tooltip stays up with a link to the target in Tonight.
const selectedId = ref(null)
watch(targets, (list) => { if (!list.some((t) => t.id === selectedId.value)) selectedId.value = null })
function openDetails(id) {
  const t = targets.value.find((x) => x.id === id)
  if (t) emit('details', { id, instrument: t.instruments[0] })
}

</script>

<template>
  <section class="panel sky-tile" :aria-label="`Sky over ${location.name} tonight`">
    <SkyStage v-model:selected-id="selectedId" :sky="sky" :location="location" :targets="targets" details
              @details="openDetails" @failed="emit('failed')" />
    <div class="sky-scrub">
      <SkyScrubber :sky="sky" :best-hour="bestHour" />
      <div class="btn-group zoom" role="group" aria-label="zoom">
        <button aria-label="zoom out" :disabled="sky.view.zoom <= 1" @click="sky.zoomBy(1 / ZOOM_STEP)">−</button>
        <button aria-label="zoom in" :disabled="sky.view.zoom >= sky.zoomMax" @click="sky.zoomBy(ZOOM_STEP)">+</button>
      </div>
      <span class="sky-time">{{ sky.timeLabel }}</span>
      <button class="sky-expand" aria-label="Open the full sky" title="Open the full sky" @click="emit('expand')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>
      </button>
    </div>
  </section>
</template>
