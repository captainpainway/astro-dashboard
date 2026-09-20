<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useTonight } from './composables/useTonight'
import { useForecast } from './composables/useForecast'
import { useDiscover } from './composables/useDiscover'
import { useOutlook } from './composables/useOutlook'
import AppHeader from './components/AppHeader.vue'
import WeatherPanel from './components/WeatherPanel.vue'
import ErrorsBanner from './components/ErrorsBanner.vue'
import ControlsBar from './components/ControlsBar.vue'
import TargetTable from './components/TargetTable.vue'
import ForecastView from './components/ForecastView.vue'
import DiscoverView from './components/DiscoverView.vue'
import OverviewView from './components/OverviewView.vue'
import OutlookView from './components/OutlookView.vue'
import NightTimes from './components/NightTimes.vue'
import { isDisplayable } from './format'

const { data, loading, error, load } = useTonight()
const forecast = useForecast()
const discover = useDiscover()
const outlook = useOutlook()

const view = ref('home') // 'home' | 'tonight' | 'forecast' | 'outlook' | 'discover'

async function loadAll() {
  await Promise.all([
    load(requestParams.value),
    forecast.load(),
    discover.load({ limit: 20 }),
  ])
}
watch(view, (v) => {
  if (v === 'forecast' && !forecast.loaded.value && !forecast.loading.value) forecast.load()
  if (v === 'outlook' && !outlook.loaded.value && !outlook.loading.value) outlook.load()
  if (v === 'discover' && !discover.loaded.value && !discover.loading.value) discover.load({ limit: 20 })
})

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
  if (view.value === 'home') await loadAll()
  else if (view.value === 'forecast') await forecast.load()
  else if (view.value === 'outlook') await outlook.load()
  else if (view.value === 'discover') await discover.load({ limit: 20 })
  else await load(requestParams.value)
}
onMounted(loadAll)
watch(requestParams, refresh)
</script>

<template>
  <main class="page">
    <nav class="view-switch">
      <button :class="{ active: view === 'home' }" @click="view = 'home'">home</button>
      <button :class="{ active: view === 'tonight' }" @click="view = 'tonight'">tonight</button>
      <button :class="{ active: view === 'forecast' }" @click="view = 'forecast'">forecast</button>
      <button :class="{ active: view === 'outlook' }" @click="view = 'outlook'">outlook</button>
      <button :class="{ active: view === 'discover' }" @click="view = 'discover'">discover</button>
    </nav>

    <template v-if="view === 'home'">
      <AppHeader :night="night" :at-local="null"
                 :generated-at="data?.generatedAt ?? ''"
                 :loading="loading || forecast.loading.value || discover.loading.value" @refresh="refresh" />
      <p v-if="error" class="error">failed to load: {{ error }}</p>
      <p v-if="forecast.error.value" class="error">forecast failed: {{ forecast.error.value }}</p>
      <p v-if="discover.error.value" class="error">discover failed: {{ discover.error.value }}</p>
      <OverviewView :tonight="data" :forecast="forecast.data.value" :discover="discover.data.value"
                   :twilight="data?.twilight ?? forecast.data.value?.twilight ?? null"
                   :tonight-loading="loading" :forecast-loading="forecast.loading.value"
                   :discover-loading="discover.loading.value" />
    </template>

    <template v-else-if="view === 'tonight'">
    <AppHeader :night="night" :at-local="atLocal" :generated-at="data?.generatedAt ?? ''"
               :loading="loading" @refresh="refresh" />
    <p v-if="error" class="error">failed to load: {{ error }}</p>
    <ErrorsBanner v-if="data" :errors="data.errors" />
    <ControlsBar v-if="data" v-model:mode="mode" v-model:at-time="atTime"
                 v-model:active-classes="activeClasses" v-model:sort-key="sortKey" />
    <NightTimes v-if="data?.twilight" :twilight="data.twilight" compact />
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

    <template v-else-if="view === 'outlook'">
      <AppHeader :night="null" :at-local="null"
                 :generated-at="outlook.data.value?.generatedAt ?? ''"
                 :loading="outlook.loading.value" @refresh="refresh" />
      <p v-if="outlook.error.value" class="error">outlook failed: {{ outlook.error.value }}</p>
      <ErrorsBanner v-if="outlook.data.value" :errors="outlook.data.value.errors" />
      <OutlookView :nights="outlook.data.value?.nights ?? []"
                   :loading="outlook.loading.value" />
    </template>

    <template v-else-if="view === 'discover'">
      <AppHeader :night="discover.data.value?.night ?? null" :at-local="null"
                 :generated-at="discover.data.value?.generatedAt ?? ''"
                 :loading="discover.loading.value" @refresh="refresh" />
      <p v-if="discover.error.value" class="error">failed to load: {{ discover.error.value }}</p>
      <ErrorsBanner v-if="discover.data.value" :errors="discover.data.value.errors" />
      <DiscoverView :targets="discover.data.value?.targets ?? []"
                    :night="discover.data.value?.night ?? null"
                    :loading="discover.loading.value" />
    </template>

    <template v-else>
      <AppHeader :night="forecast.data.value?.night ?? null" :at-local="null"
                 :generated-at="forecast.data.value?.generatedAt ?? ''"
                 :loading="forecast.loading.value" @refresh="refresh" />
      <p v-if="forecast.error.value" class="error">failed to load: {{ forecast.error.value }}</p>
      <ErrorsBanner v-if="forecast.data.value" :errors="forecast.data.value.errors" />
      <ForecastView :hours="forecast.data.value?.hours ?? []"
                    :night="forecast.data.value?.night ?? null"
                    :twilight="forecast.data.value?.twilight ?? null"
                    :loading="forecast.loading.value" />
    </template>
  </main>
</template>