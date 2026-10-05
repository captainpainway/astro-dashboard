<script setup>
import { computed, ref } from 'vue'
import { ZOOM_STEP } from '../composables/useSkyView'
import { topTargets } from '../engine/sky'
import SkyScrubber from './SkyScrubber.vue'
import SkyStage from './SkyStage.vue'

const props = defineProps({
  sky: { type: Object, required: true }, // useSkyView(), shared with the home tile
  location: { type: Object, required: true },
  tonight: { type: Object, default: null },
  bestHour: { type: String, default: null }, // ISO start of the best dark hour, once the forecast is in
})

const failed = ref(false) // no WebGL: the page explains instead of drawing
const targets = computed(() => topTargets(props.tonight?.instruments))
props.sky.follow(() => props.location, { targets: () => targets.value, bestHour: () => props.bestHour })
</script>

<template>
  <section class="panel sky-page" :aria-label="`Sky over ${location.name}`">
    <div class="sky-body">
      <div class="sky-main">
        <SkyStage v-if="!failed" :sky="sky" :location="location" :targets="targets" immersive @failed="failed = true" />
        <p v-else class="sky-nogl muted">Your browser can't draw the sky (WebGL is unavailable).</p>
      </div>
    </div>
    <div class="sky-scrub sky-timebar">
      <SkyScrubber :sky="sky" :best-hour="bestHour" />
      <div class="btn-group zoom" role="group" aria-label="zoom">
        <button aria-label="zoom out" :disabled="sky.view.zoom <= 1" @click="sky.zoomBy(1 / ZOOM_STEP)">−</button>
        <button aria-label="zoom in" :disabled="sky.view.zoom >= sky.zoomMax" @click="sky.zoomBy(ZOOM_STEP)">+</button>
      </div>
      <span class="sky-time">{{ sky.timeLabel }}</span>
    </div>
  </section>
</template>
