import { onBeforeUnmount, watch } from 'vue'
import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'

gsap.registerPlugin(Flip)

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Row animation for a `<TransitionGroup tag="tbody" :css="false">`: new rows fade in, removed rows
 * fade out, and the rows that stay FLIP-glide to their new spots — first when rows are inserted or
 * reordered, then again when leaving rows are actually removed and the gap closes.
 * `table`: ref to the <table>; `rows`: ref of the rendered rows (watched for changes).
 * Returns the hooks to bind on the TransitionGroup.
 */
export function useRowAnimation(table, rows) {
  const rowEls = () => [...(table.value?.querySelectorAll('tbody > tr') ?? [])]
  const leaving = new Set()

  let moveState = null
  watch(rows, () => {
    moveState = reduceMotion() ? null : Flip.getState(rowEls())
  }, { flush: 'pre' })
  watch(rows, () => {
    if (!moveState) return
    // leave hooks run during the patch, so `leaving` is filled in by now
    Flip.from(moveState, { targets: rowEls().filter((el) => !leaving.has(el)),
      duration: 0.35, ease: 'power2.inOut' })
    moveState = null
  }, { flush: 'post' })

  let enterIndex = 0
  // Enter tweens the cells, not the <tr>: Flip owns the row's transform and restores its
  // inline style when done, which would clobber a fade running on the row itself.
  function onBeforeEnter(el) {
    if (!reduceMotion()) gsap.set(el.children, { opacity: 0 })
  }
  function onEnter(el, done) {
    if (reduceMotion()) return done()
    if (enterIndex === 0) queueMicrotask(() => { enterIndex = 0 })
    const delay = 0.12 + Math.min(enterIndex++, 10) * 0.03
    gsap.fromTo(el.children, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.3, delay, ease: 'power2.out',
      clearProps: 'transform,opacity', onComplete: done })
  }

  // Leave completions are batched so rows removed together close their gaps in one Flip.
  let removals = []
  function queueRemoval(done) {
    removals.push(done)
    if (removals.length > 1) return
    queueMicrotask(() => {
      const dones = removals
      removals = []
      const state = Flip.getState(rowEls().filter((el) => !leaving.has(el)))
      dones.forEach((d) => d())
      Flip.from(state, { duration: 0.3, ease: 'power2.inOut' })
    })
  }
  function onLeave(el, done) {
    const finish = () => { leaving.delete(el); done() }
    if (reduceMotion()) return finish()
    leaving.add(el)
    // A closing detail row goes at once, and the rows below move straight back up, just as they move straight down
    // when it opens. Fading or gliding inside the blurred glass panel re-blurs the panel on every frame, which made
    // closing lag well behind the click.
    if (el.classList.contains('detail-row')) return finish()
    gsap.killTweensOf(el)
    gsap.to(el, { opacity: 0, x: 12, duration: 0.2, ease: 'power1.in', onComplete: () => queueRemoval(finish) })
  }

  onBeforeUnmount(() => gsap.killTweensOf(rowEls().flatMap((r) => [r, ...r.children])))

  return { onBeforeEnter, onEnter, onLeave }
}
