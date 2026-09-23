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

// Stroke-only 24×24 icon paths.
const ITEMS = [
  { key: 'home', d: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10' },
  { key: 'tonight', d: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' },
  { key: 'forecast', d: 'M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.25 4.25 0 0 0 7 18z' },
  { key: 'outlook', d: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { key: 'discover', d: 'M12 3l2.2 6.8H21l-5.5 4 2.1 6.7L12 16.4l-5.6 4.1 2.1-6.7L3 9.8h6.8z' },
]
const REFRESH = 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7'
</script>

<template>
  <nav class="view-switch dock" aria-label="pages">
    <div class="dock-items">
      <button v-for="it in ITEMS" :key="it.key" class="dock-item"
              :class="{ active: modelValue === it.key }"
              :aria-current="modelValue === it.key ? 'page' : undefined"
              @click="emit('update:modelValue', it.key)">
        <svg class="dock-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="it.d" /></svg>
        <span class="dock-label">{{ it.key }}</span>
      </button>
    </div>
    <button class="refresh dock-item" :class="{ spinning: loading }" :disabled="loading"
            :title="loading ? 'loading…' : 'refresh'" @click="emit('refresh')">
      <svg class="dock-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="REFRESH" /></svg>
      <span class="dock-label">{{ loading ? 'loading' : 'refresh' }}</span>
    </button>
  </nav>
</template>
