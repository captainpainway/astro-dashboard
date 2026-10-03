<script setup>
import { computed, ref } from 'vue'
import { fmtTime, lunarEmpty } from '../format'

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
const tierLabel = computed(() => TIERS.find((t) => t.key === tier.value).label)
const deg = (x) => (x == null ? '—' : `${x.toFixed(0)}°`)
</script>

<template>
  <section class="lunar">
    <p v-if="moon" class="muted small">{{ moon.note }}</p>
    <nav class="tabs" aria-label="instrument tier">
      <button v-for="t in TIERS" :key="t.key" :class="{ active: tier === t.key }" @click="tier = t.key">
        {{ t.label }} ({{ count(t.key) }})
      </button>
    </nav>
    <p v-if="loading && !features.length" class="muted">loading lunar features…</p>
    <p v-else-if="!features.length" class="muted">{{ lunarEmpty(moon) }}</p>
    <p v-else-if="!shown.length" class="muted">no {{ tierLabel }} features are well placed tonight</p>
    <table v-else class="targets">
      <thead>
        <tr><th /><th>feature</th><th>tier</th><th>type</th><th>score</th><th>Sun</th><th>best time</th><th>why</th></tr>
      </thead>
      <tbody>
        <tr v-for="(f, i) in shown" :key="f.id" class="data-row">
          <td class="rank">{{ i + 1 }}</td>
          <td class="name">{{ f.name }}</td>
          <td><span class="badge">{{ f.tier }}</span></td>
          <td>{{ f.type ?? '—' }}</td>
          <td><div class="score-wrap"><div class="score-bar" :style="{ width: `${f.score}%` }" /><span>{{ f.score.toFixed(0) }}</span></div></td>
          <td>{{ deg(f.sunAlt) }}</td>
          <td>{{ fmtTime(f.bestTime) }}</td>
          <td class="muted small">{{ f.reason }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
