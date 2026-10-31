<script setup>
import { nextTick, ref, watch } from 'vue'
import { compass, fmtTime } from '../format'
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

// A ring picked on the sky brings its row into view.
watch(() => props.selectedId, async (id) => {
  await nextTick()
  const li = [...(list.value?.children ?? [])].find((el) => el.dataset.id === id)
  li?.scrollIntoView?.({ block: 'nearest' })
})
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
