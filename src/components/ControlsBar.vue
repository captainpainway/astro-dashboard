<script setup>
const CLASSES = ['planet', 'moon', 'variable', 'messier', 'nebula', 'cluster']
const SORTS = [
  { key: 'score', label: 'score' },
  { key: 'bestTime', label: 'best time' },
  { key: 'maxAlt', label: 'altitude' },
  { key: 'name', label: 'name' },
]

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
      <input v-if="mode === 'instant'" type="time" :value="atTime"
             @input="emit('update:atTime', $event.target.value)" />
    </div>
    <div class="chips">
      <button v-for="c in CLASSES" :key="c" :class="{ chip: true, active: activeClasses.includes(c) }"
              @click="toggleClass(c)">{{ c }}</button>
    </div>
    <div class="sorts">
      <label>sort by</label>
      <select :value="sortKey" @change="emit('update:sortKey', $event.target.value)">
        <option v-for="s in SORTS" :key="s.key" :value="s.key">{{ s.label }}</option>
      </select>
    </div>
  </section>
</template>