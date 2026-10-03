<script>
// Stroke-only 24×24 icon paths. `key` is the view id; `label` is what the dock shows.
export const ITEMS = [
  { key: 'home', label: 'home', d: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10' },
  { key: 'tonight', label: 'tonight', d: 'M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0zM21.52 7.56A10.5 3 -25 0 1 2.48 16.44M2.48 16.44A10.5 3 -25 0 1 7.05 11.27M14.62 7.74A10.5 3 -25 0 1 21.52 7.56' },
  { key: 'forecast', label: 'hourly', d: 'M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18z' },
  { key: 'outlook', label: 'forecast', d: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { key: 'lunar', label: 'lunar', d: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' },
]
</script>

<script setup>
/**
 * Left-side navigation dock (bottom tab bar on narrow screens).
 * Icons are aria-hidden SVGs so each button's text is exactly its label.
 */
defineProps({
  modelValue: { type: String, required: true },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'refresh'])

const REFRESH = 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7'
</script>

<template>
  <nav class="view-switch dock" aria-label="pages">
    <div class="dock-items">
      <button v-for="it in ITEMS" :key="it.key" class="dock-item"
              :class="{ active: modelValue === it.key }"
              :aria-current="modelValue === it.key ? 'page' : undefined"
              @click="emit('update:modelValue', it.key)">
        <span v-if="modelValue === it.key" class="dock-indicator" aria-hidden="true" />
        <svg class="dock-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="it.d" /></svg>
        <span class="dock-label">{{ it.label }}</span>
      </button>
    </div>
    <button class="refresh dock-item" :class="{ spinning: loading }" :disabled="loading"
            :title="loading ? 'loading…' : 'refresh'" @click="emit('refresh')">
      <svg class="dock-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="REFRESH" /></svg>
      <span class="dock-label">{{ loading ? 'loading' : 'refresh' }}</span>
    </button>
  </nav>
</template>
