<script setup>
import { computed, ref } from 'vue'
import { compass, fmtTime, pct, timeline } from '../format'

const props = defineProps({
  targets: { type: Array, required: true },
  night: { type: Object, default: null },
  sortKey: { type: String, default: 'score' },
})

const expandedId = ref(null)

const sorted = computed(() => {
  const t = [...props.targets]
  switch (props.sortKey) {
    case 'bestTime': return t.sort((a, b) => new Date(a.bestTime) - new Date(b.bestTime))
    case 'maxAlt': return t.sort((a, b) => b.maxAlt - a.maxAlt)
    case 'name': return t.sort((a, b) => a.name.localeCompare(b.name))
    default: return t.sort((a, b) => b.score - a.score)
  }
})

function moonClass(mi) {
  if (mi === null || mi === undefined) return 'moon-none'
  if (mi < 0.2) return 'moon-low'
  if (mi < 0.5) return 'moon-mid'
  return 'moon-high'
}
</script>

<template>
  <table class="targets">
    <thead>
      <tr>
        <th /> <th>target</th> <th>class</th> <th>score</th> <th>alt</th>
        <th>az</th> <th>best time</th> <th>moon</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="(t, i) in sorted" :key="t.id">
        <tr class="data-row" :class="{ open: expandedId === t.id }"
            @click="expandedId = expandedId === t.id ? null : t.id">
          <td class="rank">{{ i + 1 }}</td>
          <td class="name">{{ t.name }}</td>
          <td><span class="badge" :class="`cls-${t.targetClass}`">{{ t.targetClass }}</span></td>
          <td>
            <div class="score-wrap"><div class="score-bar" :style="{ width: `${t.score}%` }" />
              <span>{{ t.score?.toFixed(0) ?? '—' }}</span></div>
          </td>
          <td>{{ t.altAtBest != null ? t.altAtBest.toFixed(0) + '°' : '—' }}</td>
          <td>{{ compass(t.azAtBest) }}</td>
          <td>{{ fmtTime(t.bestTime) }}</td>
          <td :class="moonClass(t.moonInterference)">{{ pct(t.moonInterference) }}</td>
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
</template>