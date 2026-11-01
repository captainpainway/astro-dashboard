<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import skyData from '../engine/sky.json'
import { VISIBLE_Z, darkness, eclipticLine, gridLines, horizonVector, meridianLine, starColor, starLimit, unitVector } from '../engine/sky'

const props = defineProps({
  frame: { type: Object, required: true }, // skyAt(...)
  cam: { type: Object, required: true }, // camera(...)
  seed: { type: Array, required: true }, // terrainSeed(...)
  layers: { type: Object, required: true }, // which line layers to draw (see SkyLayersMenu)
})
const emit = defineEmits(['failed'])
const canvas = ref(null)
const dpr = Math.min(window.devicePixelRatio || 1, 2)

// Star and line programs share this: J2000 → horizon (uRot) → camera → stereographic → clip space.
const PROJECT = `
uniform mat3 uRot;
uniform vec3 uRight, uUp, uFwd;
uniform vec2 uK;
const vec4 HIDDEN = vec4(2.0, 2.0, 2.0, 1.0);
vec4 clipOf(vec3 h) {
  float k = 2.0 / (1.0 + dot(h, uFwd));
  return vec4(k * dot(h, uRight) * uK.x, k * dot(h, uUp) * uK.y, 0.0, 1.0);
}`
const QUAD_VERT = `attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`
// Each pixel is unprojected to a horizon direction; uTerrain draws only the ridge (last, so it hides stars behind it).
const SKY_FRAG = `precision highp float;
uniform vec2 uSize;
uniform float uScale;
uniform vec3 uRight, uUp, uFwd, uSunDir, uMoonDir;
uniform float uSunAlt, uMoonLight;
uniform vec3 uAmp, uPhase;
uniform bool uTerrain;
const float DEG = 57.29578;
vec3 ramp(vec3 c0, vec3 c6, vec3 c12, vec3 c18, float t) {
  if (t < 6.0) return mix(c0, c6, t / 6.0);
  if (t < 12.0) return mix(c6, c12, (t - 6.0) / 6.0);
  return mix(c12, c18, (t - 12.0) / 6.0);
}
// Decorative ridge height in degrees; whole-number harmonics so it joins up at north.
float ridge(float az) {
  return 0.8 + 0.8 * uAmp.x * (0.5 + 0.5 * sin(2.0 * az + 6.2832 * uPhase.x))
             + 0.8 * uAmp.y * (0.5 + 0.5 * sin(5.0 * az + 6.2832 * uPhase.y))
             + 0.6 * uAmp.z * (0.5 + 0.5 * sin(11.0 * az + 6.2832 * uPhase.z));
}
void main() {
  vec2 s = (gl_FragCoord.xy - 0.5 * uSize) / uScale;
  float d2 = 4.0 + dot(s, s);
  vec3 d = (4.0 * s.x * uRight + 4.0 * s.y * uUp + (8.0 - d2) * uFwd) / d2;
  float alt = asin(clamp(d.z, -1.0, 1.0)) * DEG;
  if (uTerrain) {
    float h = ridge(atan(-d.y, d.x));
    if (alt > h) discard;
    gl_FragColor = vec4(mix(vec3(0.012, 0.016, 0.03), vec3(0.07, 0.08, 0.13), smoothstep(h - 0.3, h, alt)), 1.0);
    return;
  }
  float t = clamp(-uSunAlt, 0.0, 18.0);
  vec3 zenith = ramp(vec3(0.23, 0.36, 0.60), vec3(0.11, 0.17, 0.35), vec3(0.05, 0.08, 0.19), vec3(0.02, 0.03, 0.07), t);
  vec3 horizon = ramp(vec3(0.94, 0.66, 0.41), vec3(0.75, 0.42, 0.29), vec3(0.16, 0.16, 0.31), vec3(0.04, 0.06, 0.13), t);
  vec3 col = mix(zenith, horizon, pow(1.0 - clamp(alt / 90.0, 0.0, 1.0), 3.0));
  float sun = acos(clamp(dot(d, uSunDir), -1.0, 1.0));
  col += vec3(1.0, 0.6, 0.35) * 0.6 * exp(-sun / 0.45) * (1.0 - smoothstep(0.0, 15.0, t));
  float moon = acos(clamp(dot(d, uMoonDir), -1.0, 1.0));
  col += vec3(0.62, 0.7, 0.85) * uMoonLight * (0.35 * exp(-moon / 0.12) + 0.08 * exp(-moon / 0.7));
  gl_FragColor = vec4(col, 1.0);
}`
const STAR_VERT = `${PROJECT}
attribute vec3 aPos;
attribute float aMag;
attribute vec3 aColor;
uniform float uLimit, uDpr;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec3 h = uRot * aPos;
  vColor = aColor;
  vAlpha = clamp((uLimit - aMag) / 1.5 + 0.3, 0.0, 1.0);
  gl_PointSize = clamp(4.0 - 0.6 * aMag, 1.2, 6.0) * uDpr;
  gl_Position = dot(h, uFwd) < ${VISIBLE_Z} ? HIDDEN : clipOf(h);
}`
const STAR_FRAG = `precision mediump float;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float a = vAlpha * smoothstep(1.0, 0.3, length(gl_PointCoord - 0.5) * 2.0);
  gl_FragColor = vec4(vColor * a, a); // premultiplied
}`
// Each vertex also carries its segment's other end, so a segment with either end out of view collapses.
const LINE_VERT = `${PROJECT}
attribute vec3 aPos;
attribute vec3 aOther;
void main() {
  vec3 h = uRot * aPos;
  bool hidden = min(dot(h, uFwd), dot(uRot * aOther, uFwd)) < ${VISIBLE_Z};
  gl_Position = hidden ? HIDDEN : clipOf(h);
}`
const LINE_FRAG = `precision mediump float;
uniform vec3 uColor;
uniform float uAlpha;
void main() { gl_FragColor = vec4(uColor * uAlpha, uAlpha); }`
// Line layers: colour, strength, and whether the vertices are J2000 (turned by uRot) or already in the horizon frame.
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const LINE_STYLES = {
  lines: { color: [0.55, 0.65, 0.9], alpha: (f) => 0.22 * darkness(f), j2000: true },
  grid: { color: [0.6, 0.7, 0.85], alpha: () => 0.16, j2000: false },
  ecliptic: { color: [1, 0.8, 0.45], alpha: () => 0.45, j2000: true },
  meridian: { color: [0.5, 0.9, 0.6], alpha: () => 0.35, j2000: false },
}

let gl = null
let progs = null
let buffers = null
let starCount = 0
let lineSets = null

function compile(vert, frag) {
  const shader = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
    return s
  }
  const prog = gl.createProgram()
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, vert))
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, frag))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog))
  const locs = {}
  return { prog, u: (name) => (locs[name] ??= gl.getUniformLocation(prog, name)), a: (name) => gl.getAttribLocation(prog, name) }
}

function buffer(data) {
  const b = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, b)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
  return b
}

// A segment list as two buffers: each vertex, and its segment's other end (see LINE_VERT).
const segmentBuffers = (segs) => ({
  pos: buffer(segs.flatMap(([a, b]) => [...a, ...b])),
  other: buffer(segs.flatMap(([a, b]) => [...b, ...a])),
  count: segs.length * 2,
})

function setup() {
  progs = { sky: compile(QUAD_VERT, SKY_FRAG), stars: compile(STAR_VERT, STAR_FRAG), lines: compile(LINE_VERT, LINE_FRAG) }
  const { stars, lines } = skyData
  const v = ([ra, dec]) => unitVector(ra, dec)
  const figures = lines.flatMap((figure) => figure.flatMap((line) => line.slice(1).map((p, i) => [v(line[i]), v(p)])))
  starCount = stars.length
  buffers = {
    quad: buffer([-1, -1, 1, -1, -1, 1, 1, 1]),
    starPos: buffer(stars.flatMap(([ra, dec]) => unitVector(ra, dec))),
    starMag: buffer(stars.map((s) => s[2])),
    starColor: buffer(stars.flatMap((s) => starColor(s[3]))),
  }
  lineSets = {
    lines: segmentBuffers(figures),
    grid: segmentBuffers(gridLines()),
    ecliptic: segmentBuffers(eclipticLine()),
    meridian: segmentBuffers(meridianLine()),
  }
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA) // premultiplied alpha
}

/** One draw call: program, its uniforms, then `attribs` ({ name: [buffer, size] }), disabled again afterwards. */
function draw(p, setUniforms, attribs, mode, count) {
  gl.useProgram(p.prog)
  setUniforms(p)
  const used = Object.entries(attribs).map(([name, [b, size]]) => {
    const loc = p.a(name)
    gl.bindBuffer(gl.ARRAY_BUFFER, b)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
    return loc
  })
  gl.drawArrays(mode, 0, count)
  used.forEach((loc) => gl.disableVertexAttribArray(loc))
}

function render() {
  const { frame, cam, seed } = props
  const el = canvas.value
  const w = Math.round(cam.width * dpr)
  const h = Math.round(cam.height * dpr)
  if (el.width !== w || el.height !== h) { el.width = w; el.height = h }
  gl.viewport(0, 0, w, h)
  const view = (p) => {
    gl.uniform3fv(p.u('uRight'), cam.right)
    gl.uniform3fv(p.u('uUp'), cam.up)
    gl.uniform3fv(p.u('uFwd'), cam.fwd)
  }
  const projected = (p, rot = frame.rot) => {
    view(p)
    gl.uniformMatrix3fv(p.u('uRot'), false, rot)
    gl.uniform2f(p.u('uK'), 2 * cam.scale / cam.width, 2 * cam.scale / cam.height)
  }
  const sky = (terrain) => (p) => {
    view(p)
    gl.uniform2f(p.u('uSize'), w, h)
    gl.uniform1f(p.u('uScale'), cam.scale * dpr)
    gl.uniform3fv(p.u('uSunDir'), horizonVector(frame.sun))
    gl.uniform3fv(p.u('uMoonDir'), horizonVector(frame.moon))
    gl.uniform1f(p.u('uSunAlt'), frame.sun.alt)
    gl.uniform1f(p.u('uMoonLight'), frame.moon.alt > 0 ? frame.moon.illum : 0)
    gl.uniform3fv(p.u('uAmp'), seed.slice(0, 3))
    gl.uniform3fv(p.u('uPhase'), seed.slice(3))
    gl.uniform1i(p.u('uTerrain'), terrain ? 1 : 0)
  }
  const quad = { aPos: [buffers.quad, 2] }
  draw(progs.sky, sky(false), quad, gl.TRIANGLE_STRIP, 4)
  for (const [key, style] of Object.entries(LINE_STYLES)) {
    if (!props.layers[key]) continue
    const set = lineSets[key]
    draw(progs.lines, (p) => {
      projected(p, style.j2000 ? frame.rot : IDENTITY)
      gl.uniform3fv(p.u('uColor'), style.color)
      gl.uniform1f(p.u('uAlpha'), style.alpha(frame))
    }, { aPos: [set.pos, 3], aOther: [set.other, 3] }, gl.LINES, set.count)
  }
  draw(progs.stars, (p) => { projected(p); gl.uniform1f(p.u('uLimit'), starLimit(frame)); gl.uniform1f(p.u('uDpr'), dpr) },
       { aPos: [buffers.starPos, 3], aMag: [buffers.starMag, 1], aColor: [buffers.starColor, 3] }, gl.POINTS, starCount)
  draw(progs.sky, sky(true), quad, gl.TRIANGLE_STRIP, 4)
}

// Redraw at most once per animation frame, and only when something changed: no loop runs while idle.
let queued = 0
const schedule = () => { if (progs && !queued) queued = requestAnimationFrame(() => { queued = 0; render() }) }
watch(() => [props.frame, props.cam, props.seed, props.layers], schedule)

const fail = () => emit('failed')
let setupTimer = 0
onMounted(() => {
  if (typeof WebGLRenderingContext === 'undefined') return fail()
  gl = canvas.value.getContext('webgl', { antialias: true })
  if (!gl) return fail()
  canvas.value.addEventListener('webglcontextlost', fail)
  // Compiling shaders and filling the star buffers is a heavy step: run it as its own task, after the page's first one.
  setupTimer = setTimeout(() => {
    try { setup() } catch { progs = null; return fail() }
    schedule()
  })
})
onBeforeUnmount(() => {
  clearTimeout(setupTimer)
  cancelAnimationFrame(queued)
  canvas.value?.removeEventListener('webglcontextlost', fail)
})
</script>

<template>
  <canvas ref="canvas" class="sky-canvas" aria-hidden="true" />
</template>
