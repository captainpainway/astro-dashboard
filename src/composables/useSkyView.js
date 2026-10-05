import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { gsap } from 'gsap'
import { altAzOf, introEnd, nightRange, skyAt, targetHorizon, turnTarget } from '../engine/sky'
import { toLocalIso } from '../engine/time'
import { fmtTime } from '../format'
import { reduceMotion } from '../motion'

export const ZOOM_STEP = 1.5

/**
 * What the sky shows, shared by the home tile and the sky page: the time, view direction and zoom, and the intro.
 * App.vue owns one. The component showing the sky calls `follow`: a new location re-opens the sky, while switching
 * pages keeps everything as it was.
 */
export function useSkyView() {
  const location = shallowRef(null)
  const view = reactive({ yaw: 180, pitch: 25, zoom: 1 })
  const now = ref(new Date())
  const time = ref(now.value.getTime())
  const zoomMax = ref(4) // set by the mounted SkyStage from its width
  const range = computed(() => (location.value ? nightRange(location.value, now.value) : null))
  const frame = computed(() => (location.value ? skyAt(location.value, new Date(time.value)) : null))
  const timeLabel = computed(() =>
    (location.value ? fmtTime(toLocalIso(new Date(time.value), location.value.timezone)) : ''))
  let plan = { targets: () => [], bestHour: () => null }
  let intro = null
  let touched = false // after any drag, key, scrub or turn the camera is the visitor's until the next location

  function stopMotion() {
    intro?.kill()
    intro = null
    gsap.killTweensOf(view)
  }
  function touch() {
    touched = true
    stopMotion()
  }

  /** The highest-scoring target above the horizon at `date`, as alt/az; south at 25° when none is up. */
  function topAt(date) {
    const f = skyAt(location.value, date)
    const up = plan.targets().map((t) => ({ t, v: targetHorizon(t, f) })).filter(({ v }) => v && v[2] > 0)
    const best = up.sort((a, b) => b.t.score - a.t.score)[0]
    return best ? altAzOf(best.v) : { alt: 25, az: 180 }
  }
  function face(date, animate) {
    const goal = turnTarget(view, topAt(date), 20)
    if (animate && !reduceMotion()) gsap.to(view, { ...goal, duration: 1, ease: 'power2.inOut', overwrite: true })
    else Object.assign(view, goal)
  }

  /** At night: now, facing the #1 target. In daytime: the intro from sunset to the best moment (or its end state). */
  function open() {
    stopMotion()
    touched = false
    view.zoom = 1
    now.value = new Date()
    const { start, end } = range.value
    const t = now.value.getTime()
    if (t >= start && t <= end) {
      time.value = t
      return face(now.value, false)
    }
    const stop = () => introEnd(range.value, plan.bestHour()).getTime()
    if (reduceMotion()) {
      time.value = stop()
      return face(new Date(time.value), false)
    }
    time.value = start.getTime()
    const from = { yaw: frame.value.sun.az, pitch: 25 } // facing the sunset glow
    Object.assign(view, from)
    const p = { v: 0 }
    intro = gsap.to(p, {
      v: 1, duration: 4, ease: 'power2.inOut',
      onUpdate() {
        // Read every frame, so a forecast or plan arriving mid-intro retargets it smoothly.
        const e = stop()
        const goal = turnTarget(from, topAt(new Date(e)), 20)
        time.value = start.getTime() + p.v * (e - start.getTime())
        view.yaw = from.yaw + p.v * (goal.yaw - from.yaw)
        view.pitch = from.pitch + p.v * (goal.pitch - from.pitch)
      },
      onComplete: () => { intro = null },
    })
  }

  function attach(loc, how) {
    plan = how
    if (loc === location.value) return
    location.value = loc
    open()
  }
  function retarget() {
    if (!touched && !intro) face(new Date(time.value), true)
  }
  /** Call once from the setup of the component showing the sky; its watchers stop when it unmounts. */
  function follow(getLocation, how) {
    attach(getLocation(), how)
    watch(getLocation, (loc) => attach(loc, how))
    watch(() => how.targets().map((t) => t.id).join(), retarget)
  }

  function setTime(t) {
    touch()
    time.value = t
  }
  /** Turn to `altAz` the short way; below the horizon, face its direction with the camera as low as it goes. */
  function turnTo(altAz) {
    touch()
    const goal = turnTarget(view, altAz)
    if (altAz.alt <= 0) goal.pitch = 5
    if (reduceMotion()) Object.assign(view, goal)
    else gsap.to(view, { ...goal, duration: 0.8, ease: 'power2.inOut' })
  }
  const clampZoom = (z) => Math.min(zoomMax.value, Math.max(1, z))
  function zoomBy(factor, animate = true) {
    touch()
    const zoom = clampZoom(view.zoom * factor)
    if (animate && !reduceMotion()) gsap.to(view, { zoom, duration: 0.3, ease: 'power2.out' })
    else view.zoom = zoom
  }

  return reactive({
    location, view, now, time, zoomMax, range, frame, timeLabel, follow, touch, setTime, turnTo, zoomBy, clampZoom,
  })
}
