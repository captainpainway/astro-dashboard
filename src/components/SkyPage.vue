<script setup>
import { computed, ref } from 'vue'
import { ZOOM_STEP } from '../composables/useSkyView'
import { allTargets, altAzOf, filterTargets, targetHorizon } from '../engine/sky'
import SkyScrubber from './SkyScrubber.vue'
import SkyStage from './SkyStage.vue'
import SkyTargetPanel from './SkyTargetPanel.vue'

const props = defineProps({
  sky: { type: Object, required: true }, // useSkyView(), shared with the home tile
  location: { type: Object, required: true },
  tonight: { type: Object, default: null },
  bestHour: { type: String, default: null }, // ISO start of the best dark hour, once the forecast is in
  loading: { type: Boolean, default: false }, // tonight's plan is loading
  error: { type: String, default: null }, // tonight's plan failed
})

const failed = ref(false) // no WebGL: the list still works
const instrument = ref('all')
const upOnly = ref(false)
const selectedId = ref(null)
const hoverId = ref(null)
const panelOpen = ref(!window.matchMedia?.('(max-width: 700px)').matches) // phones open on the sky, not the list

const all = computed(() => allTargets(props.tonight?.instruments))
const shown = computed(() =>
  filterTargets(all.value, { instrument: instrument.value, upOnly: upOnly.value }, props.sky.frame))
const rows = computed(() => shown.value.map((t) => {
  const v = targetHorizon(t, props.sky.frame)
  return { ...t, pos: v && altAzOf(v) }
}))
// The ten best of what the list shows ring at full strength; the rest are dimmed until hovered or picked.
const emphasis = computed(() => new Set(shown.value.slice(0, 10).map((t) => t.id)))
props.sky.follow(() => props.location, { targets: () => shown.value, bestHour: () => props.bestHour })

function pick(row) {
  selectedId.value = row.id
  if (row.pos && !failed.value) props.sky.turnTo(row.pos)
}
</script>

<template>
  <section class="panel sky-page" :aria-label="`Sky over ${location.name}`">
    <div class="sky-toolbar">
      <button class="show-more sky-targets-toggle" :aria-expanded="panelOpen" @click="panelOpen = !panelOpen">
        Targets ({{ rows.length }})
      </button>
    </div>
    <div class="sky-body" :class="{ 'panel-open': panelOpen }">
      <div class="sky-main">
        <SkyStage v-if="!failed" v-model:selected-id="selectedId" :sky="sky" :location="location" :targets="shown"
                  :hover-id="hoverId" :emphasis="emphasis" immersive @failed="failed = true" />
        <p v-else class="sky-nogl muted">Your browser can't draw the sky (WebGL is unavailable).</p>
      </div>
      <SkyTargetPanel v-if="panelOpen" v-model:instrument="instrument" v-model:up-only="upOnly" :rows="rows"
                      :selected-id="selectedId" :loading="loading && !tonight" :error="error" @pick="pick"
                      @hover="hoverId = $event" @close="panelOpen = false" />
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
