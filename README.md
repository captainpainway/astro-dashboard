# astro dashboard

A browser dashboard that answers "what should I point my telescope at tonight?" for any US location.
It rates the night from the National Weather Service forecast, then ranks deep-sky objects, planets and
lunar features that are well placed and above your horizon.

**Live site:** https://captainpainway.github.io/astro-dashboard/

Everything runs in the browser. There is no server and no account, and your location never leaves
your device except as coordinates sent to the NWS and Open-Meteo APIs.

## What's in it

| Page | Shows |
| --- | --- |
| **home** | A live, draggable WebGL panorama of tonight's sky with a sunset-to-sunrise scrubber, plus a summary of conditions, the best window and top picks |
| **sky** | The same sky full size, with layers, search and every target in tonight's plan |
| **tonight** | Ranked targets for an 8″ Dobsonian and a Dwarf Mini: score, altitude and azimuth, best time, Moon interference, and a short Wikipedia summary |
| **hourly** | Hour-by-hour cloud cover, temperature and wind, with an observing rating |
| **forecast** | A multi-night outlook, sunset to sunrise |
| **lunar** | A lit Moon map and a checklist of lunar features that the terminator makes worth a look tonight |

The default location is Big Bend National Park, TX. Use **change** in the header to search a US city or
ZIP code, use your browser's location, or enter `lat, lon`. The choice is saved in your browser's
`localStorage`.

## How it works

- **Astronomy:** [astronomy-engine](https://github.com/cosinekitty/astronomy) computes Sun, Moon and
  planet positions, twilight and Moon phase in the browser. Results were checked against JPL Horizons
  (see `tests/fixtures/`).
- **Weather:** the browser calls `api.weather.gov` directly (CORS-enabled, no key). Responses are
  cached in memory until you press refresh.
- **Catalogs:** Messier objects, a selection of NGC objects, a variable-star watchlist, and about 100
  lunar features are bundled as JSON in `src/engine/`.
- **Rendering:** Vue 3 and Vite. The sky and the Moon are drawn with raw WebGL; GSAP handles motion.

## Run it locally

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # vitest
npm run build    # output in dist/
npm run preview  # serve dist/ at http://localhost:4173
```

The build targets GitHub Pages and is served from `/astro-dashboard/`. For a different path, such as a
custom domain, set `BASE_PATH`:

```sh
BASE_PATH=/ npm run build
```

Every push to `main` is tested, built and deployed by `.github/workflows/deploy.yml`.

To refresh the bundled Wikipedia summaries: `node scripts/fetch-wiki-summaries.mjs`.

## Credits and licence

The code is [MIT](LICENSE) licensed. Star data, the Moon texture, the background image, lunar feature
names, Wikipedia text and the libraries keep their own terms. See [`public/credits.txt`](public/credits.txt),
which is also served with the site at `/credits.txt`.
