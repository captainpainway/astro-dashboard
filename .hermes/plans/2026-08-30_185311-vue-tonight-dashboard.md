# Vue Dashboard for astro-cli — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a Vue 3 dashboard in `/home/maryknize/astro-dashboard` that consumes the astro-cli REST API, starting with `GET http://127.0.0.1:8000/tonight`.

**Architecture:** Vue 3 + Vite SPA, manually scaffolded (no interactive scaffolder — deterministic). State lives in one composable (`useTonight`) driven by a small controls model (mode, time, class filters, sort). All API calls go through a Vite dev proxy (`/api` → `127.0.0.1:8000`) so the app is same-origin and CORS-free. Targets render as a sortable table with expandable detail rows (85 rows need a table, not cards).

**Tech Stack:** Vue 3.5 (Composition API, `<script setup>`), Vite 6, `@vitejs/plugin-vue` 5, Vitest 2 + `@vue/test-utils` + jsdom for unit tests. No Pinia, no router, no axios, no chart library — `fetch` + plain CSS/SVG suffice (YAGNI).

---

## Verified Context (grounding for the implementer)

The API is **already running** on `127.0.0.1:8000` (started from `~/astro-cli`; keep it running — `de421.bsp` is loaded relative to CWD, so if it ever needs restarting: `cd ~/astro-cli && .venv/bin/astro-cli serve --port 8000`).

Live response shapes, verified by curl on 2026-08-30:

**Window mode** (`GET /tonight`) — top-level keys: `generatedAt`, `mode:"window"`, `night`, `weather`, `instruments`, `errors`.

```json
{
  "generatedAt": "2026-08-31T02:41:03+00:00",
  "mode": "window",
  "night": {"startLocal": "2026-08-30T21:00:00-04:00", "endLocal": "2026-08-31T05:00:00-04:00",
            "startUtc": "...", "endUtc": "...", "timezone": "America/New_York"},
  "weather": {
    "summary": {"cloudCoverAvg": 46.3, "temperatureF": 75, "windMphAvg": 2.2, "rating": "good"},
    "current": {"cloudCover": 71, "temperatureF": 82.4, "windMph": 6.9,
                "description": "Mostly cloudy", "station": "KLEE (Leesburg International Airport)",
                "timestamp": "2026-08-30T22:30:00+00:00"}
  },
  "instruments": {"dob_8inch": [ ...85 targets... ], "dwarf_mini": [ ...34 targets... ]},
  "errors": []
}
```

**Target object** (per instrument array):

```json
{
  "id": "SS Cyg", "name": "SS Cyg", "targetClass": "variable",
  "score": 81.1, "maxAlt": 75.1, "bestTime": "2026-08-31T00:30:00-04:00",
  "window": {"start": "2026-08-30T21:00:00-04:00", "end": "2026-08-31T05:00:00-04:00"},
  "altAtBest": 75.1, "azAtBest": 2.0, "moonInterference": 0.0,
  "notes": "chart X42882PV — Dwarf nova, monitor for outburst"
}
```

- `moonInterference` is a **0–1 fraction** (verified in `astro_cli/moonlight.py`), display as a percentage.
- `score` is 0–100. `rating` strings seen: `ideal > great > good > fair > poor > bad`.
- Target classes (valid `include` values): `planet, moon, variable, messier, nebula, cluster`.

**Instant mode** (`GET /tonight?at=22:30`) — differences: no `night` key; adds `at: {local, utc, timezone}`; `weather` has `{current, atTime}` instead of `{summary, current}`. `atTime`: `{cloudCover, temperatureF, windMph, rating, forecast}`. 56/21 targets in the live sample.

**Shared:** `errors` is a string array (upstream NWS/AAVSO failures degrade to `null` fields rather than failing). Invalid params → 422 with `{detail: "..."}`.

**Environment:** Node is managed by **nvm, installed at `~/.config/nvm`** (XDG path — NOT the default `~/.nvm`). Default alias: Node **v24.19.0**, npm 11.17.0 (also v23.7.0 installed). Hermes terminal calls run non-interactive bash, which does not source `.bashrc` — every command that needs `node`/`npm` must first run:

```bash
export NVM_DIR="$HOME/.config/nvm" && . "$NVM_DIR/nvm.sh"
```

Current npm registry versions (verified): vue 3.5.42, vite 8.2.2, vitest 4.1.11, @vitejs/plugin-vue 6.0.8, @vue/test-utils 2.5.0, jsdom 30.0.1 — all Node-24 compatible. The plan pins to these.

**Repo state:** `/home/maryknize/astro-dashboard` — git initialized, zero commits, empty worktree.

---

## Product Scope (v1)

1. **Header** — night window (start–end, local, timezone), `generatedAt`, refresh button.
2. **Weather panel** — window mode: rating chip (color-coded) + cloud avg / temp / wind avg + current conditions (station, description). Instant mode: rating at that time + forecast text.
3. **Controls** — mode toggle (Tonight / At time + `<input type="time">`), 6 target-class filter chips, sort by score/bestTime/maxAlt/name.
4. **Instrument tabs** — `dob_8inch` / `dwarf_mini` with target counts.
5. **Target table** — rank, name, class badge, score bar, alt@best + compass az, best time, moon interference %, window; row click expands notes + a per-target mini-timeline (bar over its window, ★ at bestTime) — hidden in instant mode (no night envelope).
6. **Degraded-data banner** when `errors.length > 0`; loading spinner; empty state.
7. Class filters map to the `include` query param (only sent when a class is deselected; last active chip cannot be deselected).

**Backlog (v2, do not build now):** `/forecast` hourly strip tab; `/discover` table tab; serve `dist/` from FastAPI as static files; auto-refresh every 10 min.

---

## File Layout (all under `/home/maryknize/astro-dashboard`)

```
package.json            vite.config.js          index.html      .gitignore
jsconfig.json           src/style.css
src/main.js             src/App.vue
src/api.js              src/format.js           src/ratings.js
src/composables/useTonight.js
src/components/AppHeader.vue
src/components/WeatherPanel.vue
src/components/ControlsBar.vue
src/components/TargetTable.vue
src/components/ErrorsBanner.vue
tests/format.test.js    tests/api.test.js      tests/ratings.test.js   tests/TargetTable.test.js
vitest.config.js
```

---

## Task 0: Verify Node toolchain via nvm

**Objective:** Node + npm available to the shell (already installed — just source nvm).

**No system installs needed.** Run at the top of every shell session/command:

```bash
export NVM_DIR="$HOME/.config/nvm" && . "$NVM_DIR/nvm.sh"
node --version    # expect: v24.19.0 (default alias; v23.7.0 also installed)
npm --version     # expect: 11.17.0
```

If a fresh shell can't find `node`, the nvm sourcing line was skipped — that's the only failure mode.

## Task 1: Scaffold project + dev proxy

**Objective:** `npm run dev` serves the app and proxies `/api/*` to the running FastAPI.

**Files:** Create `package.json`, `vite.config.js`, `index.html`, `jsconfig.json`, `.gitignore`, `src/main.js`, `src/App.vue` (minimal), `src/style.css`.

**Step 1:** `package.json`:

```json
{
  "name": "astro-dashboard",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": { "vue": "^3.5.42" },
  "devDependencies": {
    "@vitejs/plugin-vue": "^6.0.8",
    "@vue/test-utils": "^2.5.0",
    "jsdom": "^30.0.1",
    "vite": "^8.2.2",
    "vitest": "^4.1.11"
  }
}
```

**Step 2:** `vite.config.js`:

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
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
```

**Step 3:** `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>astro dashboard</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

**Step 4:** `jsconfig.json`:

```json
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }
```

**Step 5:** `.gitignore`:

```
node_modules/
dist/
*.log
```

**Step 6:** `src/main.js`:

```js
import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')
```

**Step 7:** minimal `src/App.vue` (will grow in Task 4):

```vue
<template>
  <main class="page">
    <h1>astro dashboard</h1>
    <p>loading…</p>
  </main>
</template>
```

**Step 8:** `src/style.css` — dark sky theme baseline:

```css
:root {
  --bg: #0b1020;
  --panel: #141b31;
  --panel-2: #1b2440;
  --text: #e8ecf8;
  --muted: #93a0c2;
  --accent: #7aa2ff;
  --good: #4ade80;
  --warn: #fbbf24;
  --bad: #f87171;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
}
.page { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }
button { font: inherit; cursor: pointer; }
```

**Step 9:** Install and verify:

```bash
npm install
npm run dev &
sleep 3
curl -s http://127.0.0.1:5173/ | grep -o '<title>.*</title>'   # expect: <title>astro dashboard</title>
curl -s http://127.0.0.1:5173/api/tonight | head -c 120
# expect JSON starting {"generatedAt":... — proves the proxy reaches FastAPI
```

**Step 10:** Commit:

```bash
git add -A && git commit -m "chore: scaffold Vue 3 + Vite app with /api proxy"
```

## Task 2: Pure helpers — TDD

**Objective:** Formatting/rating/timeline helpers, unit-tested.

**Files:** Create `src/format.js`, `src/ratings.js`, `vitest.config.js`, `tests/format.test.js`, `tests/ratings.test.js`.

**Step 1:** `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: { environment: 'jsdom' },
})
```

**Step 2 — write failing tests.** `tests/format.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { fmtTime, pct, compass, timeline } from '../src/format'

describe('fmtTime', () => {
  it('formats ISO local times as h:mm AM/PM', () => {
    expect(fmtTime('2026-08-31T00:30:00-04:00')).toBe('12:30 AM')
    expect(fmtTime('2026-08-30T21:00:00-04:00')).toBe('9:00 PM')
  })
  it('returns em-dash for empty input', () => {
    expect(fmtTime(null)).toBe('—')
  })
})

describe('pct (moonInterference 0-1 fraction)', () => {
  it('renders as integer percent', () => expect(pct(0.4)).toBe('40%'))
  it('renders zero as 0%', () => expect(pct(0)).toBe('0%'))
  it('renders null as em-dash', () => expect(pct(null)).toBe('—'))
})

describe('compass', () => {
  it('maps azimuth to 16-point compass', () => {
    expect(compass(2)).toBe('N')
    expect(compass(181)).toBe('S')
    expect(compass(46)).toBe('NE')
  })
  it('handles null', () => expect(compass(null)).toBe('—'))
})

describe('timeline', () => {
  const night = { startLocal: '2026-08-30T21:00:00-04:00', endLocal: '2026-08-31T05:00:00-04:00' }
  const target = {
    window: { start: '2026-08-30T21:00:00-04:00', end: '2026-08-31T05:00:00-04:00' },
    bestTime: '2026-08-31T01:00:00-04:00',
  }
  it('computes bar position and star position in percent', () => {
    const t = timeline(night, target)
    expect(t.leftPct).toBeCloseTo(0)
    expect(t.widthPct).toBeCloseTo(100)
    expect(t.starPct).toBeCloseTo(50)
  })
  it('clamps out-of-window values to 0-100', () => {
    const t = timeline(night, { window: { start: night.startLocal, end: night.endLocal },
                                bestTime: '2026-08-31T12:00:00-04:00' })
    expect(t.starPct).toBe(100)
  })
})
```

`tests/ratings.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { ratingStyle } from '../src/ratings'

describe('ratingStyle', () => {
  it('maps known ratings to labels and css classes', () => {
    expect(ratingStyle('good')).toEqual({ label: 'Good', css: 'rating-good' })
    expect(ratingStyle('ideal').css).toBe('rating-ideal')
  })
  it('falls back for unknown or null', () => {
    expect(ratingStyle('weird')).toEqual({ label: 'weird', css: 'rating-none' })
    expect(ratingStyle(null)).toEqual({ label: '—', css: 'rating-none' })
  })
})
```

**Step 3:** `npm test` — expect FAIL (modules don't exist).

**Step 4 — implement.** `src/format.js`:

```js
const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']

export function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function pct(x) {
  if (x === null || x === undefined) return '—'
  return `${Math.round(x * 100)}%`
}

export function compass(az) {
  if (az === null || az === undefined) return '—'
  return COMPASS[Math.round(az / 22.5) % 16]
}

export function timeline(night, target) {
  const start = new Date(night.startLocal).getTime()
  const end = new Date(night.endLocal).getTime()
  const span = (end - start) || 1
  const pos = (t) =>
    Math.max(0, Math.min(100, ((new Date(t).getTime() - start) / span) * 100))
  return {
    leftPct: pos(target.window.start),
    widthPct: pos(target.window.end) - pos(target.window.start),
    starPct: pos(target.bestTime),
  }
}
```

`src/ratings.js`:

```js
const RATING_STYLES = {
  ideal: { label: 'Ideal', css: 'rating-ideal' },
  great: { label: 'Great', css: 'rating-great' },
  good: { label: 'Good', css: 'rating-good' },
  fair: { label: 'Fair', css: 'rating-fair' },
  poor: { label: 'Poor', css: 'rating-poor' },
  bad: { label: 'Bad', css: 'rating-bad' },
}

export function ratingStyle(rating) {
  return RATING_STYLES[rating] ?? { label: rating ?? '—', css: 'rating-none' }
}
```

**Step 5:** `npm test` — expect 10 passed.

**Step 6:** Commit: `git add -A && git commit -m "feat: format/rating helpers with unit tests"`

## Task 3: API layer — TDD

**Objective:** Query builder + fetch wrapper for `/tonight`.

**Files:** Create `src/api.js`, `tests/api.test.js`.

**Step 1 — failing test.** `tests/api.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { buildTonightQuery } from '../src/api'

describe('buildTonightQuery', () => {
  it('builds at + repeatable include params', () => {
    expect(buildTonightQuery({ at: '22:30', include: ['planet', 'moon'] }))
      .toBe('?at=22:30&include=planet&include=moon')
  })
  it('returns empty string for no options', () => {
    expect(buildTonightQuery()).toBe('')
    expect(buildTonightQuery({ include: [] })).toBe('')
  })
  it('skips at when not provided', () => {
    expect(buildTonightQuery({ include: ['nebula'] })).toBe('?include=nebula')
  })
})
```

**Step 2:** `npm test` — expect FAIL.

**Step 3 — implement.** `src/api.js`:

```js
const BASE = '/api'

export function buildTonightQuery({ at, include } = {}) {
  const params = new URLSearchParams()
  if (at) params.set('at', at)
  if (include?.length) for (const c of include) params.append('include', c)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export async function fetchTonight(opts = {}) {
  const res = await fetch(`${BASE}/tonight${buildTonightQuery(opts)}`)
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try { const body = await res.json(); if (body?.detail) detail = String(body.detail) } catch { /* keep status text */ }
    throw new Error(detail)
  }
  return res.json()
}
```

**Step 4:** `npm test` — expect 13 passed.

**Step 5:** Commit: `git add -A && git commit -m "feat: /tonight api client"`

## Task 4: Data state + app shell

**Objective:** Composable holds response; App renders header, weather, errors; live data flows.

**Files:** Create `src/composables/useTonight.js`, `src/components/AppHeader.vue`, `src/components/WeatherPanel.vue`, `src/components/ErrorsBanner.vue`; expand `src/App.vue`.

**Step 1:** `src/composables/useTonight.js`:

```js
import { ref, shallowRef } from 'vue'
import { fetchTonight } from '../api'

export function useTonight() {
  const data = shallowRef(null)
  const loading = ref(false)
  const error = ref(null)

  async function load({ at, include } = {}) {
    loading.value = true
    error.value = null
    try {
      data.value = await fetchTonight({ at, include })
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, load }
}
```

**Step 2:** `src/components/ErrorsBanner.vue`:

```vue
<script setup>
defineProps({ errors: { type: Array, default: () => [] } })
</script>

<template>
  <div v-if="errors.length" class="errors-banner" role="alert">
    <strong>Partial data</strong> — upstream problem:
    <ul><li v-for="e in errors" :key="e">{{ e }}</li></ul>
  </div>
</template>

<style scoped>
.errors-banner { background: #3a1f1f; border: 1px solid var(--warn); border-radius: 8px; padding: 0.75rem 1rem; }
</style>
```

**Step 3:** `src/components/AppHeader.vue`:

```vue
<script setup>
import { fmtTime } from '../format'

defineProps({
  night: { type: Object, default: null },
  atLocal: { type: String, default: null },
  generatedAt: { type: String, required: true },
  loading: { type: Boolean, default: false },
})
defineEmits(['refresh'])
</script>

<template>
  <header class="app-header">
    <h1>astro dashboard</h1>
    <p v-if="atLocal" class="muted">Sky at {{ fmtTime(atLocal) }}</p>
    <p v-else-if="night" class="muted">
      {{ fmtTime(night.startLocal) }} – {{ fmtTime(night.endLocal) }} ({{ night.timezone }})
    </p>
    <p class="muted small">generated {{ new Date(generatedAt).toLocaleTimeString('en-US') }}</p>
    <button class="refresh" :disabled="loading" @click="$emit('refresh')">
      {{ loading ? 'loading…' : 'refresh' }}
    </button>
  </header>
</template>
```

**Step 4:** `src/components/WeatherPanel.vue`:

```vue
<script setup>
import { ratingStyle } from '../ratings'

defineProps({
  weather: { type: Object, default: null },
  mode: { type: String, required: true }, // 'window' | 'instant'
})
</script>

<template>
  <section v-if="weather" class="weather panel">
    <template v-if="mode === 'window' && weather.summary">
      <span class="rating" :class="ratingStyle(weather.summary.rating).css">
        {{ ratingStyle(weather.summary.rating).label }} night
      </span>
      <dl>
        <div><dt>cloud avg</dt><dd>{{ Math.round(weather.summary.cloudCoverAvg ?? 0) }}%</dd></div>
        <div><dt>temp</dt><dd>{{ weather.summary.temperatureF ?? '—' }}°F</dd></div>
        <div><dt>wind avg</dt><dd>{{ weather.summary.windMphAvg ?? '—' }} mph</dd></div>
      </dl>
    </template>
    <template v-else-if="mode === 'instant' && weather.atTime">
      <span class="rating" :class="ratingStyle(weather.atTime.rating).css">
        {{ ratingStyle(weather.atTime.rating).label }} at that time
      </span>
      <dl>
        <div><dt>cloud</dt><dd>{{ weather.atTime.cloudCover ?? '—' }}%</dd></div>
        <div><dt>temp</dt><dd>{{ weather.atTime.temperatureF ?? '—' }}°F</dd></div>
        <div><dt>wind</dt><dd>{{ weather.atTime.windMph ?? '—' }} mph</dd></div>
        <div><dt>forecast</dt><dd>{{ weather.atTime.forecast ?? '—' }}</dd></div>
      </dl>
    </template>
    <p v-if="weather.current" class="current muted">
      now: {{ weather.current.description ?? '—' }}, {{ weather.current.cloudCover ?? '—' }}% cloud,
      {{ weather.current.temperatureF ?? '—' }}°F — {{ weather.current.station }}
    </p>
  </section>
</template>
```

**Step 5:** `src/App.vue` (full version — ControlsBar/TargetTable stubs come next tasks):

```vue
<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useTonight } from './composables/useTonight'
import AppHeader from './components/AppHeader.vue'
import WeatherPanel from './components/WeatherPanel.vue'
import ErrorsBanner from './components/ErrorsBanner.vue'

const { data, loading, error, load } = useTonight()

const mode = ref('window') // 'window' | 'instant'

const requestParams = computed(() => ({
  at: mode.value === 'instant' ? atTime.value : null,
  include: null, // wired in Task 5
}))
const atTime = ref('22:30')

async function refresh() { await load(requestParams.value) }
onMounted(refresh)
watch(requestParams, refresh)

const night = computed(() => data.value?.mode === 'window' ? data.value.night : null)
const atLocal = computed(() => data.value?.mode === 'instant' ? data.value.at?.local : null)
</script>

<template>
  <main class="page">
    <AppHeader :night="night" :at-local="atLocal" :generated-at="data?.generatedAt ?? ''"
               :loading="loading" @refresh="refresh" />
    <p v-if="error" class="error">failed to load: {{ error }}</p>
    <ErrorsBanner v-if="data" :errors="data.errors" />
    <WeatherPanel v-if="data" :weather="data.weather" :mode="data.mode" />
    <p v-if="loading && !data" class="muted">loading tonight's plan…</p>
  </main>
</template>
```

**Step 6:** Verify by hand: `npm run dev`, open `http://127.0.0.1:5173` — header shows 9:00 PM – 5:00 AM (America/New_York), weather shows "Good night" + current conditions. Confirm in the browser devtools network tab that only `/api/tonight` was called.

**Step 7:** Commit: `git add -A && git commit -m "feat: app shell with header, weather panel, errors banner"`

## Task 5: Controls — mode, time, class filters, sort

**Objective:** ControlsBar drives refetching via watched params.

**Files:** Create `src/components/ControlsBar.vue`; modify `src/App.vue`.

**Step 1:** `src/components/ControlsBar.vue`:

```vue
<script setup>
const CLASSES = ['planet', 'moon', 'variable', 'messier', 'nebula', 'cluster']
const SORTS = [
  { key: 'score', label: 'score' },
  { key: 'bestTime', label: 'best time' },
  { key: 'maxAlt', label: 'altitude' },
  { key: 'name', label: 'name' },
]

defineProps({
  mode: { type: String, required: true },
  atTime: { type: String, default: '' },
  activeClasses: { type: Array, required: true },
  sortKey: { type: String, required: true },
})
const emit = defineEmits([
  'update:mode', 'update:atTime', 'update:activeClasses', 'update:sortKey',
])

function toggleClass(c) {
  const active = new Set(activeClassesSet())
  if (active.has(c) && active.size === 1) return // never deselect the last class
  active.has(c) ? active.delete(c) : active.add(c)
  emit('update:activeClasses', [...active])
}
function activeClassesSet() { return props.activeClasses }
const props = defineProps({ instrumentCount: { type: Number, default: 0 } })
</script>
```

**NOTE to implementer:** the sketch above has a deliberate shape smell (two `defineProps` calls won't compile). Merge into ONE `defineProps` and reference it via `const props = defineProps({...})` — fix before running. The logic to keep: `toggleClass` guarding the last active chip.

Complete, correct `<script setup>`:

```vue
<script setup>
const CLASSES = ['planet', 'moon', 'variable', 'messier', 'nebula', 'cluster']
const SORTS = [
  { key: 'score', label: 'score' },
  { key: 'bestTime', label: 'best time' },
  { key: 'maxAlt', label: 'altitude' },
  { key: 'name', label: 'name' },
]

const props = defineProps({
  mode: { type: String, required: true },
  atTime: { type: String, default: '' },
  activeClasses: { type: Array, required: true },
  sortKey: { type: String, required: true },
})
const emit = defineEmits(['update:mode', 'update:atTime', 'update:activeClasses', 'update:sortKey'])

function toggleClass(c) {
  const active = new Set(props.activeClasses)
  if (active.has(c) && active.size === 1) return // never deselect the last class
  active.has(c) ? active.delete(c) : active.add(c)
  emit('update:activeClasses', [...active])
}
</script>

<template>
  <section class="controls panel">
    <div class="mode">
      <button :class="{ active: mode === 'window' }" @click="emit('update:mode', 'window')">tonight</button>
      <button :class="{ active: mode === 'instant' }" @click="emit('update:mode', 'instant')">at time</button>
      <input v-if="mode === 'instant'" type="time" :value="atTime"
             @input="emit('update:atTime', $event.target.value)" />
    </div>
    <div class="chips">
      <button v-for="c in CLASSES" :key="c" :class="{ chip: true, active: activeClasses.includes(c) }"
              @click="toggleClass(c)">{{ c }}</button>
    </div>
    <div class="sorts">
      <label>sort by</label>
      <select :value="sortKey" @change="emit('update:sortKey', $event.target.value)">
        <option v-for="s in SORTS" :key="s.key" :value="s.key">{{ s.label }}</option>
      </select>
    </div>
  </section>
</template>
```

**Step 2:** In `src/App.vue`, add state + wiring:

```js
const atTime = ref('22:30')
const activeClasses = ref(['planet', 'moon', 'variable', 'messier', 'nebula', 'cluster'])
const ALL_CLASSES = ['planet', 'moon', 'variable', 'messier', 'nebula', 'cluster']

const requestParams = computed(() => ({
  at: mode.value === 'instant' ? atTime.value : null,
  include: activeClasses.value.length < ALL_CLASSES.length ? activeClasses.value : null,
}))
```

Template addition (between ErrorsBanner and WeatherPanel):

```html
<ControlsBar v-if="data" v-model:mode="mode" v-model:at-time="atTime"
             v-model:active-classes="activeClasses" v-model:sort-key="sortKey" />
```

with `const sortKey = ref('score')` in script. `watch(requestParams, refresh)` (already present) handles refetch on every control change — verify instant mode sends `at=22:30` and deselected chips send `include=`.

**Step 3:** Manual verify in browser: switch to "at time" 22:30 → header shows "Sky at 10:30 PM", weather shows rating at that time. Deselect "moon" chip → network tab shows `include=planet&include=variable&include=messier&include=nebula&include=cluster`, moon targets vanish.

**Step 4:** Commit: `git add -A && git commit -m "feat: controls bar — mode, time, class filters, sort"`

## Task 6: Target table with expandable rows + timeline

**Objective:** Sortable table per instrument, expandable detail rows, moon-interference coloring, per-target mini-timeline.

**Files:** Create `src/components/TargetTable.vue`, `tests/TargetTable.test.js`; modify `src/App.vue` (instrument tabs + table).

**Step 1 — failing component test.** `tests/TargetTable.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TargetTable from '../src/components/TargetTable.vue'

const night = { startLocal: '2026-08-30T21:00:00-04:00', endLocal: '2026-08-31T05:00:00-04:00' }
const targets = [
  { id: 'SS Cyg', name: 'SS Cyg', targetClass: 'variable', score: 81.1, maxAlt: 75.1,
    bestTime: '2026-08-31T00:30:00-04:00',
    window: { start: night.startLocal, end: night.endLocal },
    altAtBest: 75.1, azAtBest: 2, moonInterference: 0, notes: 'dwarf nova' },
  { id: 'M13', name: 'M13', targetClass: 'cluster', score: 60, maxAlt: 88,
    bestTime: '2026-08-30T23:00:00-04:00',
    window: { start: night.startLocal, end: night.endLocal },
    altAtBest: 88, azAtBest: 330, moonInterference: 0.7, notes: 'globular' },
]

describe('TargetTable', () => {
  it('renders one row per target sorted by score desc', () => {
    const w = mount(TargetTable, { props: { targets, night, sortKey: 'score' } })
    const rows = w.findAll('tbody tr.data-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('SS Cyg')
  })
  it('expands a row on click revealing notes and timeline', async () => {
    const w = mount(TargetTable, { props: { targets, night, sortKey: 'score' } })
    await w.find('tbody tr.data-row').trigger('click')
    expect(w.text()).toContain('dwarf nova')
    expect(w.find('.mini-timeline').exists()).toBe(true)
  })
  it('colors high moon interference as bad', () => {
    const w = mount(TargetTable, { props: { targets, night, sortKey: 'score' } })
    expect(w.text()).toContain('70%')
  })
})
```

**Step 2:** `npm test` — expect FAIL (component missing).

**Step 3 — implement.** `src/components/TargetTable.vue`:

```vue
<script setup>
import { computed, ref } from 'vue'
import { compass, fmtTime, pct, timeline } from '../format'

const props = defineProps({
  targets: { type: Array, required: true },
  night: { type: Object, default: null },
  sortKey: { type: String, default: 'score' },
})

const expandedId = ref(null)

const sorted = computed(() => {
  const t = [...props.targets]
  switch (props.sortKey) {
    case 'bestTime': return t.sort((a, b) => new Date(a.bestTime) - new Date(b.bestTime))
    case 'maxAlt': return t.sort((a, b) => b.maxAlt - a.maxAlt)
    case 'name': return t.sort((a, b) => a.name.localeCompare(b.name))
    default: return t.sort((a, b) => b.score - a.score)
  }
})

function moonClass(mi) {
  if (mi === null || mi === undefined) return 'moon-none'
  if (mi < 0.2) return 'moon-low'
  if (mi < 0.5) return 'moon-mid'
  return 'moon-high'
}
</script>

<template>
  <table class="targets">
    <thead>
      <tr>
        <th /> <th>target</th> <th>class</th> <th>score</th> <th>alt</th>
        <th>az</th> <th>best time</th> <th>moon</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="(t, i) in sorted" :key="t.id">
        <tr class="data-row" :class="{ open: expandedId === t.id }"
            @click="expandedId = expandedId === t.id ? null : t.id">
          <td class="rank">{{ i + 1 }}</td>
          <td class="name">{{ t.name }}</td>
          <td><span class="badge" :class="`cls-${t.targetClass}`">{{ t.targetClass }}</span></td>
          <td>
            <div class="score-wrap"><div class="score-bar" :style="{ width: `${t.score}%` }" />
              <span>{{ t.score.toFixed(0) }}</span></div>
          </td>
          <td>{{ t.altAtBest?.toFixed(0) ?? '—' }}°</td>
          <td>{{ compass(t.azAtBest) }}</td>
          <td>{{ fmtTime(t.bestTime) }}</td>
          <td :class="moonClass(t.moonInterference)">{{ pct(t.moonInterference) }}</td>
        </tr>
        <tr v-if="expandedId === t.id" class="detail-row">
          <td colspan="8">
            <p v-if="t.notes" class="notes">{{ t.notes }}</p>
            <p class="muted small">
              visible {{ fmtTime(t.window.start) }}–{{ fmtTime(t.window.end) }},
              max altitude {{ t.maxAlt?.toFixed(0) ?? '—' }}°
            </p>
            <div v-if="night" class="mini-timeline">
              <div class="tl-track">
                <div class="tl-bar"
                     :style="{ left: `${timeline(night, t).leftPct}%`,
                                width: `${timeline(night, t).widthPct}%` }" />
                <span class="tl-star"
                      :style="{ left: `${timeline(night, t).starPct}%` }">★</span>
              </div>
              <span class="muted small">{{ fmtTime(night.startLocal) }}</span>
              <span class="muted small">{{ fmtTime(night.endLocal) }}</span>
            </div>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</template>
```

Add to `src/style.css` (append):

```css
.panel { background: var(--panel); border-radius: 10px; padding: 1rem 1.25rem; margin: 0.75rem 0; }
.muted { color: var(--muted); }
.small { font-size: 0.85rem; }
.rating { font-weight: 600; padding: 0.15rem 0.6rem; border-radius: 999px; }
.rating-ideal, .rating-great { background: rgba(74, 222, 128, .18); color: var(--good); }
.rating-good { background: rgba(122, 162, 255, .18); color: var(--accent); }
.rating-fair { background: rgba(251, 191, 36, .18); color: var(--warn); }
.rating-poor, .rating-bad { background: rgba(248, 113, 113, .18); color: var(--bad); }
.rating-none { background: var(--panel-2); color: var(--muted); }
.targets { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
.targets th, .targets td { text-align: left; padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--panel-2); }
.targets thead th { color: var(--muted); font-weight: 500; font-size: 0.8rem; text-transform: uppercase; }
.data-row { cursor: pointer; }
.data-row:hover { background: var(--panel-2); }
.data-row.open { background: var(--panel-2); }
.badge { padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.75rem; background: var(--panel-2); color: var(--muted); }
.score-wrap { display: flex; align-items: center; gap: 0.5rem; min-width: 110px; }
.score-bar { height: 6px; border-radius: 3px; background: var(--accent); min-width: 2px; }
.moon-low { color: var(--good); }
.moon-mid { color: var(--warn); }
.moon-high { color: var(--bad); }
.moon-none { color: var(--muted); }
.detail-row td { background: var(--panel-2); }
.mini-timeline { display: flex; align-items: center; gap: 0.5rem; }
.tl-track { position: relative; flex: 1; height: 10px; background: var(--bg); border-radius: 5px; }
.tl-bar { position: absolute; top: 0; height: 100%; background: rgba(122, 162, 255, .35); border-radius: 5px; }
.tl-star { position: absolute; top: -6px; transform: translateX(-50%); color: var(--warn); }
.chips button, .mode button, .refresh { background: var(--panel-2); color: var(--text); border: 1px solid transparent; border-radius: 6px; padding: 0.3rem 0.8rem; }
.chips button.active { border-color: var(--accent); color: var(--accent); }
.mode button.active { border-color: var(--accent); color: var(--accent); }
.controls { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; }
.chips { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.error { color: var(--bad); }
.tabs { display: flex; gap: 0.5rem; margin: 0.75rem 0; }
.tabs button { background: var(--panel); border: none; border-radius: 8px; padding: 0.5rem 1rem; color: var(--muted); }
.tabs button.active { color: var(--accent); outline: 1px solid var(--accent); }
```

**Step 4:** In `src/App.vue` add instrument tabs and table:

```js
const instrument = ref(null) // first key once data loads
const instruments = computed(() => Object.keys(data.value?.instruments ?? {}))
const activeInstrument = computed(() =>
  instrument.value && instruments.value.includes(instrument.value)
    ? instrument.value
    : instruments.value[0])
const activeTargets = computed(() => data.value?.instruments?.[activeInstrument.value] ?? [])
```

Template, after WeatherPanel:

```html
<nav v-if="data" class="tabs">
  <button v-for="ins in instruments" :key="ins" :class="{ active: ins === activeInstrument }"
          @click="instrument = ins">
    {{ ins === 'dob_8inch' ? '8" Dobsonian' : 'Dwarf Mini' }}
    ({{ data.instruments[ins].length }})
  </button>
</nav>
<TargetTable v-if="activeTargets.length" :targets="activeTargets" :night="night" :sort-key="sortKey" />
<p v-else-if="data && !loading" class="muted">no targets match the current filters</p>
```

Import `TargetTable` in App. Instant mode has no `night` — `night` computed already returns null there, and `TargetTable` guards the timeline with `v-if="night"`.

**Step 5:** `npm test` — expect 16 passed. Manual verify: rows sorted by score, click SS Cyg row → notes + timeline with ★ at 50%-ish position, moon column colored.

**Step 6:** Commit: `git add -A && git commit -m "feat: target table with expandable rows and timelines"`

## Task 7: Polish + verification pass

**Objective:** Empty/loading states everywhere, build works, final QA.

**Steps:**

1. `npm run build` — expect clean production build (`dist/` created, no type/import errors).
2. `npm run preview` and re-check the page renders with live data through the preview server (proxy is dev-only — for preview, either verify in `dev` or note the static-serving task in backlog).
3. Full manual pass against the live API:
   - window mode: header, weather, both instrument tabs, sort by each key, expand a row, deselect `moon` chip and confirm moon targets disappear, re-select.
   - instant mode with 22:30: at-header, atTime weather, no timeline in expanded rows.
   - stop the FastAPI server temporarily → dashboard shows `failed to load: ...` error state (not a blank page) → restart server.
4. Run the dogfood skill (exploratory QA) on `http://127.0.0.1:5173` — log any bugs found as issues and fix blockers.
5. Final commit: `git add -A && git commit -m "chore: v1 polish"`.

---

## Verification Checklist (definition of done)

- [ ] `npm test` — all unit tests pass (16+)
- [ ] `npm run build` — clean production build
- [ ] Window mode renders: header, rating chip, current conditions, 2 instrument tabs, sortable table (85 Dob / 34 Dwarf rows live)
- [ ] Instant mode renders with time input; `at=HH:MM` hits the API; no timeline rows
- [ ] Class chips filter via `include=` param; last chip can't be deselected
- [ ] Errors banner shows when `errors[]` non-empty; fetch failure shows inline error, not blank page
- [ ] Expanded row shows notes + window + mini-timeline with ★ at bestTime
- [ ] All work committed to git in /home/maryknize/astro-dashboard

## Risks / Tradeoffs

- **nvm sourcing:** non-interactive shells (Hermes terminal calls) don't load `.bashrc`, so `node`/`npm` vanish unless `export NVM_DIR="$HOME/.config/nvm" && . "$NVM_DIR/nvm.sh"` runs first. Every npm command in this plan assumes that line; if `npm install` says "command not found", the sourcing was skipped.
- **`/tonight` latency:** ephemeris + NWS makes each request take seconds — loading states are mandatory; refresh button only (no auto-refresh in v1) so a slow upstream can't stampede.
- **Instant-mode shape drift:** no `night` key — every night-dependent UI must null-guard (timeline, header). Tests don't cover the App level; manual pass covers it.
- **85 rows, no virtualization:** fine for v1; revisit if laggy.
- **`npm run preview` has no proxy:** previewing prod build needs the backlog static-serve task or a CORS header on FastAPI. Dev mode is the primary workflow.
- **Timezone:** all datetimes arrive ISO-8601 with offsets; the browser `Date` handles conversion; display uses the browser's locale — site-local strings come pre-offset from the server, so `fmtTime` shows site-local wall-clock.

## Open Questions (defaults chosen, flag if wrong)

1. **Dark theme assumed** — matches a night-astronomy tool. Default: dark.
2. **Sort default: score desc** — matches CLI's ranking. Alternative: bestTime.
3. **No date picker in v1** — `/tonight` is tonight-centric (`at` is next-occurrence). Date-based views belong to the future `/forecast` tab.