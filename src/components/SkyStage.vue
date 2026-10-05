<script>
// Ring colours and labels per instrument; the sky page's target list uses them too.
export const INSTRUMENTS = {
  dob_8inch: { label: '8" Dobsonian', color: '#7aa2ff' },
  dwarf_mini: { label: 'Dwarf Mini', color: '#f0abfc' },
}
</script>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, watchEffect } from 'vue'
import { gsap } from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import skyData from '../engine/sky.json'
import {
  DEEP_SKY, altAzOf, camera, entryHorizon, darkness, edgeMarker, fieldOfView, horizonVector, moonPath, rotate, targetHorizon, terrainSeed,
  unitVector,
} from '../engine/sky'
import { ZOOM_STEP } from '../composables/useSkyView'
import { compass, fmtTime } from '../format'
import { reduceMotion, tipIn, tipOut } from '../motion'
import SkyCanvas from './SkyCanvas.vue'
import { DEFAULT_LAYERS } from './SkyLayersMenu.vue'

gsap.registerPlugin(Draggable, InertiaPlugin)

const props = defineProps({
  sky: { type: Object, required: true }, // useSkyView(): time, view and zoom, shared by the tile and the sky page
  location: { type: Object, required: true },
  targets: { type: Array, required: true }, // tonight-plan targets to ring, each with `instruments` (see topTargets)
  selectedId: { type: String, default: null }, // the target picked on the sky page; its tooltip stays up
  hoverId: { type: String, default: null }, // a target hovered in the sky page's list
  emphasis: { type: Object, default: null }, // Set of ids ringed at full strength; the other rings are dimmed
  layers: { type: Object, default: () => DEFAULT_LAYERS }, // see SkyLayersMenu
  highlight: { type: Object, default: null }, // a search entry to mark with a dashed ring
  immersive: { type: Boolean, default: false }, // sky page: plain wheel zooms, one finger drags both ways
})
const emit = defineEmits(['failed', 'update:selectedId'])

const DEG = 180 / Math.PI
const NAMES = skyData.names.map(([abbr, name, ra, dec]) => ({ abbr, name, v: unitVector(ra, dec) }))
const STARS = skyData.starNames.map(([name, ra, dec, mag]) => ({ name, mag, v: unitVector(ra, dec) }))

const sky = props.sky // App.vue owns one for the whole visit, so this prop never changes
const view = sky.view
const stage = ref(null)
const size = reactive({ width: 1000, height: 385 }) // jsdom has no layout; the ResizeObserver takes over in browsers
// Zoom narrows the field down to 4× or 30°, whichever is wider: sky.json has no stars fainter than magnitude 5.
watchEffect(() => { sky.zoomMax = Math.min(4, fieldOfView(size.width) / 30) })
const frame = computed(() => sky.frame)
const cam = computed(() => camera({
  yaw: view.yaw, pitch: view.pitch, hfov: fieldOfView(size.width) / Math.min(view.zoom, sky.zoomMax),
  width: size.width, height: size.height,
}))
const seed = computed(() => terrainSeed(props.location))
const dark = computed(() => darkness(frame.value))

// Overlay: everything is placed in stage px by the same camera the shaders use.
const pos = (p) => ({ left: `${p.x}px`, top: `${p.y}px` })
const positioned = computed(() => props.targets.flatMap((t) => {
  const v = targetHorizon(t, frame.value)
  return v ? [{ ...t, ...altAzOf(v), v }] : []
}))
const placed = computed(() => positioned.value.filter((r) => r.alt > 0).map((r) => ({ ...r, p: cam.value.project(r.v) })))
// A ring needs its whole 24px inside the stage; nearer the edge than that, the target gets an edge marker instead.
const inside = ({ p }) => p.onScreen && p.x >= 12 && p.x <= size.width - 12 && p.y >= 12 && p.y <= size.height - 12
const rings = computed(() => placed.value.filter(inside))
// Best-scoring first; a marker that would overlap one already placed is skipped until the view turns.
// Chip width is estimated from the label (~7px a character plus padding) since layout isn't measured.
const edges = computed(() => placed.value.filter((r) => !inside(r)).sort((a, b) => b.score - a.score)
  .reduce((kept, r) => {
    const edge = edgeMarker(r.v, cam.value)
    const w = 7 * (r.name.length + 2) + 20
    const clear = kept.every((k) => Math.abs(k.edge.x - edge.x) >= (k.w + w) / 2 || Math.abs(k.edge.y - edge.y) >= 24)
    return clear ? [...kept, { ...r, edge, w }] : kept
  }, []))
const planets = computed(() => frame.value.planets.filter((pl) => pl.alt > 0)
  .map((pl) => ({ ...pl, p: cam.value.project(horizonVector(pl)) })).filter((pl) => pl.p.onScreen))
const labels = computed(() => NAMES.flatMap((n) => {
  const h = rotate(frame.value.rot, n.v)
  const p = cam.value.project(h)
  return h[2] > 0.05 && p.onScreen ? [{ ...n, p }] : []
}))
const compassMarks = computed(() => [0, 45, 90, 135, 180, 225, 270, 315].flatMap((az) => {
  const p = cam.value.project(horizonVector({ alt: 0, az }))
  return p.onScreen ? [{ az, label: compass(az), p }] : []
}))
// Star names: the brightest always, every named star from 2× zoom. Deep-sky markers carry names from 2× zoom too.
const visible = (list) => list.flatMap((o) => {
  const h = rotate(frame.value.rot, o.v)
  const p = cam.value.project(h)
  return h[2] > 0 && p.onScreen ? [{ ...o, p }] : []
})
const starLabels = computed(() =>
  (props.layers.stars ? visible(STARS.filter((s) => s.mag <= 2 || view.zoom >= 2)) : []))
const dsos = computed(() => (props.layers.deepSky ? visible(DEEP_SKY) : []))
const dsoTip = ref(null)
const dso = computed(() => dsos.value.find((o) => o.id === dsoTip.value))
const pick = computed(() => {
  if (!props.highlight) return null
  const v = entryHorizon(props.highlight, frame.value)
  const p = cam.value.project(v)
  return v[2] > 0 && inside({ p }) ? { ...props.highlight, ...altAzOf(v), p } : null
})
const moonDisc = computed(() => {
  const { moon, sun } = frame.value
  if (moon.alt <= 0) return null
  const m = horizonVector(moon)
  const p = cam.value.project(m)
  if (!p.onScreen) return null
  // A small step from the Moon toward the Sun gives the lit limb's direction on screen.
  const s = horizonVector(sun)
  const toward = m.map((c, i) => c + (s[i] - c) * 0.02)
  const n = Math.hypot(...toward)
  const q = cam.value.project(toward.map((c) => c / n))
  return { p, path: moonPath(moon.illum, 9), angle: Math.atan2(q.y - p.y, q.x - p.x) * DEG }
})
const ringStyle = (r) => {
  const [a, b = a] = r.instruments.map((i) => INSTRUMENTS[i]?.color ?? '#fff')
  return { ...pos(r.p), '--ring-a': a, '--ring-b': b }
}
const ringLabel = (r) => `${r.name}, ${r.targetClass}, ${Math.round(r.alt)}° up, ${compass(r.az)}`
const ringHover = ref(null)
const shownId = computed(() => ringHover.value ?? props.hoverId ?? props.selectedId)
const selected = computed(() => (props.layers.targets ? rings.value.find((r) => r.id === shownId.value) : null))

// The time is announced once it has been still for half a second, not on every scrub step.
const status = ref('')
let statusTimer = 0
watch(() => sky.time, () => {
  clearTimeout(statusTimer)
  statusTimer = setTimeout(() => {
    status.value = `${sky.timeLabel}, ${placed.value.length} of ${positioned.value.length} targets above the horizon`
  }, 500)
}, { immediate: true })

const ZOOM_KEYS = { '+': ZOOM_STEP, '=': ZOOM_STEP, '-': 1 / ZOOM_STEP, _: 1 / ZOOM_STEP }
const KEYS = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }
function onKey(e) {
  if (ZOOM_KEYS[e.key]) { e.preventDefault(); return sky.zoomBy(ZOOM_KEYS[e.key]) }
  const k = KEYS[e.key]
  if (!k) return
  e.preventDefault()
  sky.touch()
  view.yaw += k[0]
  view.pitch = Math.min(85, Math.max(5, view.pitch + k[1]))
}
// On the tile a plain scroll keeps scrolling the page and shows how to zoom instead; Ctrl + scroll zooms
// (trackpad pinches arrive as Ctrl + wheel too). The sky page fills the screen, so there a plain scroll zooms.
const hint = ref('')
let hintTimer = 0
function showHint(text) {
  hint.value = text
  clearTimeout(hintTimer)
  hintTimer = setTimeout(() => { hint.value = '' }, 1500)
}
function onWheel(e) {
  if (!props.immersive && !e.ctrlKey && !e.metaKey) {
    return showHint(`${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'} + scroll to zoom`)
  }
  e.preventDefault()
  hint.value = ''
  sky.zoomBy(Math.exp(-e.deltaY * 0.002), false)
}

// Two fingers zoom by how far apart they move and tilt by how far they move up or down together (on the tile one
// finger only turns, so vertical swipes scroll the page); the drag pauses until fewer than two are down.
const fingers = new Map()
let pinch = null
let hinted = false
const spanOf = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y) }
const midY = () => { const [a, b] = [...fingers.values()]; return (a.y + b.y) / 2 }
function onPointerDown(e) {
  fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (e.pointerType === 'touch' && !hinted) {
    hinted = true
    showHint(props.immersive ? 'Pinch to zoom' : 'Two fingers to tilt and zoom')
  }
  if (fingers.size !== 2) return
  drag?.disable()
  pinch = { span: spanOf() || 1, zoom: view.zoom, y: midY() }
}
function onPointerMove(e) {
  if (!fingers.has(e.pointerId)) return
  fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (!pinch) return
  sky.touch()
  view.zoom = sky.clampZoom(pinch.zoom * spanOf() / pinch.span)
  const y = midY()
  view.pitch = Math.min(85, Math.max(5, view.pitch + (y - pinch.y) * cam.value.degPerPx))
  pinch.y = y
}
function onPointerUp(e) {
  fingers.delete(e.pointerId)
  if (pinch && fingers.size < 2) { pinch = null; drag?.enable() }
}

const onEsc = (e) => {
  if (e.key !== 'Escape') return
  ringHover.value = null
  emit('update:selectedId', null)
}

let drag = null
let observer = null
onMounted(() => {
  document.addEventListener('keydown', onEsc)
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(([e]) => {
      if (e.contentRect.width > 0) { size.width = e.contentRect.width; size.height = e.contentRect.height }
    })
    observer.observe(stage.value)
  }
  // Dragging moves the sky with the pointer. On the tile's touch screens only sideways, so vertical swipes scroll.
  let last = null
  const move = function () {
    const d = cam.value.degPerPx
    view.yaw -= (this.x - last.x) * d
    view.pitch = Math.min(85, Math.max(5, view.pitch + (this.y - last.y) * d))
    last = { x: this.x, y: this.y }
  }
  drag = Draggable.create(document.createElement('div'), {
    trigger: stage.value,
    type: !props.immersive && window.matchMedia?.('(pointer: coarse)').matches ? 'x' : 'x,y',
    inertia: !reduceMotion(),
    dragClickables: false,
    onPress() { sky.touch(); last = { x: this.x, y: this.y } },
    onDrag: move,
    onThrowUpdate: move,
  })[0]
})
onBeforeUnmount(() => {
  drag?.kill()
  observer?.disconnect()
  clearTimeout(statusTimer)
  clearTimeout(hintTimer)
  document.removeEventListener('keydown', onEsc)
})
</script>

<template>
  <div ref="stage" class="sky-stage" :class="{ immersive }" tabindex="0"
       aria-label="sky view: drag or use the arrow keys to look around, + and − to zoom" :style="{ '--dark': dark }"
       @keydown="onKey" @wheel="onWheel" @pointerdown="onPointerDown" @pointermove="onPointerMove"
       @pointerup="onPointerUp" @pointercancel="onPointerUp">
    <SkyCanvas :frame="frame" :cam="cam" :seed="seed" :layers="layers" @failed="emit('failed')" />
    <template v-if="layers.names">
      <span v-for="n in labels" :key="n.abbr" class="sky-name" :style="pos(n.p)" aria-hidden="true">{{ n.name }}</span>
    </template>
    <span v-for="(s, i) in starLabels" :key="i" class="sky-star-name" :style="pos(s.p)" aria-hidden="true">{{ s.name }}</span>
    <span v-for="o in dsos" :key="o.id" class="sky-dso" :style="pos(o.p)" aria-hidden="true"
          @mouseenter="dsoTip = o.id" @mouseleave="dsoTip = null" @click="dsoTip = dsoTip === o.id ? null : o.id">
      <span v-if="view.zoom >= 2" class="sky-dso-name">{{ o.name }}</span>
    </span>
    <span v-for="c in compassMarks" :key="c.az" class="sky-compass" :style="pos(c.p)" aria-hidden="true">{{ c.label }}</span>
    <template v-if="layers.planets">
      <span v-for="pl in planets" :key="pl.id" class="sky-planet" :style="pos(pl.p)" aria-hidden="true">{{ pl.id }}</span>
      <svg v-if="moonDisc" class="sky-moon" :style="pos(moonDisc.p)" viewBox="-10 -10 20 20" aria-hidden="true">
        <circle r="9" class="sky-moon-dark" />
        <path :d="moonDisc.path" :transform="`rotate(${moonDisc.angle})`" class="sky-moon-lit" />
      </svg>
    </template>
    <template v-if="layers.targets">
      <button v-for="r in rings" :key="r.id" class="sky-ring"
              :class="{ active: r.id === shownId, dim: emphasis && !emphasis.has(r.id) }" :style="ringStyle(r)"
              :aria-label="ringLabel(r)" @mouseenter="ringHover = r.id" @mouseleave="ringHover = null"
              @focus="ringHover = r.id" @blur="ringHover = null" @click="emit('update:selectedId', r.id)" />
      <button v-for="r in edges" :key="`edge-${r.id}`" class="sky-edge" :style="pos(r.edge)" :aria-label="`Turn to ${r.name}`"
              @click="sky.turnTo(r)">{{ r.edge.arrow }} {{ r.name }}</button>
    </template>
    <Transition :css="false" @enter="tipIn" @leave="tipOut">
      <span v-if="selected" :key="selected.id" class="moon-tip sky-tip" role="tooltip" :style="pos(selected.p)">
        <span class="moon-tip-item">
          <strong>{{ selected.name }}</strong>
          <span class="muted small">{{ selected.targetClass }} · {{ Math.round(selected.alt) }}° up, {{ compass(selected.az) }}</span>
          <span class="muted small">Best at {{ fmtTime(selected.bestTime) }}</span>
          <span class="muted small">{{ selected.instruments.map((i) => INSTRUMENTS[i]?.label ?? i).join(' · ') }}</span>
        </span>
      </span>
    </Transition>
    <Transition :css="false" @enter="tipIn" @leave="tipOut">
      <span v-if="dso" :key="dso.id" class="moon-tip sky-tip" role="tooltip" :style="pos(dso.p)">
        <span class="moon-tip-item">
          <strong>{{ dso.name }}</strong>
          <span class="muted small">{{ dso.type?.replace(/_/g, ' ') }} · magnitude {{ dso.magnitude ?? '—' }}</span>
        </span>
      </span>
    </Transition>
    <span v-if="pick" class="sky-pick" :style="pos(pick.p)" aria-hidden="true" />
    <Transition :css="false" @enter="tipIn" @leave="tipOut">
      <span v-if="pick && !selected && !dso" :key="`pick-${pick.kind}-${pick.id}`" class="moon-tip sky-tip" role="tooltip"
            :style="pos(pick.p)">
        <span class="moon-tip-item">
          <strong>{{ pick.name }}</strong>
          <span class="muted small">{{ pick.kind }} · {{ Math.round(pick.alt) }}° up, {{ compass(pick.az) }}</span>
        </span>
      </span>
    </Transition>
    <p v-if="hint" class="sky-hint" aria-hidden="true">{{ hint }}</p>
    <p class="sr-only" role="status" aria-live="polite">{{ status }}</p>
  </div>
</template>
