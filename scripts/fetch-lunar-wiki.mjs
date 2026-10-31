// Fetches the Wikipedia summary for every lunar feature that names an article (src/engine/lunar.json `wiki`) and
// writes them to src/engine/lunarWiki.json. These articles are rarely read, so Wikipedia's cache misses and a live
// request takes ~0.5 s; shipping the text makes the lunar rows open at once. Run: node scripts/fetch-lunar-wiki.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const API = 'https://en.wikipedia.org/api/rest_v1/page/summary/'
const HEADERS = { 'User-Agent': 'astro-dashboard/0.1 (https://github.com/captainpainway/astro-dashboard)' }
const src = new URL('../src/engine/lunar.json', import.meta.url)
const out = new URL('../src/engine/lunarWiki.json', import.meta.url)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function summary(title) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(API + encodeURIComponent(title.replaceAll(' ', '_')), { headers: HEADERS })
    if (res.status === 429) {
      await sleep((Number(res.headers.get('retry-after')) || 30) * 1000 + 1000)
      continue
    }
    if (!res.ok) throw new Error(`${title}: Wikipedia ${res.status}`)
    const d = await res.json()
    if (d.type !== 'standard' || !d.extract) throw new Error(`${title}: not a standard article (${d.type})`)
    // Same shape as wikiSummary() in src/engine/targetInfo.js returns for a live request.
    return { title: d.title, extract: d.extract, thumbnail: d.thumbnail?.source ?? null,
             url: d.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(d.title)}` }
  }
  throw new Error(`${title}: still rate-limited`)
}

const titles = [...new Set(JSON.parse(readFileSync(src, 'utf8')).map((f) => f.wiki).filter(Boolean))].sort()
const result = {}
for (const title of titles) {
  result[title] = await summary(title)
  process.stdout.write('.')
  await sleep(300)
}
writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`)
console.log(`\n${titles.length} summaries → ${out.pathname}`)
