<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { wikiSummary } from '../engine/targetInfo'

/** A Wikipedia article's summary and photo, fetched when shown; renders nothing without a title or an article. */
const props = defineProps({ title: { type: String, default: null } })

const wiki = ref(null)
let alive = true
onMounted(() => {
  if (props.title) wikiSummary(props.title).then((s) => { if (alive) wiki.value = s })
})
onUnmounted(() => { alive = false })
</script>

<template>
  <div v-if="wiki" class="td-wiki">
    <img v-if="wiki.thumbnail" :src="wiki.thumbnail" :alt="wiki.title" class="td-thumb" loading="lazy">
    <p class="td-extract">{{ wiki.extract }}</p>
    <p class="td-more small muted">more on <a :href="wiki.url" target="_blank" rel="noopener">Wikipedia</a></p>
  </div>
</template>
