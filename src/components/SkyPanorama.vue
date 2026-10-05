<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import skyData from '../engine/sky.json'
import {
  altAzOf, camera, darkness, edgeMarker, fieldOfView, horizonVector, introEnd, moonPath, nightRange, rotate, skyAt,
  targetHorizon, terrainSeed, topTargets, turnTarget, unitVector,
} from '../engine/sky'
import { toLocalIso } from '../engine/time'
import { compass, fmtTime } from '../format'
import { reduceMotion, tipIn, tipOut } from '../motion'
import SkyCanvas from './SkyCanvas.vue'

gsap.registerPlugin(Draggable, InertiaPlugin)

const props = defineProps({
  location: { type: Object, required: true },
  tonight: { type: Object, default: null },
  bestHour: { type: String, default: null }, // ISO start of the best dark hour, once the forecast is in
})
const emit = defineEmits(['time', 'failed'])

const DEG = 180 / Math.PI
const STEP = 5 * 60_000
const INSTRUMENTS = {
  dob_8inch: { label: '8" Dobsonian', color: '#7aa2ff' },
  dwarf_mini: { label: 'Dwarf Mini', color: '#f0abfc' },
}
const NAMES = skyData.names.map(([abbr, name, ra, dec]) => ({ abbr, name, v: unitVector(ra, dec) }))

const stage = ref(null)
const size = reactive({ width: 1000, height: 385 }) // jsdom has no layout; the ResizeObserver takes over in browsers
const view = reactive({ yaw: 180, pitch: 25 })
const now = ref(new Date())
const time = ref(now.value.getTime())
const range = computed(() => nightRange(props.location, now.value))
const frame = computed(() => skyAt(props.location, new Date(time.value)))
const cam = computed(() => camera({ ...view, hfov: fieldOfView(size.width), width: size.width, height: size.height }))
const seed = computed(() => terrainSeed(props.location))
const dark = computed(() => darkness(frame.value))
const targets = computed(() => topTargets(props.tonight?.instruments))
const timeLabel = computed(() => fmtTime(toLocalIso(new Date(time.value), props.location.timezone)))

// Overlay: everything is placed in tile px by the same camera the shaders use.
const pos = (p) => ({ left: `${p.x}px`, top: `${p.y}px` })
const positioned = computed(() => targets.value.flatMap((t) => {
  const v = targetHorizon(t, frame.value)
  return v ? [{ ...t, ...altAzOf(v), v }] : []
}))
const placed = computed(() => positioned.value.filter((r) => r.alt > 0).map((r) => ({ ...r, p: cam.value.project(r.v) })))
const rings = computed(() => placed.value.filter((r) => r.p.onScreen))
const edges = computed(() => placed.value.filter((r) => !r.p.onScreen).map((r) => ({ ...r, edge: edgeMarker(r.v, cam.value) })))
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
const selectedId = ref(null)
const selected = computed(() => rings.value.find((r) => r.id === selectedId.value))

// Scrubber ticks, as % of the night.
const pct = (t) => {
  const { start, end } = range.value
  return t >= start && t <= end ? ((t - start) / (end - start)) * 100 : null
}
const nowTick = computed(() => pct(now.value.getTime()))
const bestTick = computed(() => (props.bestHour ? pct(Date.parse(props.bestHour)) : null))

// The time is announced once it has been still for half a second, not on every scrub step.
const status = ref('')
let statusTimer = 0
watch(time, (t) => {
  emit('time', t)
  clearTimeout(statusTimer)
  statusTimer = setTimeout(() => {
    status.value = `${timeLabel.value}, ${placed.value.length} of ${positioned.value.length} targets above the horizon`
  }, 500)
}, { immediate: true })

let intro = null
let touched = false // after any drag, key, scrub or turn the camera is the visitor's until the next open
function stopMotion() {
  intro?.kill()
  intro = null
  gsap.killTweensOf(view)
}
function touch() {
  touched = true
  stopMotion()
}

/** The highest-scoring target above the horizon at `date`, as alt/az; south at 25° when none is up. */
function topAt(date) {
  const f = skyAt(props.location, date)
  const up = targets.value.map((t) => ({ t, v: targetHorizon(t, f) })).filter(({ v }) => v && v[2] > 0)
  const best = up.sort((a, b) => b.t.score - a.t.score)[0]
  return best ? altAzOf(best.v) : { alt: 25, az: 180 }
}
function face(date, animate) {
  const goal = turnTarget(view, topAt(date), 20)
  if (animate && !reduceMotion()) gsap.to(view, { ...goal, duration: 1, ease: 'power2.inOut', overwrite: true })
  else Object.assign(view, goal)
}

/** At night: now, facing the #1 target. In daytime: the intro from sunset to the best moment (or its end state). */
function open() {
  stopMotion()
  touched = false
  now.value = new Date()
  const { start, end } = range.value
  const t = now.value.getTime()
  if (t >= start && t <= end) {
    time.value = t
    return face(now.value, false)
  }
  const stop = () => introEnd(range.value, props.bestHour).getTime()
  if (reduceMotion()) {
    time.value = stop()
    return face(new Date(time.value), false)
  }
  time.value = start.getTime()
  const from = { yaw: frame.value.sun.az, pitch: 25 } // facing the sunset glow
  Object.assign(view, from)
  const p = { v: 0 }
  intro = gsap.to(p, {
    v: 1, duration: 4, ease: 'power2.inOut',
    onUpdate() {
      // Read every frame, so a forecast or plan arriving mid-intro retargets it smoothly.
      const e = stop()
      const goal = turnTarget(from, topAt(new Date(e)), 20)
      time.value = start.getTime() + p.v * (e - start.getTime())
      view.yaw = from.yaw + p.v * (goal.yaw - from.yaw)
      view.pitch = from.pitch + p.v * (goal.pitch - from.pitch)
    },
    onComplete: () => { intro = null },
  })
}

function onScrub(e) {
  touch()
  time.value = Number(e.target.value)
}
const KEYS = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }
function onKey(e) {
  const k = KEYS[e.key]
  if (!k) return
  e.preventDefault()
  touch()
  view.yaw += k[0]
  view.pitch = Math.min(85, Math.max(5, view.pitch + k[1]))
}
function turnTo(r) {
  touch()
  const goal = turnTarget(view, r)
  if (reduceMotion()) Object.assign(view, goal)
  else gsap.to(view, { ...goal, duration: 0.8, ease: 'power2.inOut' })
}
const onEsc = (e) => { if (e.key === 'Escape') selectedId.value = null }

watch(targets, () => { if (!touched && !intro) face(new Date(time.value), true) })
watch(() => props.location, open)

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
  // Dragging moves the sky with the pointer. On touch screens only sideways, so vertical swipes still scroll the page.
  let last = null
  const move = function () {
    const d = cam.value.degPerPx
    view.yaw -= (this.x - last.x) * d
    view.pitch = Math.min(85, Math.max(5, view.pitch + (this.y - last.y) * d))
    last = { x: this.x, y: this.y }
  }
  drag = Draggable.create(document.createElement('div'), {
    trigger: stage.value,
    type: window.matchMedia?.('(pointer: coarse)').matches ? 'x' : 'x,y',
    inertia: !reduceMotion(),
    dragClickables: false,
    onPress() { touch(); last = { x: this.x, y: this.y } },
    onDrag: move,
    onThrowUpdate: move,
  })[0]
  open()
})
onBeforeUnmount(() => {
  stopMotion()
  drag?.kill()
  observer?.disconnect()
  clearTimeout(statusTimer)
  document.removeEventListener('keydown', onEsc)
})
</script>

<template>
  <section class="panel sky-tile" :aria-label="`Sky over ${location.name} tonight`" :style="{ '--dark': dark }">
    <div ref="stage" class="sky-stage" tabindex="0" aria-label="sky view: drag or use the arrow keys to look around"
         @keydown="onKey">
      <SkyCanvas :frame="frame" :cam="cam" :seed="seed" @failed="emit('failed')" />
      <span v-for="n in labels" :key="n.abbr" class="sky-name" :style="pos(n.p)" aria-hidden="true">{{ n.name }}</span>
      <span v-for="c in compassMarks" :key="c.az" class="sky-compass" :style="pos(c.p)" aria-hidden="true">{{ c.label }}</span>
      <span v-for="pl in planets" :key="pl.id" class="sky-planet" :style="pos(pl.p)" aria-hidden="true">{{ pl.id }}</span>
      <svg v-if="moonDisc" class="sky-moon" :style="pos(moonDisc.p)" viewBox="-10 -10 20 20" aria-hidden="true">
        <circle r="9" class="sky-moon-dark" />
        <path :d="moonDisc.path" :transform="`rotate(${moonDisc.angle})`" class="sky-moon-lit" />
      </svg>
      <button v-for="r in rings" :key="r.id" class="sky-ring" :class="{ active: r.id === selectedId }" :style="ringStyle(r)"
              :aria-label="ringLabel(r)" @mouseenter="selectedId = r.id" @mouseleave="selectedId = null"
              @focus="selectedId = r.id" @blur="selectedId = null" />
      <button v-for="r in edges" :key="`edge-${r.id}`" class="sky-edge" :style="pos(r.edge)" :aria-label="`Turn to ${r.name}`"
              @click="turnTo(r)">{{ r.edge.arrow }} {{ r.name }}</button>
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
    </div>
    <div class="sky-scrub">
      <div class="sky-track">
        <input type="range" class="sky-range" aria-label="time" :min="range.start.getTime()" :max="range.end.getTime()"
               :step="STEP" :value="time" :aria-valuetext="timeLabel" @input="onScrub">
        <i v-if="nowTick != null" class="sky-tick" :style="{ left: `${nowTick}%` }" title="now" />
        <i v-if="bestTick != null" class="sky-tick sky-tick-best" :style="{ left: `${bestTick}%` }" title="best hour" />
      </div>
      <span class="sky-time">{{ timeLabel }}</span>
      <a class="sky-credits small" href="credits.txt">credits</a>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{{ status }}</p>
  </section>
</template>
