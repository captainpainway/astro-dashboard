<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { compass, fmtDms, fmtHours, fmtSize, fmtTime, objectTypeLabel, timeline } from '../format'
import { targetEvents, targetPosition, wikiSummary, wikiTitle } from '../engine/targetInfo'

const props = defineProps({
  target: { type: Object, required: true },
  location: { type: Object, default: null },
  night: { type: Object, default: null },
})

// Position is shown for the current moment, like Stellarium, and refreshed every minute while the row is open.
const now = ref(new Date())
let tick = null
const wiki = ref(null)
let alive = true

onMounted(() => {
  tick = setInterval(() => { now.value = new Date() }, 60_000)
  wikiSummary(wikiTitle(props.target)).then((s) => { if (alive) wiki.value = s })
})
onUnmounted(() => {
  alive = false
  clearInterval(tick)
})

const pos = computed(() => (props.location ? targetPosition(props.target, props.location, now.value) : null))
const events = computed(() => (props.location ? targetEvents(props.target, props.location) : null))
const size = computed(() => fmtSize(props.target.sizeArcmin))
// The row shows the common name where there is one, so its catalogue id leads the other names.
const aliases = computed(() => {
  const { id, name, aliases: more = [] } = props.target
  return id !== name ? [id, ...more] : more
})
const deg = (x) => `${x.toFixed(1)}°`
</script>

<template>
  <div class="target-detail">
    <p class="td-kind">
      <span class="td-type">{{ objectTypeLabel(target) }}</span>
      <template v-if="pos"> in {{ pos.constellation }}</template>
    </p>
    <p v-if="target.notes" class="notes">{{ target.notes }}</p>

    <dl class="td-facts">
      <div v-if="pos?.magnitude != null"><dt>magnitude</dt><dd>{{ pos.magnitude.toFixed(1) }}</dd></div>
      <div v-if="size"><dt>size</dt><dd>{{ size }}</dd></div>
      <div v-if="pos">
        <dt>az / alt <span class="td-now">now</span></dt>
        <dd class="mono">{{ deg(pos.az) }} {{ compass(pos.az) }} · {{ pos.alt >= 0 ? '+' : '' }}{{ deg(pos.alt) }}</dd>
      </div>
      <div v-if="pos"><dt>hour angle <span class="td-now">now</span></dt><dd class="mono">{{ fmtHours(pos.hourAngle) }}</dd></div>
      <div v-if="pos" class="td-wide"><dt>RA / Dec (J2000)</dt><dd class="mono">{{ fmtHours(pos.raJ2000) }} {{ fmtDms(pos.decJ2000) }}</dd></div>
      <div v-if="pos" class="td-wide"><dt>RA / Dec (of date)</dt><dd class="mono">{{ fmtHours(pos.ra) }} {{ fmtDms(pos.dec) }}</dd></div>
      <div v-if="events" class="td-wide">
        <dt>rise · transit · set</dt>
        <dd>
          <template v-if="events.rise || events.set">
            {{ fmtTime(events.rise) }} · {{ fmtTime(events.transit) }} · {{ fmtTime(events.set) }}
          </template>
          <template v-else>never sets · transits {{ fmtTime(events.transit) }}</template>
        </dd>
      </div>
      <div class="td-wide">
        <dt>above 15°</dt>
        <dd>{{ fmtTime(target.window.start) }}–{{ fmtTime(target.window.end) }},
          peaks at {{ target.maxAlt != null ? target.maxAlt.toFixed(0) + '°' : '—' }}</dd>
      </div>
    </dl>

    <div v-if="night" class="mini-timeline">
      <span class="muted small">{{ fmtTime(night.startLocal) }}</span>
      <div class="tl-track">
        <div class="tl-bar"
             :style="{ left: `${timeline(night, target).leftPct}%`, width: `${timeline(night, target).widthPct}%` }" />
        <span class="tl-star" role="img" aria-label="best time" :style="{ left: `${timeline(night, target).starPct}%` }" />
      </div>
      <span class="muted small">{{ fmtTime(night.endLocal) }}</span>
    </div>

    <div v-if="wiki" class="td-wiki">
      <img v-if="wiki.thumbnail" :src="wiki.thumbnail" :alt="wiki.title" class="td-thumb" loading="lazy">
      <p class="td-extract">{{ wiki.extract }}</p>
      <p class="td-more small muted">more on <a :href="wiki.url" target="_blank" rel="noopener">Wikipedia</a></p>
    </div>

    <p v-if="aliases.length" class="td-aka small">
      <span class="muted">also known as</span>
      <span v-for="a in aliases" :key="a" class="td-alias">{{ a }}</span>
    </p>
  </div>
</template>
