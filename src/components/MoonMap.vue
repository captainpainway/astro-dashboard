<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { fmtCoords, fmtTime } from '../format'
import { moonView, moonVisibleTimes, project, rotateBasis, skyRotation, sunVector, viewBasis } from '../engine/moonview'
import { altaz, observerFor } from '../engine/astro'
import { toLocalIso } from '../engine/time'
import GlassSelect from './GlassSelect.vue'
// NASA SVS CGI Moon Kit (public domain): LROC color map, 2048x1024 equirectangular.
import textureUrl from '../assets/moon-2k.jpg'

const props = defineProps({
  features: { type: Array, required: true },
  location: { type: Object, required: true },
  night: { type: Object, default: null }, // observing window; the sky-view times stay inside it
})
const emit = defineEmits(['failed'])

const SIZE = 1024
const now = new Date() // read once: "now" is when the map was mounted or refreshed
const ZOOM_MIN = 50 // percent of the full width; below this the dots crowd the disc
const zoom = ref(100)
const orientation = ref('north') // 'north' | 'sky'
const when = ref('now') // 'now' or epoch ms of a time in the Moon's pass; only used in the sky orientation
const date = computed(() => (orientation.value === 'sky' && when.value !== 'now' ? new Date(Number(when.value)) : now))
const view = computed(() => moonView(date.value))
// How far the Moon is turned from north-up, in radians. `spin.angle` is what's drawn; it glides to `skyAngle` (see below).
const skyAngle = computed(() => (orientation.value === 'sky' ? skyRotation(date.value, props.location) : 0))
const spin = reactive({ angle: 0 })
const basis = computed(() => rotateBasis(viewBasis(view.value.earth), spin.angle))

const belowHorizon = computed(() => altaz('moon', date.value, observerFor(props.location)).alt < 0)
const passTimes = moonVisibleTimes(props.location, now,
  props.night && { start: new Date(props.night.startUtc), end: new Date(props.night.endUtc) })
const stamp = (d) => fmtTime(toLocalIso(d, props.location.timezone))
const timeOptions = [{ value: 'now', label: 'now' }, ...passTimes.map(({ date, event }) => ({
  value: String(date.getTime()),
  label: `${event ? `${event} ` : ''}${stamp(date)}`,
}))]
const failed = ref(typeof WebGLRenderingContext === 'undefined')
watch(failed, (v) => { if (v) emit('failed') }, { immediate: true }) // lets the page fall back to the list
const canvas = ref(null)
const selectedId = ref(null)

// The 13 feature types in lunar.json, folded into a few colours that can be told apart on the grey surface.
const GROUPS = [
  { label: 'craters', color: '#7aa2ff', types: ['Crater'] },
  { label: 'maria & seas', color: '#c084fc', types: ['Mare', 'Oceanus', 'Lacus', 'Sinus', 'Palus'] },
  { label: 'mountains & capes', color: '#fbbf24', types: ['Mons', 'Promontorium'] },
  { label: 'rilles, valleys & scarps', color: '#4ade80', types: ['Rupes', 'Vallis', 'Rima'] },
  { label: 'other', color: '#f472b6', types: [] },
]
const groupOf = (type) => GROUPS.find((g) => g.types.includes(type)) ?? GROUPS.at(-1)

const MERGE = 0.04 // unit-disc distance under which two dots can't be told apart (about 8px at full size)
// One dot per spot: features that project almost on top of each other share a dot (and a tooltip) listing all of them.
const dots = computed(() => {
  const out = []
  for (const f of props.features) {
    if (f.lat == null) continue
    const p = project(f, basis.value)
    if (!p.visible) continue
    const near = out.find((d) => Math.hypot(d.x - p.x, d.y - p.y) < MERGE)
    if (near) near.items.push(f)
    else out.push({ id: f.id, items: [f], x: p.x, y: p.y, group: groupOf(f.type) })
  }
  return out
})
const legend = computed(() => GROUPS.filter((g) => dots.value.some((d) => d.group === g)))
const selected = computed(() => dots.value.find((d) => d.id === selectedId.value))
const pos = (d) => ({ left: `${50 + d.x * 50}%`, top: `${50 - d.y * 50}%` })
const dotStyle = (d) => ({ ...pos(d), '--dot': d.group.color })

const VERT = `attribute vec2 aPos; varying vec2 vPos;
void main() { vPos = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`
const FRAG = `precision highp float;
varying vec2 vPos;
uniform sampler2D uTex;
uniform vec3 uRight, uUp, uEarth, uSun;
const float PI = 3.14159265;
void main() {
  float r2 = dot(vPos, vPos);
  if (r2 > 1.0) discard;
  float edge = clamp((1.0 - sqrt(r2)) * ${SIZE / 2}.0, 0.0, 1.0); // one canvas pixel of coverage ramp at the rim
  vec3 p = vPos.x * uRight + vPos.y * uUp + sqrt(1.0 - r2) * uEarth;
  vec2 uv = vec2(atan(p.y, p.x) / (2.0 * PI) + 0.5, 0.5 - asin(clamp(p.z, -1.0, 1.0)) / PI);
  float lit = mix(0.04, 1.0, smoothstep(-0.02, 0.12, dot(p, uSun)));
  float limb = 0.55 + 0.45 * sqrt(1.0 - r2);
  gl_FragColor = vec4(texture2D(uTex, uv).rgb * lit * limb * edge, edge); // premultiplied alpha
}`

let gl = null
let uniforms = null // set once the texture is uploaded; render() waits for it

function setup(img) {
  const compile = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
    return s
  }
  const prog = gl.createProgram()
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  gl.useProgram(prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const a = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(a)
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img)
  gl.generateMipmap(gl.TEXTURE_2D) // texture is a power of two, as WebGL1 requires
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  uniforms = Object.fromEntries(['uRight', 'uUp', 'uEarth', 'uSun'].map((n) => [n, gl.getUniformLocation(prog, n)]))
  gl.viewport(0, 0, SIZE, SIZE)
}

function render() {
  gl.uniform3fv(uniforms.uRight, basis.value.right)
  gl.uniform3fv(uniforms.uUp, basis.value.up)
  gl.uniform3fv(uniforms.uEarth, basis.value.earth)
  gl.uniform3fv(uniforms.uSun, sunVector(view.value.sub))
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}
watch([basis, view], () => { if (uniforms) render() })

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
// The tip's bottom-left corner sits 14px above its dot: it pops out from there and springs into place, then shrinks back.
function tipIn(el, done) {
  gsap.set(el, { yPercent: -100 })
  if (reduceMotion()) { gsap.set(el, { y: -14 }); return done() }
  gsap.fromTo(el, { opacity: 0, scale: 0.3, y: -4, rotation: -4 },
    { opacity: 1, scale: 1, y: -14, rotation: 0, duration: 0.45, ease: 'back.out(2.4)', onComplete: done })
}
function tipOut(el, done) {
  if (reduceMotion()) return done()
  gsap.to(el, { opacity: 0, scale: 0.6, y: -8, duration: 0.15, ease: 'power2.in', onComplete: done })
}

// Turn the Moon the short way round to the new angle; the dots and the canvas follow `spin.angle` frame by frame.
watch(skyAngle, (to) => {
  const target = spin.angle + Math.atan2(Math.sin(to - spin.angle), Math.cos(to - spin.angle))
  if (reduceMotion()) spin.angle = target
  else gsap.to(spin, { angle: target, duration: 0.8, ease: 'power2.inOut', overwrite: true })
})

// The stage's width is --zoom (see style.css); tweening the variable resizes the Moon and its dots smoothly.
const stage = ref(null)
watch(zoom, (z) => {
  const to = { '--zoom': z / 100 }
  if (reduceMotion()) gsap.set(stage.value, to)
  else gsap.to(stage.value, { ...to, duration: 0.45, ease: 'power3.out', overwrite: true })
})

const close = () => { selectedId.value = null }
const onKey = (e) => { if (e.key === 'Escape') close() }

onMounted(() => {
  document.addEventListener('keydown', onKey)
  if (failed.value) return
  gl = canvas.value.getContext('webgl')
  if (!gl) { failed.value = true; return }
  const img = new Image()
  img.onload = () => { try { setup(img); render() } catch { failed.value = true } }
  img.onerror = () => { failed.value = true }
  img.src = textureUrl
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <template v-if="!failed">
  <section class="controls panel moon-controls">
    <div class="btn-group" role="group" aria-label="orientation">
      <button :class="{ active: orientation === 'north' }" @click="orientation = 'north'">north up</button>
      <button :class="{ active: orientation === 'sky' }" @click="orientation = 'sky'">sky view</button>
    </div>
    <GlassSelect v-if="orientation === 'sky'" v-model="when" aria-label="time" :options="timeOptions" />
    <span v-if="orientation === 'sky' && belowHorizon" class="muted small" role="status">The Moon is below the horizon at this time, so it isn't visible.</span>
    <div class="btn-group zoom" role="group" aria-label="zoom">
      <button aria-label="smallest" :disabled="zoom <= ZOOM_MIN" @click="zoom = ZOOM_MIN">min</button>
      <button aria-label="zoom out" :disabled="zoom <= ZOOM_MIN" @click="zoom -= 10">−</button>
      <button aria-label="zoom in" :disabled="zoom >= 100" @click="zoom += 10">+</button>
      <button aria-label="full size" :disabled="zoom >= 100" @click="zoom = 100">max</button>
    </div>
  </section>
  <div ref="stage" class="moon-map">
    <canvas ref="canvas" :width="SIZE" :height="SIZE" />
    <button v-for="d in dots" :key="d.id" class="moon-dot" :class="{ active: d.id === selectedId }"
            :style="dotStyle(d)" :aria-label="d.items.map((f) => f.name).join(', ')" @mouseenter="selectedId = d.id" @mouseleave="close"
            @focus="selectedId = d.id" @blur="close" />
    <Transition :css="false" @enter="tipIn" @leave="tipOut">
      <span v-if="selected" :key="selected.id" class="moon-tip" role="tooltip" :style="pos(selected)"><span v-for="f in selected.items" :key="f.id" class="moon-tip-item">
        <strong>{{ f.name }}</strong>
        <span class="muted small">{{ f.type }} · {{ fmtCoords(f.lat, f.lon) }}</span>
        <span class="muted small">Best at {{ fmtTime(f.bestTime) }}</span>
      </span></span>
    </Transition>
  </div>
  <ul class="moon-legend">
    <li v-for="g in legend" :key="g.label"><i :style="{ background: g.color }" />{{ g.label }}</li>
  </ul>
  </template>
</template>
