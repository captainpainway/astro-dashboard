<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useTonight } from './composables/useTonight'
import { useForecast } from './composables/useForecast'
import { useLunar } from './composables/useLunar'
import { useOutlook } from './composables/useOutlook'
import { useSkyView } from './composables/useSkyView'
import { DEMO_LOCATION, useLocation } from './composables/useLocation'
import AppHeader from './components/AppHeader.vue'
import AppDock from './components/AppDock.vue'
import WeatherPanel from './components/WeatherPanel.vue'
import ErrorsBanner from './components/ErrorsBanner.vue'
import ControlsBar from './components/ControlsBar.vue'
import TargetTable from './components/TargetTable.vue'
import ForecastView from './components/ForecastView.vue'
import LunarView from './components/LunarView.vue'
import OverviewView from './components/OverviewView.vue'
import OutlookView from './components/OutlookView.vue'
import SkyPage from './components/SkyPage.vue'
import NightTimes from './components/NightTimes.vue'
import { clearWeatherCache } from './api'
import { bestDarkHour } from './engine/forecast'
import LocationPicker from './components/LocationPicker.vue'
import { isDisplayable } from './format'

const { location, error: locationError, resolving, setCoordinates, locateMe, reset } = useLocation()
const isDemo = computed(() => location.value === DEMO_LOCATION)
const pickerOpen = ref(false)
const { data, loading, error, load } = useTonight(location)
const forecast = useForecast(location)
const lunar = useLunar(location)
const outlook = useOutlook(location)
const sky = useSkyView() // the sky's time, direction and zoom, shared by the home tile and the sky page
const skyBestHour = computed(() => bestDarkHour(forecast.data.value?.hours ?? [])?.time ?? null)

const view = ref('home') // 'home' | 'sky' | 'tonight' | 'forecast' | 'outlook' | 'lunar'

// Crossfade between pages where the View Transitions API is available (see style.css for why it's not a slide).
function setView(v) {
  if (v === view.value) return
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    view.value = v
    return
  }
  document.startViewTransition(async () => {
    view.value = v
    await nextTick() // DOM must reflect the new view before the "new" snapshot
  })
}

watch(view, (v) => {
  if (v === 'forecast' && !forecast.loaded.value && !forecast.loading.value) forecast.load()
  if (v === 'outlook' && !outlook.loaded.value && !outlook.loading.value) outlook.load()
  if (v === 'lunar' && !lunar.loaded.value && !lunar.loading.value) lunar.load()
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
// A target to open in the tonight list (from the sky page): its row is expanded and scrolled to, then this clears.
const focusId = ref(null)
function openInTonight({ id, instrument: ins }) {
  instrument.value = ins
  focusId.value = id
  setView('tonight')
}
// And the other way: a Tonight row's target to pick and turn to on the sky page.
const skyFocusId = ref(null)
function openInSky(id) {
  skyFocusId.value = id
  setView('sky')
}
const instrumentLabels = {
  dob_8inch: '8" Dobsonian',
  dwarf_mini: 'Dwarf Mini',
}

/** Reload everything on screen: tonight, forecast, lunar, and the outlook once it has been opened. */
function reloadAll() {
  return Promise.all([
    load(requestParams.value),
    forecast.load(),
    lunar.load(),
    outlook.loaded.value ? outlook.load() : null, // the 12-hour forecast is only fetched once the outlook was opened
  ])
}
/** Refresh button: drop cached weather (and the browser's copy), then reload. */
async function refresh() {
  clearWeatherCache(true)
  await reloadAll()
}
const dockLoading = computed(() =>
  loading.value || forecast.loading.value || outlook.loading.value || lunar.loading.value)
onMounted(reloadAll)
watch(requestParams, () => load(requestParams.value))
// A new place means new NWS URLs; clearing restarts the "Generated @" stamp.
watch(location, () => { pickerOpen.value = false; clearWeatherCache(); reloadAll() })
</script>

<template>
  <div class="shell">
  <AppDock :model-value="view" @update:model-value="setView" :loading="dockLoading" @refresh="refresh" />
  <main class="page" :class="{ 'page-wide': view === 'home', 'page-full': view === 'sky' }">

    <template v-if="view === 'home'">
      <AppHeader :night="null" :at-local="null" :location="location"
                 :generated-at="data?.generatedAt ?? ''" @change-location="pickerOpen = !pickerOpen" />
      <LocationPicker v-if="pickerOpen" :location="location" :is-demo="isDemo" :error="locationError" :resolving="resolving"
                      @set="setCoordinates" @locate="locateMe" @reset="reset" />
      <p v-if="error" class="error">failed to load: {{ error }}</p>
      <p v-if="forecast.error.value" class="error">hourly failed: {{ forecast.error.value }}</p>
      <p v-if="lunar.error.value" class="error">lunar failed: {{ lunar.error.value }}</p>
      <OverviewView :sky="sky" :location="location" :tonight="data" :forecast="forecast.data.value" :lunar="lunar.data.value"
                   :twilight="data?.twilight ?? forecast.data.value?.twilight ?? null"
                   :tonight-loading="loading" :forecast-loading="forecast.loading.value"
                   :lunar-loading="lunar.loading.value" @expand="setView('sky')" @details="openInTonight" />
    </template>

    <template v-else-if="view === 'sky'">
      <AppHeader :night="null" :at-local="null" :location="location"
                 :generated-at="data?.generatedAt ?? ''" @change-location="pickerOpen = !pickerOpen" />
      <LocationPicker v-if="pickerOpen" :location="location" :is-demo="isDemo" :error="locationError" :resolving="resolving"
                      @set="setCoordinates" @locate="locateMe" @reset="reset" />
      <SkyPage :sky="sky" :location="location" :tonight="data" :best-hour="skyBestHour" :loading="loading" :error="error"
               :focus-id="skyFocusId" @focused="skyFocusId = null" @details="openInTonight" />
    </template>

    <template v-else-if="view === 'tonight'">
    <AppHeader :night="night" :at-local="atLocal" :generated-at="data?.generatedAt ?? ''" />
    <p v-if="error" class="error">failed to load: {{ error }}</p>
    <ErrorsBanner v-if="data" :errors="data.errors" />
    <ControlsBar v-if="data" v-model:mode="mode" v-model:at-time="atTime"
                 v-model:active-classes="activeClasses" v-model:sort-key="sortKey"
                 :twilight="data.twilight ?? null" />
    <div class="panel">
        <NightTimes v-if="data?.twilight" :twilight="data.twilight" compact />
    </div>
    <nav v-if="data && instruments.length > 1" class="tabs">
      <button v-for="ins in instruments" :key="ins" :class="{ active: ins === activeInstrument }"
              @click="instrument = ins">
        {{ instrumentLabels[ins] ?? ins }}
        ({{ visibleCount(ins) }})
      </button>
    </nav>
    <TargetTable v-if="activeTargets.length" :targets="activeTargets" :night="night" :location="data.location"
                 :sort-key="sortKey" :focus-id="focusId" @focused="focusId = null" @sky="openInSky" />
    <p v-else-if="data && !loading" class="muted">no targets match the current filters</p>
    <p v-if="loading && !data" class="muted">loading tonight's plan…</p>
    </template>

    <template v-else-if="view === 'outlook'">
      <AppHeader :night="null" :at-local="null"
                 :generated-at="outlook.data.value?.generatedAt ?? ''" />
      <p v-if="outlook.error.value" class="error">forecast failed: {{ outlook.error.value }}</p>
      <ErrorsBanner v-if="outlook.data.value" :errors="outlook.data.value.errors" />
      <OutlookView :nights="outlook.data.value?.nights ?? []"
                   :loading="outlook.loading.value" />
    </template>

    <template v-else-if="view === 'lunar'">
      <AppHeader :night="lunar.data.value?.night ?? null" :at-local="null"
                 :generated-at="lunar.data.value?.generatedAt ?? ''" />
      <p v-if="lunar.error.value" class="error">failed to load: {{ lunar.error.value }}</p>
      <LunarView :features="lunar.data.value?.features ?? []" :moon="lunar.data.value?.moon ?? null" :location="location"
                 :night="lunar.data.value?.night ?? null" :loading="lunar.loading.value" />
    </template>

    <template v-else>
      <AppHeader :night="forecast.data.value?.night ?? null" :at-local="null"
                 :generated-at="forecast.data.value?.generatedAt ?? ''" />
      <p v-if="forecast.error.value" class="error">failed to load: {{ forecast.error.value }}</p>
      <ErrorsBanner v-if="forecast.data.value" :errors="forecast.data.value.errors" />
      <ForecastView :hours="forecast.data.value?.hours ?? []"
                    :night="forecast.data.value?.night ?? null"
                    :twilight="forecast.data.value?.twilight ?? null"
                    :loading="forecast.loading.value" />
    </template>
  </main>
  </div>
</template>
