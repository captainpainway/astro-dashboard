<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { fmtTime, fmtDate, weatherEmoji } from '../format'
import { ratingStyle, normalizeRating } from '../ratings'
import NightTimes from './NightTimes.vue'

const props = defineProps({
  nights: { type: Array, required: true },
  loading: { type: Boolean, default: false },
})

const bestHourOf = (night) =>
  (night.hours ?? [])
    .filter((h) => h.isDark)
    .reduce((a, b) => (b.score > (a?.score ?? -Infinity) ? b : a), null)

const rows = computed(() =>
  props.nights.map((night) => ({ night, bestHour: bestHourOf(night) })))

/**
 * Which nights are expanded. Tonight starts open; the rest collapse to
 * their summary. Re-seeded only when the set of dates
 * changes, so a refresh keeps whatever the user opened or closed.
 */
const open = ref(new Set())
let seededFor = ''
watch(() => props.nights, (nights) => {
  const key = nights.map((n) => n.date).join('|')
  if (key === seededFor) return
  seededFor = key
  open.value = new Set(nights.length ? [nights[0].date] : [])
}, { immediate: true })

function setIn(set, date, on) {
  if (set.value.has(date) === on) return
  const next = new Set(set.value)
  on ? next.add(date) : next.delete(date)
  set.value = next
}
const setOpen = (date, isOpen) => setIn(open, date, isOpen)

/** Nights mid-collapse: still [open] so the body stays rendered while it animates shut. */
const closing = ref(new Set())
const section = ref(null)
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Native <details> hides its body the instant `open` drops, so the summary
 * click is intercepted: opening flips state then grows the body; closing
 * shrinks the body first and flips state when the tween completes.
 */
async function toggleNight(date, e) {
  const wrap = e.currentTarget.parentElement.querySelector('.outlook-collapse')
  const chips = wrap.querySelectorAll('.hour-chip')
  const interrupted = gsap.isTweening(wrap)
  gsap.killTweensOf([wrap, ...chips]) // a killed tween's onComplete never fires
  const opening = !open.value.has(date) || closing.value.has(date)
  setIn(closing, date, false)

  if (reduceMotion()) {
    gsap.set([wrap, ...chips], { clearProps: 'all' })
    setOpen(date, opening)
    return
  }

  if (opening) {
    const from = interrupted ? wrap.offsetHeight : 0
    setOpen(date, true)
    await nextTick()
    gsap.fromTo(wrap, { height: from, opacity: interrupted ? gsap.getProperty(wrap, 'opacity') : 0, overflow: 'hidden' },
      { height: 'auto', opacity: 1, duration: 0.35, ease: 'power2.out', clearProps: 'height,opacity,overflow' })
    if (!interrupted) {
      gsap.from(chips, { y: 8, opacity: 0, duration: 0.3, stagger: 0.02, delay: 0.1,
        ease: 'power2.out', clearProps: 'transform,opacity' })
    }
  } else {
    setIn(closing, date, true)
    gsap.set(chips, { clearProps: 'transform,opacity' })
    gsap.to(wrap, { height: 0, opacity: 0, overflow: 'hidden', duration: 0.25, ease: 'power2.in',
      onComplete: () => {
        setOpen(date, false)
        setIn(closing, date, false)
        gsap.set(wrap, { clearProps: 'all' })
      } })
  }
}

onBeforeUnmount(() => {
  const wraps = section.value?.querySelectorAll('.outlook-collapse, .hour-chip')
  if (wraps?.length) gsap.killTweensOf(wraps)
})

const pct = (v) => (v != null ? Math.round(v) + '%' : '—')
</script>

<template>
  <section ref="section" class="outlook">
    <div v-if="loading && !nights.length" class="muted">loading outlook…</div>
    <div v-else-if="!nights.length" class="muted">no nightly outlook available</div>

    <details v-for="{ night, bestHour } in rows" :key="night.date" class="panel outlook-night"
             :open="open.has(night.date)"
             :class="{ closing: closing.has(night.date) }"
             @toggle="(e) => setOpen(night.date, e.target.open)">
      <summary class="outlook-night-head" @click.prevent="toggleNight(night.date, $event)">
        <div class="outlook-night-title">
          <h2>{{ night.label }}</h2>
          <span class="muted small">{{ fmtDate(night.date) }} · {{ fmtTime(night.start) }} – {{ fmtTime(night.end) }}</span>
          <span class="outlook-glance muted small">
            ☁️ {{ pct(night.cloudCover) }} · 🌙 {{ Math.round((night.moonIllum ?? 0) * 100) }}%<template
              v-if="night.darkHours != null"> · {{ night.darkHours }}h moonless</template>
          </span>
          <div v-if="night.hours?.length" class="outlook-strip" aria-hidden="true">
            <span v-for="h in night.hours" :key="h.time"
                  :class="[
                    `rc-${normalizeRating(h.rating)}`,
                    { best: bestHour && h.time === bestHour.time, 'not-dark': !h.isDark },
                  ]" />
          </div>
        </div>
        <div class="outlook-night-side">
          <span class="rating" :class="ratingStyle(night.rating).css">
            {{ ratingStyle(night.rating).label }} · {{ Math.round(night.score ?? 0) }}
          </span>
          <span class="outlook-chevron" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </span>
        </div>
      </summary>

      <div class="outlook-collapse">
        <div class="outlook-body">
          <dl class="outlook-stats">
            <div><dt>cloud</dt><dd>{{ pct(night.cloudCover) }}{{ night.cloudSource === 'text' ? ' ~' : '' }}</dd></div>
            <div><dt>temp</dt><dd>{{ night.tempF != null ? Math.round(night.tempF) + '°F' : '—' }}</dd></div>
            <div><dt>wind</dt><dd>{{ night.windMph != null ? `${Math.round(night.windMph)} mph ${night.windDir ?? ''}`.trim() : '—' }}</dd></div>
            <div><dt>rain</dt><dd>{{ night.precipProb != null ? night.precipProb + '%' : '—' }}</dd></div>
            <div><dt>moon</dt><dd>{{ Math.round((night.moonIllum ?? 0) * 100) }}% · up {{ Math.round((night.moonUpFraction ?? 0) * 100) }}%</dd></div>
            <div><dt>moonless</dt><dd>{{ night.darkHours != null ? night.darkHours + 'h' : '—' }}</dd></div>
          </dl>

          <p v-if="night.shortForecast" class="muted small outlook-forecast">{{ night.shortForecast }}</p>

          <NightTimes v-if="night.twilight" :twilight="night.twilight" compact />

          <ul v-if="night.reasons?.length" class="outlook-reasons">
            <li v-for="r in night.reasons" :key="r">{{ r }}</li>
          </ul>

          <div v-if="night.hours?.length" class="ov-hours">
            <div v-for="h in night.hours" :key="h.time"
                 class="hour-chip"
                 :class="[
                   `rc-${normalizeRating(h.rating)}`,
                   { best: bestHour && h.time === bestHour.time, 'not-dark': !h.isDark },
                 ]">
              <span class="hour-chip-time">{{ fmtTime(h.time) }}</span>
              <span class="hour-chip-emoji">{{ weatherEmoji(h) }}</span>
              <span class="hour-chip-temp">{{ h.tempF != null ? h.tempF + '°' : '—' }}</span>
              <span class="hour-chip-cloud muted small">{{ h.skyCover != null ? h.skyCover + '%' : '—' }}</span>
            </div>
          </div>
          <p v-else class="muted small">no hourly detail for this night</p>
        </div>
      </div>
    </details>
  </section>
</template>
