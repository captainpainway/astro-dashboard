<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { fmtCoords, fmtTime } from '../format'
import { moonView, project, sunVector, viewBasis } from '../engine/moonview'
// NASA SVS CGI Moon Kit (public domain): LROC color map, 2048x1024 equirectangular.
import textureUrl from '../assets/moon-2k.jpg'

const props = defineProps({ features: { type: Array, required: true } })
const emit = defineEmits(['failed'])

const SIZE = 1024
const view = moonView(new Date()) // read once: the map shows the Moon as it is now
const basis = viewBasis(view.earth)
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
    const p = project(f, basis)
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

function draw(gl, img) {
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
  const set3 = (name, v) => gl.uniform3fv(gl.getUniformLocation(prog, name), v)
  set3('uRight', basis.right)
  set3('uUp', basis.up)
  set3('uEarth', basis.earth)
  set3('uSun', sunVector(view.sub))
  gl.viewport(0, 0, SIZE, SIZE)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

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

const close = () => { selectedId.value = null }
const onKey = (e) => { if (e.key === 'Escape') close() }

onMounted(() => {
  document.addEventListener('keydown', onKey)
  if (failed.value) return
  const gl = canvas.value.getContext('webgl')
  if (!gl) { failed.value = true; return }
  const img = new Image()
  img.onload = () => { try { draw(gl, img) } catch { failed.value = true } }
  img.onerror = () => { failed.value = true }
  img.src = textureUrl
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <template v-if="!failed">
  <div class="moon-map">
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
