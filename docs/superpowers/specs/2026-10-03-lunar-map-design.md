# Lunar map

Branch: `lunar-map`. Status: draft for review.

## Outcome

`LunarView` gets a Moon disc above the feature table:

- Rendered for **now**, north-up, with the terminator at the real phase and the real libration.
- One clickable dot per feature that has `lat`/`lon`, only on the Earth-facing hemisphere.
- Clicking a dot opens a tooltip with the feature name. Click elsewhere or Esc closes it.
- The tier tabs (all / eyes-only / binoculars / telescope) filter the dots.
- No WebGL: the map is not rendered and the table works as before.

## Non-goals

- Time scrubber, zoom/pan, dot-to-table-row linking, observed-state tracking.
- three.js (raw WebGL: one quad, one fragment shader).
- Relief/bump lighting (no heightmap). The albedo texture's baked shading means the terminator shows brightness falloff, not real crater shadows. A LOLA heightmap is a separate decision.
- Sky-accurate rotation (parallactic angle). Possible later toggle.
- Dots for phase-based rows (`kind: 'phase'`, no coordinates).

## Design

**`src/engine/moonview.js`** (pure, no DOM/WebGL):

- `moonView(date)` returns `{ sub: {lat, lon}, earth: {lat, lon} }`: the subsolar point (existing `subsolarPoint`) and the sub-Earth point from `astronomy-engine` `Libration` (convert to the same east-positive selenographic frame).
- `project({lat, lon}, earth)` returns `{ x, y, visible }` in unit-disc coordinates, orthographic, north-up. `visible` is false when the point is on the far side.
- The shader gets the same two points as uniforms and derives the Sun direction in view space (one shared formula with `project`, so dots and shading cannot disagree).

**`src/components/MoonMap.vue`**:

- Props: `features` (already tier-filtered by `LunarView`). Reads `now` once on mount.
- Canvas with the shader: sphere from `x²+y²≤1`, normal `(x, y, √(1-x²-y²))`, equirectangular texture lookup via the inverse of `project`, Lambert term against the Sun direction with a soft terminator, slight limb darkening.
- Dot overlay: absolutely positioned buttons (keyboard-focusable, `aria-label` = name) from `project`; hidden when `!visible`.
- One tooltip element showing the selected feature's name.
- WebGL missing or context creation failure: render nothing.

**`LunarView.vue`**: mount `<MoonMap :features="shown" />` above the table. Only features with `lat != null` produce dots.

**Asset**: NASA SVS CGI Moon Kit color map (public domain), downsampled to 2048×1024 JPEG, about 1 MB, in `src/assets/moon-2k.jpg`. Credit in a code comment.

## Risks

- **Frame signs.** `subsolarPoint` and `Libration` use different conventions. A sign error flips the terminator or the dots. The projection tests and a visual check against a known phase are the guard.
- **Texture orientation.** The kit's longitude origin and seam must match `lon` (east-positive, 0 at the sub-Earth meridian on average). Verified in the visual check.

## Proof

- `tests/moonview.test.js`: sub-Earth point projects to (0,0); a point 90° from it lands on the limb; a far-side point is not visible; `moonView` sub-solar longitude matches `subsolarPoint` for a fixed date.
- `tests/LunarView.test.js` (extended, WebGL stubbed out): dot count follows the tier filter, no dots for phase rows, clicking a dot shows its name, Esc closes it.
- Browser check (Playwright screenshot) at a known phase: terminator on the correct side, a known feature (e.g. Tycho) under its dot.
- Commands: `npx vitest run tests/moonview.test.js tests/LunarView.test.js`, then `npx vite build --outDir <scratchpad>/dist --emptyOutDir` so no build output lands in the repo (work happens directly on `lunar-map`, no worktree).

## Files

New: `src/engine/moonview.js`, `src/components/MoonMap.vue`, `src/assets/moon-2k.jpg`, `tests/moonview.test.js`.
Edited: `src/components/LunarView.vue`, `tests/LunarView.test.js`.

## Estimate

About 60-80k tokens for implementation, tests and visual verification.
