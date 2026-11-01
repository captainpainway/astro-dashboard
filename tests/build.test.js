import { describe, expect, it } from 'vitest'
import { build } from 'vite'

describe('production build', () => {
  it('puts the stylesheet inline in index.html, so the first paint needs no second request', async () => {
    const { output } = await build({ logLevel: 'silent', build: { write: false } })
    const html = output.find((f) => f.fileName === 'index.html').source
    expect(html).not.toMatch(/<link rel="stylesheet"/)
    expect(html).toMatch(/<style>[^<]*\.app-header/) // the static header's styles are in the page itself
    expect(output.filter((f) => f.fileName.endsWith('.css'))).toEqual([])
  }, 60_000)
})
