<script setup>
import { computed, ref, watch } from 'vue'
import { fmtCoords, fmtTime, lunarEmpty } from '../format'
import { useRowAnimation } from '../composables/useRowAnimation'
import MoonMap from './MoonMap.vue'

const props = defineProps({
  features: { type: Array, required: true },
  moon: { type: Object, default: null },
  loading: { type: Boolean, default: false },
})

const TIERS = [{ key: 'all', label: 'all' }, { key: 'eyes', label: 'eyes-only' },
               { key: 'binoculars', label: 'binoculars' }, { key: 'telescope', label: 'telescope' }]
const tier = ref('all')
const count = (key) => (key === 'all' ? props.features.length : props.features.filter((f) => f.tier === key).length)
const shown = computed(() => (tier.value === 'all' ? props.features : props.features.filter((f) => f.tier === tier.value)))
const LIMIT = 25
const expandedId = ref(null)
const showAll = ref(false)
const visible = computed(() => (showAll.value ? shown.value : shown.value.slice(0, LIMIT)))
const table = ref(null)
const { onBeforeEnter, onEnter, onLeave } = useRowAnimation(table, visible)
const mode = ref('list') // 'list' | 'map'
const mapFailed = ref(false) // no WebGL or texture: stay on the list and hide the toggle
const view = computed(() => (mapFailed.value ? 'list' : mode.value))
const mapStamp = ref(0) // new lunar data (refresh) remounts the map so it re-reads "now"
watch(() => props.moon, () => { mapStamp.value++ })
const tierLabel = computed(() => TIERS.find((t) => t.key === tier.value).label)
const deg = (x) => (x == null ? '—' : `${x.toFixed(0)}°`)
</script>

<template>
  <section class="lunar">
    <p v-if="moon" class="muted small">{{ moon.note }}</p>
    <section class="controls panel">
      <div class="chips" role="group" aria-label="instrument tier">
        <button v-for="t in TIERS" :key="t.key" :class="{ chip: true, active: tier === t.key }" @click="tier = t.key">
          {{ t.label }} ({{ count(t.key) }})
        </button>
      </div>
      <div v-if="!mapFailed" class="mode view-toggle" role="group" aria-label="view">
        <button v-for="v in ['list', 'map']" :key="v" :class="{ active: view === v }" @click="mode = v">{{ v }}</button>
      </div>
    </section>
    <MoonMap v-if="view === 'map'" :key="mapStamp" :features="shown" @failed="mapFailed = true" />
    <p v-if="loading && !features.length" class="muted">loading lunar features…</p>
    <p v-else-if="!features.length" class="muted">{{ lunarEmpty(moon) }}</p>
    <p v-else-if="!shown.length" class="muted">no {{ tierLabel }} features are well placed tonight</p>
    <div v-else-if="view === 'list'" class="targets-panel panel">
      <table ref="table" class="targets">
        <thead>
          <tr>
            <th /> <th>feature</th> <th>tier</th> <th>score</th>
            <th title="Sun altitude at the feature when it is best placed">sun</th>
            <th>best time</th> <th>why</th>
          </tr>
        </thead>
        <TransitionGroup tag="tbody" :css="false" @before-enter="onBeforeEnter" @enter="onEnter" @leave="onLeave">
          <template v-for="(f, i) in visible" :key="f.id">
            <tr class="data-row" :class="{ open: expandedId === f.id, alt: i % 2 === 1 }"
                @click="expandedId = expandedId === f.id ? null : f.id">
              <td class="rank">{{ i + 1 }}</td>
              <td class="name">{{ f.name }}</td>
              <td class="cls"><span class="badge" :class="`tier-${f.tier}`">{{ f.tier }}</span></td>
              <td class="score">
                <div class="score-wrap">
                  <span class="score-num">{{ f.score.toFixed(0) }}</span>
                  <div class="score-track"><div class="score-bar" :style="{ width: `${f.score}%` }" /></div>
                </div>
              </td>
              <td class="alt-c">{{ deg(f.sunAlt) }}</td>
              <td class="time">{{ fmtTime(f.bestTime) }}</td>
              <td class="why muted small">{{ f.reason }}</td>
            </tr>
            <tr v-if="expandedId === f.id" :key="`${f.id}:detail`" class="detail-row">
              <td colspan="7">
                <p class="notes">
                  {{ f.type ?? 'phase-based feature, no fixed place' }}<template v-if="f.lat != null"> · {{ fmtCoords(f.lat, f.lon) }}</template><template v-if="f.ageDays"> · AL group ~{{ f.ageDays }} days old</template>
                </p>
                <p class="muted small">Moon {{ deg(f.moonAlt) }} up at its best time</p>
              </td>
            </tr>
          </template>
        </TransitionGroup>
      </table>
      <div v-if="shown.length > LIMIT" class="targets-foot">
        <button class="show-more" @click="showAll = !showAll">
          {{ showAll ? `show top ${LIMIT}` : `show all ${shown.length} features` }}
        </button>
      </div>
    </div>
  </section>
</template>
