<script setup>
import { ref } from 'vue'
import { fmtLocation } from '../format'
import { searchPlaces } from '../engine/geocode'

defineProps({
  location: { type: Object, required: true },
  isDemo: { type: Boolean, default: false },
  error: { type: String, default: null },
  resolving: { type: Boolean, default: false },
})
const emit = defineEmits(['set', 'locate', 'reset'])

const query = ref('')
const results = ref([])
const searched = ref(false)
const searching = ref(false)
const searchError = ref('')
const coordsText = ref('')
const coordsError = ref('')

async function search() {
  searching.value = true
  searchError.value = ''
  try {
    results.value = await searchPlaces(query.value)
    searched.value = true
  } catch (e) {
    results.value = []
    searched.value = false
    searchError.value = e.message
  } finally {
    searching.value = false
  }
}

const COORDS = /^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/
function setCoords() {
  const m = COORDS.exec(coordsText.value)
  coordsError.value = m ? '' : 'Enter latitude and longitude like 29.33, -103.21'
  if (m) emit('set', Number(m[1]), Number(m[2]))
}
</script>

<template>
  <section class="location-picker panel">
    <h2>observing location</h2>
    <p class="muted small">{{ fmtLocation(location) }}<template v-if="isDemo"> · demo location</template></p>

    <form class="lp-row lp-search" @submit.prevent="search">
      <input v-model="query" type="search" placeholder="city or ZIP code (US)" aria-label="city or ZIP code">
      <button class="show-more" :disabled="resolving || searching">search</button>
    </form>
    <p v-if="searchError" class="lp-search-error error">{{ searchError }}</p>
    <ul v-if="results.length" class="lp-results">
      <li v-for="r in results" :key="r.id">
        <button class="show-more" :disabled="resolving" @click="emit('set', r.latitude, r.longitude)">{{ r.name }}, {{ r.state }}</button>
      </li>
    </ul>
    <p v-else-if="searched && !searching" class="muted small">no US places found</p>

    <div class="lp-row">
      <button class="show-more lp-locate" :disabled="resolving" @click="emit('locate')">use my location</button>
      <button v-if="!isDemo" class="show-more lp-reset" :disabled="resolving" @click="emit('reset')">reset to demo</button>
    </div>

    <form class="lp-row lp-coords" @submit.prevent="setCoords">
      <input v-model="coordsText" placeholder="latitude, longitude  e.g. 29.33, -103.21" aria-label="latitude and longitude">
      <button class="show-more" :disabled="resolving">set</button>
    </form>
    <p v-if="coordsError" class="lp-coords-error error">{{ coordsError }}</p>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p class="lp-privacy muted small">
      Saved in this browser, rounded to about 1 km. City search sends what you type to open-meteo.com;
      weather comes straight from weather.gov.
    </p>
  </section>
</template>
