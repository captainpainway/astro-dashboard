<script>
/** Sky layers as [key, label, on by default]. The home tile always uses the defaults. */
export const LAYERS = [
  ['lines', 'Constellation lines', true],
  ['names', 'Constellation names', true],
  ['planets', 'Planets and Moon', true],
  ['targets', "Tonight's targets", true],
  ['stars', 'Star names', false],
  ['deepSky', 'Deep-sky catalogue', false],
  ['grid', 'Alt/az grid', false],
  ['ecliptic', 'Ecliptic', false],
  ['meridian', 'Meridian', false],
]
export const DEFAULT_LAYERS = Object.fromEntries(LAYERS.map(([key, , on]) => [key, on]))

const KEY = 'astrodash.skyLayers'
/** Saved choices over the defaults; just the defaults when storage is unavailable or holds something else. */
export function loadLayers() {
  try {
    return { ...DEFAULT_LAYERS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...DEFAULT_LAYERS }
  }
}
export function saveLayers(layers) {
  try {
    localStorage.setItem(KEY, JSON.stringify(layers))
  } catch {
    // Private mode or blocked storage: the choice lasts for this visit only.
  }
}
</script>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({ modelValue: { type: Object, required: true } }) // { [layer key]: boolean }
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const root = ref(null)
const set = (key, on) => emit('update:modelValue', { ...props.modelValue, [key]: on })
const onPointer = (e) => { if (open.value && !root.value?.contains(e.target)) open.value = false }
const onKey = (e) => { if (e.key === 'Escape') open.value = false }
onMounted(() => {
  document.addEventListener('pointerdown', onPointer)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointer)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="sky-layers">
    <button class="show-more" :aria-expanded="open" aria-controls="sky-layers-menu" @click="open = !open">Layers</button>
    <fieldset v-if="open" id="sky-layers-menu" class="sky-layers-menu">
      <legend class="sr-only">Sky layers</legend>
      <label v-for="[key, label] in LAYERS" :key="key">
        <input type="checkbox" :checked="modelValue[key]" @change="set(key, $event.target.checked)">{{ label }}
      </label>
    </fieldset>
  </div>
</template>
