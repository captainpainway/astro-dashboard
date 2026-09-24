<script setup>
/**
 * Sunset/sunrise + twilight boundaries for one night.
 *
 * Two presentations of the same data:
 *  - a labelled list (exact times), and
 *  - a proportional twilight bar, where each phase is as wide as it lasts.
 * The bar is what makes "how much darkness do I actually get" readable at a
 * glance; the list is what you copy times from.
 *
 * `compact` drops the heading and the deep-twilight rows — used inside the
 * multi-night outlook, where 8 rows × 7 nights would bury the actual forecast.
 */
import { computed } from 'vue'
import { fmtTime, fmtDuration } from '../format'

const props = defineProps({
  twilight: { type: Object, default: null },
  // Optional label override, e.g. "Tonight" in the outlook rows.
  title: { type: String, default: 'night times' },
  // Inline variant for list rows (outlook): heading + deep rows dropped.
  compact: { type: Boolean, default: false },
})

const hasAny = computed(() => {
  const t = props.twilight
  return !!t && !!(t.sunset || t.sunrise || t.astroDusk || t.astroDawn)
})

const rows = computed(() => {
  const t = props.twilight ?? {}
  return [
    { key: 'sunset', label: 'sunset', time: t.sunset },
    { key: 'civilDusk', label: 'civil dusk', time: t.civilDusk },
    { key: 'nauticalDusk', label: 'nautical dusk', time: t.nauticalDusk },
    { key: 'astroDusk', label: 'full dark', time: t.astroDusk, dark: true, primary: true },
    { key: 'astroDawn', label: 'dark ends', time: t.astroDawn, dark: true, primary: true },
    { key: 'nauticalDawn', label: 'nautical dawn', time: t.nauticalDawn },
    { key: 'civilDawn', label: 'civil dawn', time: t.civilDawn },
    { key: 'sunrise', label: 'sunrise', time: t.sunrise },
  ]
})

/** Only the boundaries that actually occur (polar nights drop several). */
const present = computed(() => rows.value.filter((r) => r.time))
const shown = computed(() => (props.compact ? present.value.filter((r) => r.primary) : present.value))

const darkSpan = computed(() => fmtDuration(props.twilight?.astroDusk, props.twilight?.astroDawn))
const nightSpan = computed(() => fmtDuration(props.twilight?.sunset, props.twilight?.sunrise))

/**
 * Twilight bar segments, each sized by its real duration between the first and
 * last boundary present. Phases with no data (polar sites) simply drop out.
 */
const segments = computed(() => {
  const t = props.twilight
  if (!t) return []
  const order = ['sunset', 'civilDusk', 'nauticalDusk', 'astroDusk',
                 'astroDawn', 'nauticalDawn', 'civilDawn', 'sunrise']
  const times = order.filter((k) => t[k])
  if (times.length < 2) return []

  const start = new Date(t[times[0]]).getTime()
  const span = new Date(t[times[times.length - 1]]).getTime() - start
  if (!(span > 0)) return []

  const phases = [
    ['sunset', 'civilDusk', 'tw-civil'],
    ['civilDusk', 'nauticalDusk', 'tw-nautical'],
    ['nauticalDusk', 'astroDusk', 'tw-astro'],
    ['astroDusk', 'astroDawn', 'tw-dark'],
    ['astroDawn', 'nauticalDawn', 'tw-astro'],
    ['nauticalDawn', 'civilDawn', 'tw-nautical'],
    ['civilDawn', 'sunrise', 'tw-civil'],
  ].filter(([from, to]) => t[from] && t[to])

  return phases.map(([from, to, cls]) => {
    const left = (new Date(t[from]).getTime() - start) / span
    const width = (new Date(t[to]).getTime() - new Date(t[from]).getTime()) / span
    return { cls, left: `${left * 100}%`, width: `${width * 100}%` }
  })
})

const firstMark = computed(() => (present.value[0]?.time ?? null))
const lastMark = computed(() => (present.value[present.value.length - 1]?.time ?? null))
</script>

<template>
  <div class="tw-card" :class="{ compact, panel: !compact }">
    <h2 v-if="!compact">{{ title }}</h2>

    <p v-if="!hasAny" class="muted small">no sun or twilight times for this night</p>

    <template v-else>
      <p v-if="twilight.midnightSun" class="muted small">midnight sun — the Sun stays up all night</p>
      <p v-else-if="twilight.polarNight" class="muted small">polar night — the Sun never rises</p>

      <div v-if="segments.length" class="tw-bar" role="img"
           :aria-label="`Twilight phases from ${fmtTime(firstMark)} to ${fmtTime(lastMark)}`">
        <span v-for="(s, i) in segments" :key="i" class="tw-seg" :class="s.cls"
              :style="{ left: s.left, width: s.width }" />
      </div>

      <dl class="tw-times">
        <div v-for="r in shown" :key="r.key" :class="[`tw-row-${r.key}`, { 'tw-dark-row': r.dark }]">
          <dt>{{ r.label }}</dt>
          <dd>{{ fmtTime(r.time) }}</dd>
        </div>
      </dl>

      <p v-if="nightSpan && darkSpan" class="muted small tw-summary">
        {{ nightSpan }} sunset → sunrise · {{ darkSpan }} fully dark
      </p>
      <p v-else-if="compact && darkSpan" class="muted small tw-summary">
        {{ darkSpan }} fully dark
      </p>
    </template>
  </div>
</template>
