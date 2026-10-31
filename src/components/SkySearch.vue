<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { altAzOf, entryHorizon, searchSky } from '../engine/sky'
import { compass } from '../format'

const props = defineProps({
  index: { type: Array, required: true }, // searchIndex(...)
  frame: { type: Object, default: null }, // the shown time's sky, for each result's position
})
const emit = defineEmits(['pick', 'clear'])

const KIND = {
  target: "tonight's target", planet: 'planet', moon: 'Moon', 'deep-sky': 'deep-sky object',
  variable: 'variable star', constellation: 'constellation', star: 'star',
}
const query = ref('')
const active = ref(0)
const open = ref(false)
const input = ref(null)
const results = computed(() => searchSky(props.index, query.value))
const where = (e) => {
  if (!props.frame) return ''
  const { alt, az } = altAzOf(entryHorizon(e, props.frame))
  return alt > 0 ? `${Math.round(alt)}° up ${compass(az)}` : 'below horizon'
}

function choose(e) {
  query.value = e.name
  open.value = false
  emit('pick', e)
}
function onInput(e) {
  query.value = e.target.value
  active.value = 0
  open.value = true
}
function onKey(e) {
  const n = results.value.length
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    open.value = true
    if (n) active.value = (active.value + (e.key === 'ArrowDown' ? 1 : n - 1)) % n
  } else if (e.key === 'Enter' && results.value[active.value]) {
    e.preventDefault()
    choose(results.value[active.value])
  } else if (e.key === 'Escape') {
    query.value = ''
    open.value = false
    emit('clear')
  }
}
// "/" jumps to the search box from anywhere on the page, unless the visitor is typing somewhere else.
const onSlash = (e) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
  if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
  e.preventDefault()
  input.value?.focus()
}
onMounted(() => document.addEventListener('keydown', onSlash))
onBeforeUnmount(() => document.removeEventListener('keydown', onSlash))
</script>

<template>
  <div class="sky-search">
    <input ref="input" type="search" role="combobox" class="sky-search-input" placeholder="Search the sky  /"
           aria-label="Search the sky" aria-autocomplete="list" aria-controls="sky-search-list"
           :aria-expanded="open && query.length > 0"
           :aria-activedescendant="open && results.length ? `sky-search-${active}` : undefined"
           :value="query" @input="onInput" @keydown="onKey" @focus="open = true" @blur="open = false">
    <ul v-if="open && query" id="sky-search-list" role="listbox" class="sky-search-list">
      <li v-for="(r, i) in results" :id="`sky-search-${i}`" :key="`${r.kind}-${r.id}`" role="option"
          :aria-selected="i === active" :class="{ active: i === active }" @mousedown.prevent="choose(r)">
        <strong>{{ r.name }}</strong><span v-if="r.id !== r.name" class="muted sky-search-id">{{ r.id }}</span>
        <span class="muted small">{{ KIND[r.kind] }}<template v-if="frame"> · {{ where(r) }}</template></span>
      </li>
      <li v-if="!results.length" class="muted small sky-search-none" role="option" aria-disabled="true">No matches</li>
    </ul>
  </div>
</template>
