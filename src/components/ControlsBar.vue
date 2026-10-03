<script setup>
import { computed } from 'vue'
import GlassSelect from './GlassSelect.vue'

const CLASSES = ['planet', 'moon', 'variable', 'messier', 'nebula', 'cluster']
const SORTS = [
  { value: 'score', label: 'score' },
  { value: 'bestTime', label: 'best time' },
  { value: 'maxAlt', label: 'altitude' },
  { value: 'name', label: 'name' },
]
// Observing times in 30-minute steps from sunset to sunrise, each rounded to the nearest half hour (6:00 PM to
// 6:00 AM where there is no sunset or sunrise); values are the HH:MM the API takes as at=
const clockMinutes = (iso) => { const m = /T(\d{2}):(\d{2})/.exec(iso ?? ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null }
const nearestHalfHour = (mins) => Math.round(mins / 30) * 30
const option = (total) => {
  const mins = total % (24 * 60)
  const h = Math.floor(mins / 60), m = String(mins % 60).padStart(2, '0')
  return { value: `${String(h).padStart(2, '0')}:${m}`, label: `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}` }
}

const props = defineProps({
  mode: { type: String, required: true },
  atTime: { type: String, default: '' },
  activeClasses: { type: Array, required: true },
  sortKey: { type: String, required: true },
  twilight: { type: Object, default: null },
})
const TIMES = computed(() => {
  const [set, rise] = [clockMinutes(props.twilight?.sunset), clockMinutes(props.twilight?.sunrise)]
  const from = set == null || rise == null ? 18 * 60 : nearestHalfHour(set)
  let to = set == null || rise == null ? 30 * 60 : nearestHalfHour(rise)
  if (to <= from) to += 24 * 60
  return Array.from({ length: (to - from) / 30 + 1 }, (_, i) => option(from + i * 30))
})
const emit = defineEmits(['update:mode', 'update:atTime', 'update:activeClasses', 'update:sortKey'])

function setMode(m) {
  if (m === props.mode) return
  emit('update:mode', m)
}

function setAtTime(t) {
  if (t === props.atTime) return
  emit('update:atTime', t)
}

function toggleClass(c) {
  const active = new Set(props.activeClasses)
  if (active.has(c) && active.size === 1) return // never deselect the last class
  active.has(c) ? active.delete(c) : active.add(c)
  emit('update:activeClasses', [...active])
}
</script>

<template>
  <section class="controls panel">
    <div class="mode">
      <div class="btn-group">
        <button :class="{ active: mode === 'window' }" @click="setMode('window')">tonight</button>
        <button :class="{ active: mode === 'instant' }" @click="setMode('instant')">at time</button>
      </div>
      <GlassSelect v-if="mode === 'instant'" class="time-select" aria-label="time" :options="TIMES"
                   :model-value="atTime" @update:model-value="setAtTime" />
    </div>
    <div class="chips">
      <button v-for="c in CLASSES" :key="c" :class="{ chip: true, active: activeClasses.includes(c) }"
              @click="toggleClass(c)">{{ c }}</button>
    </div>
    <GlassSelect class="sorts" label="sort by" align="right" :options="SORTS"
                 :model-value="sortKey" @update:model-value="emit('update:sortKey', $event)" />
  </section>
</template>
