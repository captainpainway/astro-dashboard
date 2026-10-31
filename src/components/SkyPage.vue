<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ZOOM_STEP } from '../composables/useSkyView'
import {
  allTargets, altAzOf, entryHorizon, filterTargets, playStep, searchIndex, stepTime, targetHorizon,
} from '../engine/sky'
import { reduceMotion } from '../motion'
import SkyLayersMenu, { loadLayers, saveLayers } from './SkyLayersMenu.vue'
import SkyScrubber from './SkyScrubber.vue'
import SkySearch from './SkySearch.vue'
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
const emit = defineEmits(['details']) // { id, instrument }: open that target's row in Tonight

const HOUR = 3_600_000
const failed = ref(false) // no WebGL: the list and search still work
const instrument = ref('all')
const upOnly = ref(false)
const selectedId = ref(null)
const hoverId = ref(null)
const panelOpen = ref(!window.matchMedia?.('(max-width: 700px)').matches) // phones open on the sky, not the list
const layers = ref(loadLayers())
watch(layers, saveLayers)

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

// Open a target's expanded row in Tonight, on the instrument tab the list is filtered to when it's one of the target's.
function openDetails(t) {
  if (!t) return
  pause()
  const prefer = t.instruments.includes(instrument.value) ? instrument.value : null
  emit('details', { id: t.id, instrument: prefer ?? t.instruments[0] })
}

function pick(row) {
  selectedId.value = row.id
  if (row.pos && !failed.value) props.sky.turnTo(row.pos)
}

// Search: turn to the pick and mark it; below the horizon, say so instead (the toast is also the live region).
const index = computed(() => searchIndex(props.tonight?.instruments))
const highlight = ref(null)
const notice = ref('')
let noticeTimer = 0
function say(text) {
  notice.value = text
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notice.value = '' }, 4000)
}
function onFind(entry) {
  highlight.value = entry
  if (entry.target) selectedId.value = entry.id
  const at = altAzOf(entryHorizon(entry, props.sky.frame))
  if (!failed.value) props.sky.turnTo(at)
  if (at.alt <= 0) say(`${entry.name} is below the horizon at ${props.sky.timeLabel}`)
}
function clearFind() {
  highlight.value = null
  notice.value = ''
}

// Play runs the night at an hour per second (with reduced motion, a jump of an hour each second) and stops at sunrise.
const playing = ref(false)
let raf = 0
let timer = 0
let last = 0
function advance(ms) {
  const next = playStep(props.sky.time, props.sky.range, ms)
  props.sky.time = next.time
  if (next.done) pause()
}
function tick(t) {
  advance((t - last) * HOUR / 1000)
  last = t
  if (playing.value) raf = requestAnimationFrame(tick)
}
function play() {
  props.sky.touch()
  if (props.sky.time >= props.sky.range.end.getTime()) props.sky.time = props.sky.range.start.getTime()
  playing.value = true
  if (reduceMotion()) timer = setInterval(() => advance(HOUR), 1000)
  else {
    last = performance.now()
    raf = requestAnimationFrame(tick)
  }
}
function pause() {
  playing.value = false
  cancelAnimationFrame(raf)
  clearInterval(timer)
}
const inNight = (t) => t >= props.sky.range.start.getTime() && t <= props.sky.range.end.getTime()
const nowInNight = computed(() => inNight(props.sky.now.getTime()))
const bestInNight = computed(() => props.bestHour != null && inNight(Date.parse(props.bestHour)))
function jump(t) {
  pause()
  props.sky.setTime(t)
}
const step = (dir) => jump(stepTime(props.sky.time, props.sky.range, dir * HOUR))
const jumpNow = () => jump(Math.min(props.sky.range.end.getTime(), Math.max(props.sky.range.start.getTime(), Date.now())))

watch(() => props.location, () => {
  pause()
  clearFind()
  selectedId.value = null
})
onBeforeUnmount(() => {
  pause()
  clearTimeout(noticeTimer)
})
</script>

<template>
  <section class="panel sky-page" :aria-label="`Sky over ${location.name}`">
    <div class="sky-toolbar">
      <SkySearch :index="index" :frame="sky.frame" @pick="onFind" @clear="clearFind" />
      <SkyLayersMenu v-model="layers" />
      <button class="show-more sky-targets-toggle" :aria-expanded="panelOpen" @click="panelOpen = !panelOpen">
        Targets ({{ rows.length }})
      </button>
    </div>
    <div class="sky-body">
      <div class="sky-main">
        <SkyStage v-if="!failed" v-model:selected-id="selectedId" :sky="sky" :location="location" :targets="shown"
                  :hover-id="hoverId" :emphasis="emphasis" :layers="layers" :highlight="highlight" immersive details
                  @details="openDetails(all.find((t) => t.id === $event))"
                  @failed="failed = true" />
        <p v-else class="sky-nogl muted">Your browser can't draw the sky (WebGL is unavailable).</p>
        <p class="sky-notice" role="status" aria-live="polite">{{ notice }}</p>
      </div>
      <Transition name="sky-slide">
        <SkyTargetPanel v-if="panelOpen" v-model:instrument="instrument" v-model:up-only="upOnly" :rows="rows"
                        :selected-id="selectedId" :loading="loading && !tonight" :error="error" @pick="pick"
                        @hover="hoverId = $event" @close="panelOpen = false" @details="openDetails" />
      </Transition>
    </div>
    <div class="sky-scrub sky-timebar">
      <button class="show-more sky-ctl" :aria-label="playing ? 'Pause' : 'Play the night'"
              @click="playing ? pause() : play()">{{ playing ? '⏸' : '▶' }}</button>
      <button class="show-more sky-ctl" aria-label="Back one hour" @click="step(-1)">−1h</button>
      <SkyScrubber :sky="sky" :best-hour="bestHour" @scrub="pause" />
      <button class="show-more sky-ctl" aria-label="Forward one hour" @click="step(1)">+1h</button>
      <button class="show-more sky-ctl" :disabled="!nowInNight" @click="jumpNow">Now</button>
      <button v-if="bestInNight" class="show-more sky-ctl" @click="jump(Date.parse(bestHour))">Best</button>
      <div class="btn-group zoom" role="group" aria-label="zoom">
        <button aria-label="zoom out" :disabled="sky.view.zoom <= 1" @click="sky.zoomBy(1 / ZOOM_STEP)">−</button>
        <button aria-label="zoom in" :disabled="sky.view.zoom >= sky.zoomMax" @click="sky.zoomBy(ZOOM_STEP)">+</button>
      </div>
      <span class="sky-time">{{ sky.timeLabel }}</span>
    </div>
  </section>
</template>
