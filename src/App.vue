<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useTonight } from './composables/useTonight'
import AppHeader from './components/AppHeader.vue'
import WeatherPanel from './components/WeatherPanel.vue'
import ErrorsBanner from './components/ErrorsBanner.vue'

const { data, loading, error, load } = useTonight()

const mode = ref('window') // 'window' | 'instant'
const atTime = ref('22:30')
const sortKey = ref('score')

const requestParams = computed(() => ({
  at: mode.value === 'instant' ? atTime.value : null,
  include: null, // wired in Task 5
}))
const night = computed(() => data.value?.mode === 'window' ? data.value.night : null)
const atLocal = computed(() => data.value?.mode === 'instant' ? data.value.at?.local : null)

async function refresh() { await load(requestParams.value) }
onMounted(refresh)
watch(requestParams, refresh)
</script>

<template>
  <main class="page">
    <AppHeader :night="night" :at-local="atLocal" :generated-at="data?.generatedAt ?? ''"
               :loading="loading" @refresh="refresh" />
    <p v-if="error" class="error">failed to load: {{ error }}</p>
    <ErrorsBanner v-if="data" :errors="data.errors" />
    <WeatherPanel v-if="data" :weather="data.weather" :mode="data.mode" />
    <p v-if="loading && !data" class="muted">loading tonight's plan…</p>
  </main>
</template>