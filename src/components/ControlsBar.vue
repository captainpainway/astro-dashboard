<script setup>
import { ref, watch } from 'vue'
import GlassSelect from './GlassSelect.vue'

const CLASSES = ['planet', 'moon', 'variable', 'messier', 'nebula', 'cluster']
const SORTS = [
  { value: 'score', label: 'score' },
  { value: 'bestTime', label: 'best time' },
  { value: 'maxAlt', label: 'altitude' },
  { value: 'name', label: 'name' },
]
// Observing times, 6:00 PM → 6:00 AM in 30-minute steps; values are the HH:MM the API takes as at=
const TIMES = Array.from({ length: 25 }, (_, i) => {
  const mins = (18 * 60 + i * 30) % (24 * 60)
  const h = Math.floor(mins / 60), m = String(mins % 60).padStart(2, '0')
  return { value: `${String(h).padStart(2, '0')}:${m}`, label: `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}` }
})

const props = defineProps({
  mode: { type: String, required: true },
  atTime: { type: String, default: '' },
  activeClasses: { type: Array, required: true },
  sortKey: { type: String, required: true },
  loading: { type: Boolean, default: false }, // a refetch is in flight
})
const emit = defineEmits(['update:mode', 'update:atTime', 'update:activeClasses', 'update:sortKey'])

// The chip whose click started the current fetch; it shows a chasing light until loading settles.
const pending = ref(null)
watch(() => props.loading, (now, was) => { if (was && !now) pending.value = null })
const chasing = (key) => props.loading && pending.value === key

function setMode(m) {
  if (m === props.mode) return
  pending.value = `mode:${m}`
  emit('update:mode', m)
}

// A new time refetches too; the light goes on the "at time" chip it belongs to.
function setAtTime(t) {
  if (t === props.atTime) return
  pending.value = 'mode:instant'
  emit('update:atTime', t)
}

function toggleClass(c) {
  const active = new Set(props.activeClasses)
  if (active.has(c) && active.size === 1) return // never deselect the last class
  active.has(c) ? active.delete(c) : active.add(c)
  pending.value = `class:${c}`
  emit('update:activeClasses', [...active])
}
</script>

<template>
  <section class="controls panel">
    <div class="mode">
      <button :class="{ active: mode === 'window', chasing: chasing('mode:window') }"
              :aria-busy="chasing('mode:window') || undefined" @click="setMode('window')">tonight</button>
      <button :class="{ active: mode === 'instant', chasing: chasing('mode:instant') }"
              :aria-busy="chasing('mode:instant') || undefined" @click="setMode('instant')">at time</button>
      <GlassSelect v-if="mode === 'instant'" class="time-select" aria-label="time" :options="TIMES"
                   :model-value="atTime" @update:model-value="setAtTime" />
    </div>
    <div class="chips">
      <button v-for="c in CLASSES" :key="c"
              :class="{ chip: true, active: activeClasses.includes(c), chasing: chasing(`class:${c}`) }"
              :aria-busy="chasing(`class:${c}`) || undefined" @click="toggleClass(c)">{{ c }}</button>
    </div>
    <GlassSelect class="sorts" label="sort by" align="right" :options="SORTS"
                 :model-value="sortKey" @update:model-value="emit('update:sortKey', $event)" />
  </section>
</template>
