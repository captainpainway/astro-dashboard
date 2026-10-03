<script setup>
import { fmtTime, fmtDateTime, fmtLocation } from '../format'

const emit = defineEmits(['change-location'])
defineProps({
  night: { type: Object, default: null },
  atLocal: { type: String, default: null },
  location: { type: Object, default: null },
  generatedAt: { type: String, required: true },
})
</script>

<template>
  <header class="app-header">
    <div class="header-row">
      <div>
        <h1>Astronomer's Dashboard</h1>
        <p v-if="location" class="muted location">
          {{ fmtLocation(location) }}
          <button class="show-more location-change" @click="emit('change-location')">change</button>
        </p>
        <p v-if="atLocal" class="muted">Sky at {{ fmtTime(atLocal) }}</p>
        <p v-else-if="night" class="muted">
          observing window {{ fmtTime(night.startLocal) }} – {{ fmtTime(night.endLocal) }}
        </p>
      </div>
      <p v-if="generatedAt" class="muted small generated">
        Generated @ {{ fmtDateTime(generatedAt) }}
      </p>
    </div>
  </header>
</template>
