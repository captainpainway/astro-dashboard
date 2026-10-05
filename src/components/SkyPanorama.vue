<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { camera, fieldOfView, skyAt, terrainSeed } from '../engine/sky'
import SkyCanvas from './SkyCanvas.vue'

const props = defineProps({ location: { type: Object, required: true } })
const emit = defineEmits(['failed'])

const stage = ref(null)
const size = reactive({ width: 1000, height: 385 }) // jsdom has no layout; the ResizeObserver takes over in browsers
const view = reactive({ yaw: 180, pitch: 25 })
const frame = computed(() => skyAt(props.location, new Date()))
const cam = computed(() => camera({ ...view, hfov: fieldOfView(size.width), width: size.width, height: size.height }))
const seed = computed(() => terrainSeed(props.location))

let observer = null
onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(([e]) => {
    if (e.contentRect.width > 0) { size.width = e.contentRect.width; size.height = e.contentRect.height }
  })
  observer.observe(stage.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <section class="panel sky-tile" :aria-label="`Sky over ${location.name} tonight`">
    <div ref="stage" class="sky-stage">
      <SkyCanvas :frame="frame" :cam="cam" :seed="seed" @failed="emit('failed')" />
    </div>
  </section>
</template>
