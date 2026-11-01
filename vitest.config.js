import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Some tests format instants in the viewer's timezone, so pin one (CI runners are UTC); workers inherit it.
process.env.TZ = 'America/New_York'

export default defineConfig({
  plugins: [vue()],
  test: { environment: 'jsdom' },
})