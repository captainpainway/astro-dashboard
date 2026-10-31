// Fetches the Wikipedia summary of every Tonight target and every lunar feature that names an article, and writes
// them to src/engine/wikiSummaries.json, so the app shows them offline and never waits on Wikipedia (rarely read
// lunar articles took ~0.5 s live). A title with no article is stored as null. Run: node scripts/fetch-wiki-summaries.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const API = 'https://en.wikipedia.org/api/rest_v1/page/summary/'
const HEADERS = { 'User-Agent': 'astro-dashboard/0.1 (https://github.com/captainpainway/astro-dashboard)' }
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const out = new URL('../src/engine/wikiSummaries.json', import.meta.url)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Tonight's titles, as wikiTitle() in src/engine/targetInfo.js names them (tests/targetInfo.test.js checks they match).
const PLANETS = ['Mercury (planet)', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']
const catalogs = read('../src/engine/catalogs.json')
const fixedTitle = (id) => id.replace(/^M(\d+)$/, 'Messier $1')
const tonight = [...PLANETS, 'Moon', ...[...catalogs.messier, ...catalogs.ngc].map((o) => fixedTitle(o.id)),
  ...catalogs.watchlist.map((s) => fixedTitle(s.designation))]
const lunar = read('../src/engine/lunar.json').map((f) => f.wiki).filter(Boolean)

async function summary(title) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(API + encodeURIComponent(title.replaceAll(' ', '_')), { headers: HEADERS })
    if (res.status === 429) {
      await sleep((Number(res.headers.get('retry-after')) || 30) * 1000 + 1000)
      continue
    }
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`${title}: Wikipedia ${res.status}`)
    const d = await res.json()
    if (d.type !== 'standard' || !d.extract) return null // disambiguation pages and the like
    return { title: d.title, extract: d.extract, thumbnail: d.thumbnail?.source ?? null,
             url: d.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(d.title)}` }
  }
  throw new Error(`${title}: still rate-limited`)
}

const titles = [...new Set([...tonight, ...lunar])].sort()
const result = {}
for (const title of titles) {
  result[title] = await summary(title)
  process.stdout.write(result[title] ? '.' : 'x')
  await sleep(300)
}
writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`)
const missing = titles.filter((t) => !result[t])
console.log(`\n${titles.length} titles → ${out.pathname}; no article: ${missing.join(', ') || 'none'}`)
