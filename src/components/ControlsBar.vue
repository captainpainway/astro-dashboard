<script setup>
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
})
const emit = defineEmits(['update:mode', 'update:atTime', 'update:activeClasses', 'update:sortKey'])

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
      <button :class="{ active: mode === 'window' }" @click="emit('update:mode', 'window')">tonight</button>
      <button :class="{ active: mode === 'instant' }" @click="emit('update:mode', 'instant')">at time</button>
      <GlassSelect v-if="mode === 'instant'" class="time-select" aria-label="time" :options="TIMES"
                   :model-value="atTime" @update:model-value="emit('update:atTime', $event)" />
    </div>
    <div class="chips">
      <button v-for="c in CLASSES" :key="c" :class="{ chip: true, active: activeClasses.includes(c) }"
              @click="toggleClass(c)">{{ c }}</button>
    </div>
    <GlassSelect class="sorts" label="sort by" align="right" :options="SORTS"
                 :model-value="sortKey" @update:model-value="emit('update:sortKey', $event)" />
  </section>
</template>
