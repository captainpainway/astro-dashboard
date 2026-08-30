<script setup>
import { computed, ref } from 'vue'
import { compass, fmtDec, fmtRa, fmtTime, isDisplayable } from '../format'

const props = defineProps({
  targets: { type: Array, required: true },
  night: { type: Object, default: null },
  loading: { type: Boolean, default: false },
})

const expandedId = ref(null)

const sorted = computed(() =>
  [...props.targets]
    .filter(isDisplayable)
    .sort((a, b) => b.score - a.score))

function fmtMagRange(star) {
  if (star.maxMag == null || star.minMag == null) return '—'
  return `${star.maxMag}–${star.minMag} ${star.magBand ?? ''}`.trim()
}
</script>

<template>
  <section class="discover">
    <div v-if="loading && !targets.length" class="muted">loading discovered stars…</div>
    <div v-else-if="!targets.length" class="muted">no under-observed stars found</div>

    <table v-else class="targets">
      <thead>
        <tr>
          <th /> <th>star</th> <th>type</th> <th>con</th> <th>mag range</th> <th>period</th>
          <th>score</th> <th>alt</th> <th>az</th> <th>dir</th> <th>best time</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="(t, i) in sorted" :key="t.star.auid ?? t.star.name">
          <tr class="data-row" :class="{ open: expandedId === t.star.auid }"
              @click="expandedId = expandedId === t.star.auid ? null : t.star.auid">
            <td class="rank">{{ i + 1 }}</td>
            <td class="name">{{ t.star.name }}</td>
            <td><span class="badge">{{ t.star.varType ?? '—' }}</span></td>
            <td>{{ t.star.constellation ?? '—' }}</td>
            <td>{{ fmtMagRange(t.star) }}</td>
            <td>{{ t.star.periodDays != null ? t.star.periodDays + ' d' : '—' }}</td>
            <td>
              <div class="score-wrap"><div class="score-bar" :style="{ width: `${t.score}%` }" />
                <span>{{ t.score?.toFixed(0) ?? '—' }}</span></div>
            </td>
            <td>{{ t.maxAlt != null ? t.maxAlt.toFixed(0) + '°' : '—' }}</td>
            <td>{{ t.azAtBest != null ? t.azAtBest.toFixed(0) + '°' : '—' }}</td>
            <td>{{ compass(t.azAtBest) }}</td>
            <td>{{ fmtTime(t.bestTime) }}</td>
          </tr>
          <tr v-if="expandedId === t.star.auid" class="detail-row">
            <td colspan="11">
              <p class="muted small">
                AUID {{ t.star.auid ?? '—' }} ·
                RA {{ fmtRa(t.star.raHours) }} · Dec {{ fmtDec(t.star.decDegrees) }} ·
                visible {{ fmtTime(t.window.start) }}–{{ fmtTime(t.window.end) }}
              </p>
              <p v-if="t.chartUrl" class="muted small">
                VSP chart: <a :href="t.chartUrl" target="_blank" rel="noopener">{{ t.chartId ?? 'chart' }}</a>
              </p>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </section>
</template>