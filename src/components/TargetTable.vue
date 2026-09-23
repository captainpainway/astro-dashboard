<script setup>
import { computed, ref } from 'vue'
import { compass, fmtTime, isDisplayable, pct, timeline } from '../format'

const props = defineProps({
  targets: { type: Array, required: true },
  night: { type: Object, default: null },
  sortKey: { type: String, default: 'score' },
})

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

function moonClass(mi) {
  if (mi === null || mi === undefined) return 'moon-none'
  if (mi < 0.2) return 'moon-low'
  if (mi < 0.5) return 'moon-mid'
  return 'moon-high'
}
</script>

<template>
  <div class="targets-panel panel">
  <table class="targets">
    <thead>
      <tr>
        <th /> <th>target</th> <th>class</th> <th>score</th> <th>alt</th>
        <th>az</th> <th>best time</th>
        <th title="Moon interference: <20% low, 20–50% moderate, ≥50% high">moon</th>
      </tr>
    </thead>
    <tbody>
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
        <tr v-if="expandedId === t.id" class="detail-row">
          <td colspan="8">
            <p v-if="t.notes" class="notes">{{ t.notes }}</p>
            <p class="muted small">
              visible {{ fmtTime(t.window.start) }}–{{ fmtTime(t.window.end) }},
              max altitude {{ t.maxAlt != null ? t.maxAlt.toFixed(0) + '°' : '—' }}
            </p>
            <div v-if="night" class="mini-timeline">
              <span class="muted small">{{ fmtTime(night.startLocal) }}</span>
              <div class="tl-track">
                <div class="tl-bar"
                     :style="{ left: `${timeline(night, t).leftPct}%`,
                                width: `${timeline(night, t).widthPct}%` }" />
                <span class="tl-star"
                      :style="{ left: `${timeline(night, t).starPct}%` }">★</span>
              </div>
              <span class="muted small">{{ fmtTime(night.endLocal) }}</span>
            </div>
          </td>
        </tr>
      </template>
    </tbody>
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
