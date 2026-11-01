<script setup>
import { fmtDate, fmtTime, fmtDateTime, fmtLocation } from '../format'

const day = (iso) => iso.slice(0, 10) // site-local date of an ISO stamp
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
          {{ fmtDate(day(night.startLocal)) }} · {{ fmtTime(night.startLocal) }} –
          <template v-if="day(night.endLocal) !== day(night.startLocal)">{{ fmtDate(day(night.endLocal)) }} · </template>{{ fmtTime(night.endLocal) }}
        </p>
      </div>
      <!-- Until the weather is in, an invisible stand-in as wide as the real line: it wraps (or not) the same way, so
           nothing below moves when the time arrives -->
      <p class="muted small generated" :class="{ pending: !generatedAt }">
        Generated @ {{ generatedAt ? fmtDateTime(generatedAt) : 'Sep 30, 12:00 PM' }}
      </p>
    </div>
  </header>
</template>
