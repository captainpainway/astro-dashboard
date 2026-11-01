import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Build only: the stylesheet index.html links to goes inline as a <style>, so the first paint (the static header)
 * needs no second request. Its url()s are root-absolute (/assets/...), so they still resolve from the page.
 */
const inlineCss = {
  name: 'inline-css',
  apply: 'build',
  enforce: 'post',
  generateBundle(_, bundle) {
    const html = bundle['index.html']
    if (!html) return
    html.source = html.source.replace(/<link rel="stylesheet"[^>]*href="\/([^"]+\.css)"[^>]*>/g, (tag, file) => {
      const css = bundle[file]
      if (!css) return tag
      delete bundle[file]
      return `<style>${css.source}</style>`
    })
  },
}

export default defineConfig({
  plugins: [vue(), inlineCss],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
