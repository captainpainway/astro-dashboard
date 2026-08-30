<script setup>
import { fmtTime } from '../format'

defineProps({
  night: { type: Object, default: null },
  atLocal: { type: String, default: null },
  generatedAt: { type: String, required: true },
  loading: { type: Boolean, default: false },
})
defineEmits(['refresh'])
</script>

<template>
  <header class="app-header">
    <div class="header-row">
      <h1>astro dashboard</h1>
      <button class="refresh" :disabled="loading" @click="$emit('refresh')">
        {{ loading ? 'loading…' : 'refresh' }}
      </button>
    </div>
    <p v-if="atLocal" class="muted">Sky at {{ fmtTime(atLocal) }}</p>
    <p v-else-if="night" class="muted">
      {{ fmtTime(night.startLocal) }} – {{ fmtTime(night.endLocal) }} ({{ night.timezone }})
    </p>
    <p v-if="generatedAt" class="muted small">generated {{ new Date(generatedAt).toLocaleTimeString('en-US') }}</p>
  </header>
</template>