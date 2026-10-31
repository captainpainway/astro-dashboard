<script setup>
import { nextTick, ref, watch } from 'vue'
import { compass, fmtTime } from '../format'
import { reduceMotion } from '../motion'
import { INSTRUMENTS } from './SkyStage.vue'

const props = defineProps({
  rows: { type: Array, required: true }, // filtered targets, each with `pos` ({ alt, az } at the shown time, or null)
  instrument: { type: String, required: true }, // 'all' or an instrument key
  upOnly: { type: Boolean, required: true },
  selectedId: { type: String, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
})
const emit = defineEmits(['update:instrument', 'update:upOnly', 'pick', 'hover', 'close', 'details'])

const CHIPS = [['all', 'All'], ['dob_8inch', '8" Dob'], ['dwarf_mini', 'Dwarf Mini']]
const list = ref(null)
const where = (r) => (!r.pos ? '—' : r.pos.alt > 0 ? `${Math.round(r.pos.alt)}° ${compass(r.pos.az)}` : 'below horizon')

// The picked target's row is kept in view: when it's picked on the sky, and when the panel opens or the list first
// renders with a pick already made (e.g. arriving from Tonight). Only the list scrolls, never the page around it.
// A row that's partly visible is nudged in; one that's out of sight is centred, smoothly unless it's the first show.
function reveal(id, smooth) {
  const ul = list.value
  const li = ul && [...ul.children].find((el) => el.dataset.id === id)
  if (!li) return
  const box = ul.getBoundingClientRect()
  const row = li.getBoundingClientRect()
  const top = row.top - box.top + ul.scrollTop
  const bottom = top + row.height
  const { scrollTop: from, clientHeight: h } = ul
  if (top >= from && bottom <= from + h) return
  const seen = bottom > from && top < from + h
  const goal = !seen ? top - (h - row.height) / 2 : top < from ? top : bottom - h
  ul.scrollTo?.({ top: Math.max(0, goal), behavior: smooth && !reduceMotion() ? 'smooth' : 'auto' })
}
watch(() => props.selectedId, async (id) => {
  await nextTick()
  reveal(id, true)
})
watch(list, (ul) => { if (ul && props.selectedId) reveal(props.selectedId, false) }, { flush: 'post' })
</script>

<template>
  <aside class="sky-targets" aria-label="Tonight's targets">
    <header class="sky-targets-head">
      <h2>Targets</h2>
      <button class="sky-targets-close" aria-label="Hide targets" @click="emit('close')">✕</button>
    </header>
    <div class="chips sky-targets-filter" role="group" aria-label="instrument">
      <button v-for="[key, label] in CHIPS" :key="key" :class="{ active: instrument === key }"
              :aria-pressed="instrument === key" @click="emit('update:instrument', key)">{{ label }}</button>
    </div>
    <label class="sky-targets-up small">
      <input type="checkbox" :checked="upOnly" @change="emit('update:upOnly', $event.target.checked)">
      above the horizon
    </label>
    <p v-if="loading" class="muted small">loading targets…</p>
    <p v-else-if="error" class="error small">{{ error }}</p>
    <p v-else-if="!rows.length" class="muted small">No targets match these filters</p>
    <ul v-else ref="list" class="sky-target-list">
      <li v-for="r in rows" :key="r.id" :data-id="r.id" class="sky-target-item">
        <button class="sky-target-row" :class="{ active: r.id === selectedId }" @click="emit('pick', r)"
                @mouseenter="emit('hover', r.id)" @mouseleave="emit('hover', null)"
                @focus="emit('hover', r.id)" @blur="emit('hover', null)">
          <span class="sky-swatch" aria-hidden="true">
            <i v-for="i in r.instruments" :key="i" :style="{ background: INSTRUMENTS[i]?.color ?? '#fff' }" />
          </span>
          <span class="sky-target-name">{{ r.name }}</span>
          <span class="sky-target-meta muted small">{{ r.targetClass }} · best {{ fmtTime(r.bestTime) }}</span>
          <span class="sky-target-where small">{{ where(r) }}</span>
        </button>
        <button class="sky-target-details" :aria-label="`${r.name} details in Tonight`" title="Details in Tonight"
                @click="emit('details', r)">↗</button>
      </li>
    </ul>
  </aside>
</template>
