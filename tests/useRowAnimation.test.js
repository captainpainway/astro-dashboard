import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useRowAnimation } from '../src/composables/useRowAnimation'

afterEach(() => vi.unstubAllGlobals())

const row = () => {
  const tr = document.createElement('tr')
  tr.append(document.createElement('td'))
  return tr
}
const hooks = () => effectScope().run(() => useRowAnimation(ref(null), ref([])))

describe('useRowAnimation', () => {
  it('finishes enter and leave at once, without hiding the row, when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce') }))
    const { onBeforeEnter, onEnter, onLeave } = hooks()
    const tr = row()
    const entered = vi.fn()
    onBeforeEnter(tr)
    expect(tr.firstChild.style.opacity).toBe('')
    onEnter(tr, entered)
    expect(entered).toHaveBeenCalledTimes(1)
    const left = vi.fn()
    onLeave(tr, left)
    expect(left).toHaveBeenCalledTimes(1)
  })

  it('hides a new row until its fade-in starts when motion is allowed', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const { onBeforeEnter } = hooks()
    const tr = row()
    onBeforeEnter(tr)
    expect(tr.firstChild.style.opacity).toBe('0')
  })
})
