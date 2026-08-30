<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useTonight } from './composables/useTonight'
import { useForecast } from './composables/useForecast'
import AppHeader from './components/AppHeader.vue'
import WeatherPanel from './components/WeatherPanel.vue'
import ErrorsBanner from './components/ErrorsBanner.vue'
import ControlsBar from './components/ControlsBar.vue'
import TargetTable from './components/TargetTable.vue'
import ForecastView from './components/ForecastView.vue'
import { isDisplayable } from './format'

const { data, loading, error, load } = useTonight()
const forecast = useForecast()

const view = ref('tonight') // 'tonight' | 'forecast'
watch(view, (v) => { if (v === 'forecast' && !forecast.loaded.value && !forecast.loading.value) forecast.load() })

const mode = ref('window') // 'window' | 'instant'
const atTime = ref('22:30')
const sortKey = ref('score')
const ALL_CLASSES = ['planet', 'moon', 'variable', 'messier', 'nebula', 'cluster']
const activeClasses = ref([...ALL_CLASSES])

const requestParams = computed(() => ({
  at: mode.value === 'instant' ? atTime.value : null,
  include: activeClasses.value.length < ALL_CLASSES.length ? activeClasses.value : null,
}))
const night = computed(() => data.value?.mode === 'window' ? data.value.night : null)
const atLocal = computed(() => data.value?.mode === 'instant' ? data.value.at?.local : null)

const instrument = ref(null) // first key once data loads
const instruments = computed(() => Object.keys(data.value?.instruments ?? {}))
const activeInstrument = computed(() =>
  instrument.value && instruments.value.includes(instrument.value)
    ? instrument.value
    : instruments.value[0])
const activeTargets = computed(() => data.value?.instruments?.[activeInstrument.value] ?? [])
const visibleCount = (ins) => (data.value?.instruments?.[ins] ?? []).filter(isDisplayable).length
const instrumentLabels = {
  dob_8inch: '8" Dobsonian',
  dwarf_mini: 'Dwarf Mini',
}

async function refresh() {
  if (view.value === 'forecast') await forecast.load()
  else await load(requestParams.value)
}
onMounted(refresh)
watch(requestParams, refresh)
</script>

<template>
  <main class="page">
    <nav class="view-switch">
      <button :class="{ active: view === 'tonight' }" @click="view = 'tonight'">tonight</button>
      <button :class="{ active: view === 'forecast' }" @click="view = 'forecast'">forecast</button>
    </nav>

    <template v-if="view === 'tonight'">
    <AppHeader :night="night" :at-local="atLocal" :generated-at="data?.generatedAt ?? ''"
               :loading="loading" @refresh="refresh" />
    <p v-if="error" class="error">failed to load: {{ error }}</p>
    <ErrorsBanner v-if="data" :errors="data.errors" />
    <ControlsBar v-if="data" v-model:mode="mode" v-model:at-time="atTime"
                 v-model:active-classes="activeClasses" v-model:sort-key="sortKey" />
    <WeatherPanel v-if="data" :weather="data.weather" :mode="data.mode" />
    <nav v-if="data && instruments.length > 1" class="tabs">
      <button v-for="ins in instruments" :key="ins" :class="{ active: ins === activeInstrument }"
              @click="instrument = ins">
        {{ instrumentLabels[ins] ?? ins }}
        ({{ visibleCount(ins) }})
      </button>
    </nav>
    <TargetTable v-if="activeTargets.length" :targets="activeTargets" :night="night" :sort-key="sortKey" />
    <p v-else-if="data && !loading" class="muted">no targets match the current filters</p>
    <p v-if="loading && !data" class="muted">loading tonight's plan…</p>
    </template>

    <template v-else>
      <AppHeader :night="forecast.data.value?.night ?? null" :at-local="null"
                 :generated-at="forecast.data.value?.generatedAt ?? ''"
                 :loading="forecast.loading.value" @refresh="refresh" />
      <p v-if="forecast.error.value" class="error">failed to load: {{ forecast.error.value }}</p>
      <ErrorsBanner v-if="forecast.data.value" :errors="forecast.data.value.errors" />
      <ForecastView :hours="forecast.data.value?.hours ?? []"
                    :night="forecast.data.value?.night ?? null"
                    :loading="forecast.loading.value" />
    </template>
  </main>
</template>