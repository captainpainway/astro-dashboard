import { gsap } from 'gsap'

export const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// The tip's bottom-left corner sits 14px above its anchor: it pops out from there and springs into place, then shrinks back.
export function tipIn(el, done) {
  gsap.set(el, { yPercent: -100 })
  if (reduceMotion()) { gsap.set(el, { y: -14 }); return done() }
  gsap.fromTo(el, { opacity: 0, scale: 0.3, y: -4, rotation: -4 },
    { opacity: 1, scale: 1, y: -14, rotation: 0, duration: 0.45, ease: 'back.out(2.4)', onComplete: done })
}
export function tipOut(el, done) {
  if (reduceMotion()) return done()
  gsap.to(el, { opacity: 0, scale: 0.6, y: -8, duration: 0.15, ease: 'power2.in', onComplete: done })
}
