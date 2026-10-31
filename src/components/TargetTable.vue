<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { compass, fmtTime, isDisplayable, pct } from '../format'
import TargetDetail from './TargetDetail.vue'
import { useRowAnimation } from '../composables/useRowAnimation'

const props = defineProps({
  targets: { type: Array, required: true },
  night: { type: Object, default: null },
  location: { type: Object, default: null },
  sortKey: { type: String, default: 'score' },
  focusId: { type: String, default: null }, // expand this target's row and scroll to it (a link from the sky page)
})
const emit = defineEmits(['focused'])

const LIMIT = 25

const expandedId = ref(null)
const showAll = ref(false)

const sorted = computed(() => {
  const t = [...props.targets].filter(isDisplayable)
  switch (props.sortKey) {
    case 'bestTime': return t.sort((a, b) => new Date(a.bestTime) - new Date(b.bestTime))
    case 'maxAlt': return t.sort((a, b) => b.maxAlt - a.maxAlt)
    case 'name': return t.sort((a, b) => a.name.localeCompare(b.name))
    default: return t.sort((a, b) => b.score - a.score)
  }
})

const visible = computed(() => showAll.value ? sorted.value : sorted.value.slice(0, LIMIT))

const table = ref(null)

watch(() => props.focusId, async (id) => {
  if (!id) return
  const at = sorted.value.findIndex((t) => t.id === id)
  if (at >= 0) {
    if (at >= LIMIT) showAll.value = true
    expandedId.value = id
    await nextTick()
    const row = [...(table.value?.querySelectorAll('tr.data-row') ?? [])][at]
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    row?.scrollIntoView?.({ block: 'center', behavior: still ? 'auto' : 'smooth' })
  }
  emit('focused')
}, { immediate: true })
const { onBeforeEnter, onEnter, onLeave } = useRowAnimation(table, visible)

function moonClass(mi) {
  if (mi === null || mi === undefined) return 'moon-none'
  if (mi < 0.2) return 'moon-low'
  if (mi < 0.5) return 'moon-mid'
  return 'moon-high'
}
</script>

<template>
  <div class="targets-panel panel">
  <table ref="table" class="targets">
    <thead>
      <tr>
        <th /> <th>target</th> <th>class</th> <th>score</th> <th>alt</th>
        <th>az</th> <th>best time</th>
        <th title="Moon interference: <20% low, 20–50% moderate, ≥50% high">moon</th>
      </tr>
    </thead>
    <TransitionGroup tag="tbody" :css="false" @before-enter="onBeforeEnter" @enter="onEnter" @leave="onLeave">
      <template v-for="(t, i) in visible" :key="t.id">
        <tr class="data-row" :class="{ open: expandedId === t.id, alt: i % 2 === 1 }"
            @click="expandedId = expandedId === t.id ? null : t.id">
          <td class="rank">{{ i + 1 }}</td>
          <td class="name">{{ t.name }}</td>
          <td class="cls"><span class="badge" :class="`cls-${t.targetClass}`">{{ t.targetClass }}</span></td>
          <td class="score">
            <div class="score-wrap">
              <span class="score-num">{{ t.score?.toFixed(0) ?? '—' }}</span>
              <div class="score-track"><div class="score-bar" :style="{ width: `${t.score}%` }" /></div>
            </div>
          </td>
          <td class="alt-c">{{ t.altAtBest != null ? t.altAtBest.toFixed(0) + '°' : '—' }}</td>
          <td class="az">
            <template v-if="t.azAtBest != null">
              <span class="dir">{{ compass(t.azAtBest) }}</span>
              <span class="deg muted">{{ t.azAtBest.toFixed(0) }}°</span>
            </template>
            <template v-else>—</template>
          </td>
          <td class="time">{{ fmtTime(t.bestTime) }}</td>
          <td class="moon" :class="moonClass(t.moonInterference)">{{ pct(t.moonInterference) }}</td>
        </tr>
        <tr v-if="expandedId === t.id" :key="`${t.id}:detail`" class="detail-row">
          <td colspan="8">
            <TargetDetail :target="t" :location="location" :night="night" />
          </td>
        </tr>
      </template>
    </TransitionGroup>
  </table>
  <div class="targets-foot">
    <button v-if="sorted.length > LIMIT" class="show-more" @click="showAll = !showAll">
      {{ showAll ? `show top ${LIMIT}` : `show all ${sorted.length} targets` }}
    </button>
    <p class="moon-legend muted small">
      moon: <span class="moon-low">●</span> &lt;20%
      <span class="moon-mid">●</span> 20–50%
      <span class="moon-high">●</span> ≥50%
    </p>
  </div>
  </div>
</template>
