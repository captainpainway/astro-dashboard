import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Build only: the stylesheet index.html links to goes inline as a <style>, so the first paint (the static header)
 * needs no second request. Its url()s are written against `base`, so they still resolve from the page.
 */
const inlineCss = {
  name: 'inline-css',
  apply: 'build',
  enforce: 'post',
  generateBundle(_, bundle) {
    const html = bundle['index.html']
    if (!html) return
    html.source = html.source.replace(/<link rel="stylesheet"[^>]*href="[^"]*?(assets\/[^"\/]+\.css)"[^>]*>/g, (tag, file) => {
      const css = bundle[file]
      if (!css) return tag
      delete bundle[file]
      return `<style>${css.source}</style>`
    })
  },
}

// GitHub Pages serves a project site from /<repo>/; override with BASE_PATH (e.g. "/" for a custom domain).
export default defineConfig(({ command, isPreview }) => ({
  // `vite preview` reports command "serve", so it needs the build's base too or it can't find the built assets.
  base: command === 'build' || isPreview ? process.env.BASE_PATH ?? '/astro-dashboard/' : '/',
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
}))
