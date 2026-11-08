# Klepsydra dziecka

A calm, wordless Polish-language hourglass timer for a young child. **Intended for supervised use.** The child watches real sand pour from one glass bulb to the other; a parent sets the duration, the scenery, the sand colour and the safety lock behind a two-second hold gate. There are no digits, scores, badges or countdowns anywhere on the child's screen — time is expressed only as falling sand.

**Try it live:** after deploying to GitHub Pages, `https://<your-login>.github.io/<repo-name>/` (see [GitHub Pages](#github-pages)).

Inspired by the one-control, offline-first, parent-gated philosophy of [BielinskiLukasz/child-train](https://github.com/BielinskiLukasz/child-train), rebuilt around a single object instead of a journey: a wooden hourglass whose sand behaves like sand.

## Purpose

A quiet waiting and transition activity: "jeszcze tyle piasku i sprzątamy", "piasek się przesypie i wychodzimy". The child starts, pauses and restarts the pour with one touch; the hourglass never hurries, never fails and never asks for anything. The only sound is a soft three-strike bell when the last grain lands, and it can be muted with one visible tap.

## Flow

The app is a single full-viewport screen with four phases and two transient gestures:

1. **Idle (`idle`):** the top bulb is full, the bottom bulb is empty, the big button shows a play triangle. The sand surface is perfectly flat — the funnel has not formed yet.
2. **Pouring (`running`):** one touch starts the pour. A narrow funnel opens smoothly in the top surface, a thin grain stream falls from the neck, and a cone of sand grows in the bottom bulb at exactly the rate the top loses it. The button shows pause bars.
3. **Paused (`paused`):** one touch freezes everything mid-grain. The stream disappears, both surfaces hold their exact shapes, and the button shows play again. Nothing decays while paused.
4. **Finished (`done`):** the top bulb is empty, the bottom cone has reached its final height, the stream is gone. A warm glow pulses behind the glass and the hourglass sways gently; the bell strikes three times (if sound is on). The button shows a restart arrow.
5. **Turn (`turning`, 0.7 s):** touching the hourglass or the button when finished rotates the whole instrument 180°. Because the two bulbs are mirror images, the full bottom becomes the full top with no visible jump, and the app returns to `idle`, ready for another round.
6. **Locked nudge (`nudge`, 0.5 s):** if the parent has enabled the button lock, a child's touch on the glass produces only a small side-to-side shake — a gentle "not now" — and the big button stays greyed out with a padlock.

## Controls & Rules

* **One child control, two surfaces:** the hourglass itself and the large round button below it are equivalent. Both call the same `press()` handler: start → pause → resume → turn.
* **Touch-first:** the child never needs a keyboard. The big button is a real `<button>`, so a caregiver can also reach it with `Tab` + `Enter`/`Space`; the glass is a `role="button"` click target for pointers only.
* **No queuing, no acceleration:** each touch toggles exactly one state change. Drumming on the button pauses and resumes repeatedly; it never speeds up the sand or stacks actions. Touches during the 0.7 s turn are ignored.
* **Ignored inputs:** the sky, scenery, sun/moon and title area have no handlers. Long-press context menus, text selection, tap highlights and double-tap zoom are suppressed on the play surface.
* **Real-time clock:** the pour is driven by `performance.now()`, not by frame counting. Hiding the tab does not stop time — when the child returns, the sand is exactly where the real clock says it should be, and the bell rings on the first frame back if the sand finished while away.
* **Parent gate:** the gear at the top right opens settings only after a continuous 2-second hold (a conic progress ring shows the hold). Releasing early cancels it. This is a child-resistant convenience gate, not authentication.
* **One-tap mute:** the speaker at the top left mutes/unmutes the bell in a single action and always shows the current state. It stays available even while the button lock is on.

## The Sand Model

`src/lib/sand.ts` is a small, pure, dependency-free volume solver. Both bulbs are treated as solids of revolution sharing one profile (the bottom is the top mirrored about `y → 480 − y`), so the same radius table serves both.

* The glass wall is the exact cubic Bézier pair used by the SVG artwork; a radius lookup table is sampled every **0.5 px** once at module load.
* Volume is integrated over horizontal slices. For a progress `p ∈ [0, 1]`, the remaining top volume is `V₀ · (1 − p)`; a 30-step bisection finds the surface level, and a second bisection finds the bottom cone apex that holds exactly `V₀ · p`.
* The top funnel depth follows `30 · sin(πp)` — zero at the start, deepest mid-pour, zero again at the end — with a narrow radius (`min(26, 0.4 · R)`) and a rounded profile exponent of 1.3, so it reads as a real crater rather than a notch.
* The bottom pile uses a fixed angle of repose (`PILE_SLOPE = 0.62`, ≈32°), clipped by the glass wall.
* The stream is rendered **only** while `running && 0 < p < 1`; the top path unmounts at `p = 1` and the bottom path at `p = 0`, so an empty bulb can never appear to pour.

| Constant | Value | Meaning |
| --- | --- | --- |
| `TOP_Y` / `NECK_Y` / `BASE_Y` | 72 / 243 / 408 | top of glass, neck, bottom of glass (SVG units) |
| `INITIAL_LEVEL` | 100 | starting sand surface in the top bulb |
| `PILE_SLOPE` | 0.62 | tangent of the sand's angle of repose |
| `MAX_CRATER` / `MAX_CRATER_RADIUS` | 30 / 26 | funnel depth and radius caps |
| `CRATER_PROFILE` | 1.3 | rounded funnel floor exponent |
| `STEP` | 0.5 px | integration slice thickness |

The invariant `top + bottom = V₀` holds to better than 0.02 % across the whole pour, and both volumes are monotonic. `sandVolumes(p)` is exported solely so this can be re-checked (see [Verification](#verification)).

## Dynamic Environment & Atmosphere

* **Three sceneries**, chosen by the parent and applied live without resetting the pour: **Łąka** (meadow), **Kosmos** (space), **Ocean**.
* **Automatic day/night** from the device clock: night is 20:00–06:00, re-evaluated every 30 s. Each scenery has its own day and night sky gradient; the artwork itself is recoloured, not swapped.
* **Night dressing:** 80 softly twinkling stars (2.6 s cycle, random phase), a masked crescent moon with a breathing halo, fireflies over the meadow, and a faint moon shimmer under the sailboat at sea.
* **Day dressing:** a rayed sun with a breathing halo, three cloud banks drifting on 85 s / 100 s / 120 s loops, and small wildflowers in the meadow.
* **Scenery grammar:** the meadow is two hill bands plus one round tree; space is a ringed planet, a mountain silhouette and two craters; the ocean is two wave bands plus a small sailboat. Everything is hand-authored inline SVG in a `0 0 100 100` viewBox with `xMidYMid slice`.
* **Crop-safe composition:** horizons and props sit in the band that survives both portrait and landscape cropping; the sun/moon live in a separate HTML layer (`Celestial`, 72 px, top-right but clear of the gear) so they are never sliced away or hidden behind chrome. The sailboat deliberately sits off-screen on narrow portrait phones and appears on wider screens.
* **Reduced motion:** `prefers-reduced-motion: reduce` stops the stream dash, twinkle, cloud drift, fireflies, sway, nudge and glow pulses. The sand levels and the turn still update, because they are the timer itself, not decoration.

| Theme | Day sky | Night sky | Ground signature |
| --- | --- | --- | --- |
| Łąka | `#4fb2f2 → #d6f2ff` | `#071633 → #1c3a6e` | green hills, tree, flowers / fireflies |
| Kosmos | `#4a3a8c → #a07ad0` | `#02020c → #0d0d2b` | ringed planet, mountains, craters |
| Ocean | `#2f9df0 → #d3f1ff` | `#030f26 → #0d2a4a` | wave bands, sailboat, moon shimmer |

## Parent Controls & Safety

* **Gate:** hold the gear for 2 s. The ring around the gear fills with a wood-brown conic gradient while holding; `pointerup`, `pointerleave` and `pointercancel` all abort it.
* **Button lock (`Blokada przycisków`):** disables start/pause for the child. The big button becomes a grey padlock, and touching the glass only nudges it. The parent gate and the mute button remain reachable so an adult can always unlock or silence.
* **Bell (`Dzwonek na końcu`):** on by default. Synthesised locally with WebAudio — three strikes at 0 s / 0.85 s / 1.7 s, fundamental 1046.5 Hz with inharmonic partials (×2.76, ×5.4, ×8.93) and a 2.4 s exponential decay. No audio files, no music, no ambience. The context is created/resumed on the first child touch to satisfy autoplay policies.
* **Nothing leaves the device:** no backend, no accounts, no ads, no analytics, no third-party requests at runtime.

### Parent Settings

| Setting | Control | Default | Effect |
| --- | --- | --- | --- |
| Czas | presets 1 / 2 / 3 / 5 / 10 / 15 min + slider 1–30 min | 3 min | changing the duration resets the hourglass to a full top bulb |
| Motyw tła | three scenery swatches | Łąka | applies immediately, mid-pour, without resetting |
| Kolor piasku | Złoty · Biały · Różowy · Niebieski | Złoty | recolours sand and stream immediately, without resetting |
| Dzwonek na końcu | toggle | on | enables/disables the completion bell |
| Blokada przycisków | toggle | off | child cannot start, pause or restart; nudge feedback only |
| Reset | button | — | returns to `idle` with a full top bulb, no turn animation |

All five preferences persist in `localStorage` (`hg2-min`, `hg2-sand`, `hg2-sound`, `hg2-lock`, `hg2-theme`). The running timer itself is intentionally **not** persisted: a reload always opens a calm, full hourglass.

## Phones, Tablets & PWA

The play surface is `fixed inset-0` with `touch-action: manipulation`, `overscroll-behavior: none`, no tap highlight, no callout and a suppressed context menu. The hourglass scales with the viewport (`56vh`, capped at 540 px), the round action button is 96 px, and the two top controls are 56 px — all comfortably finger-sized. The viewport meta locks accidental pinch-zoom (`maximum-scale=1`) and respects safe areas (`viewport-fit=cover`).

The parent panel is a centred sheet (`max-w-md`, `max-h-92vh`) that scrolls with its own amber-on-cream scrollbar and a custom amber range slider, so it stays usable on small phones without clipping.

`public/manifest.webmanifest` declares `display: standalone`, `orientation: portrait`, Polish `lang`, and `#0b1e3f` theme/background colours with a maskable PNG icon. `public/sw.js` precaches the shell (`./`, `index.html`, `icon.png`, manifest), serves cache-first with runtime caching, and falls back to the cached shell for navigations when offline. Service workers require HTTPS or localhost — GitHub Pages provides this automatically. To ship an update, bump `CACHE` (`klepsydra-v1`) so old caches are cleaned on activate.

## Home Page UI Reference

There is no routing; one screen, one overlay. Markup and logic live in `src/App.tsx`, the sand solver in `src/lib/sand.ts`, and all motion/scrollbar styling in `src/index.css` beside Tailwind utilities.

### Design principles (do not break)

* **One child control.** Only the glass and the round button act on the timer. Everything else is decorative or parent-only.
* **No numbers for the child.** Digits exist only inside the parent panel. Time is sand, nothing else.
* **The sand must conserve.** Never animate the two bulbs independently; always derive both from `computeSand(p)`.
* **Nothing urgent.** No countdown text, no progress bar, no red alarm. Completion is a warm glow, a sway and a soft bell.
* **Wood, glass, sand.** The palette belongs to the object: warm wood browns, cream glass highlights, four sand families, amber parent chrome, and scenery skies that carry the day/night mood.

### Art style

The hourglass is a realistic wooden instrument drawn as inline SVG (`viewBox 0 0 320 478`): grained wooden discs with screw dots, three posts (one behind the glass), gradient glass with soft blurred white highlights, and sand rendered as clipped surfaces with a falling grain stream. The only filters in the app are the glass highlight blur (`feGaussianBlur 3`) and the CSS glow behind the finished hourglass; the scenery uses flat fills and gradients only.

### Palette

| Family | Representative values | Used for |
| --- | --- | --- |
| Wood | `#a5713f` `#7c4f28` `#96622f` `#6b4226` `#b07f4a` | discs, posts, grain, hold ring |
| Ink / outline | `#4a3220` `#2e1a0a` | glass rims, grain lines, screws |
| Glass | white at 6–38 % opacity | bulb body and highlights |
| Sand – Złoty | `#f6cf6a` `#eebd45` `#c98a1f` | default sand and stream |
| Sand – Biały | `#fdfdf8` `#f2efe2` `#cfc9b4` | pale sand |
| Sand – Różowy | `#ffc2d4` `#ff9ebb` `#e06a92` | pink sand |
| Sand – Niebieski | `#aee3ff` `#7cc7f5` `#3f97d6` | blue sand |
| Parent amber | `#b45309` `#d97706` `#fde68a` `#fef3c7` | buttons, toggles, slider, scrollbar |
| Sun / moon | `#ffec8a` `#ffdf70` / `#f6f2d8` | celestial layer |
| Meadow life | `#5cab41` `#3f8f2e` `#d9f26a` `#ff8fb5` `#ffd94d` | hills, fireflies, flowers |

### Screen regions

| Region | Element | Behaviour | Audience |
| --- | --- | --- | --- |
| Scenery | `<svg viewBox="0 0 100 100">`, `aria-hidden` | sky, stars/clouds, theme ground; no handlers | none |
| Celestial | HTML layer, `top-5 right-24`, 72 px, `pointer-events-none` | sun or crescent moon with breathing halo | none |
| Mute | round `<button>`, top-left, 56 px, `aria-pressed` | one-tap bell mute, persists | parent / child |
| Gear | round `<button>`, top-right, 56 px, conic hold ring | 2 s hold opens the parent panel | parent |
| Hourglass | `role="button"` click target, `56vh` | start / pause / resume / turn; nudge when locked | **child** |
| Action button | round `<button>`, 96 px, amber gradient | same `press()`; padlock when locked | **child** |
| Parent panel | fixed overlay `z-30`, blurred scrim | duration, theme, sand, bell, lock, reset | parent |

### State

| State | Set when | Visual effect |
| --- | --- | --- |
| `phase = idle` | load, reset, after turn | full top, empty bottom, play icon |
| `phase = running` | touch from idle/paused | funnel + stream + growing cone, pause icon |
| `phase = paused` | touch while running | frozen surfaces, no stream, play icon |
| `phase = done` | `elapsed ≥ total` | empty top, full cone, glow + sway, restart icon, bell |
| `turning` | touch while done | 0.7 s 180° rotation, then `idle` |
| `nudge` | touch while locked | 0.5 s side shake, nothing else |
| `locked` | parent toggle | grey padlock button, glass nudges only |
| `night` | local hour < 6 or ≥ 20 | night skies, stars, moon, fireflies/shimmer |
| `holdP` | gear pointer held | conic progress ring 0–360° |

### Stacking order

Scenery (auto) → Celestial (5) → play column (10) → mute & gear (20) → parent panel (30). Keep new decoration below 10 and anything tappable at 20 or above.

### Responsive behaviour

The layout is fluid rather than breakpoint-driven: the hourglass uses `vh` sizing, the scenery uses `slice` cropping with a crop-safe horizon band, and the parent panel scrolls internally. Verified at 390 × 844 (portrait phone) and 1440 × 900 (desktop) with no overflow, clipping or unreachable controls. The sailboat and some meadow flowers are intentionally outside the narrow portrait crop.

### Motion vocabulary

Stream dash 0.3 s (only while pouring) · twinkle 2.6 s · clouds 85–120 s · fireflies 5 s · completion sway 1.4 s · glow pulse · locked nudge 0.5 s · turn 0.7 s `cubic-bezier(.45,0,.2,1)` · button press sinks 8 px and loses its shadow. Nothing flashes; the fastest loop in the app is the sand stream, and it exists only while sand is actually falling.

### Adding to the screen safely

1. Put decoration in `Scene` or `Celestial`; keep it `aria-hidden` and handler-free.
2. Put any new child-facing behaviour behind the same single `press()` path, or behind the parent gate.
3. Derive sand geometry only from `computeSand`; never hand-animate a bulb.
4. Colour new chrome from the wood/amber families and test it in both day and night skies.
5. Re-check the reduced-motion block and the portrait crop after adding motion or props.

## Run Locally

```bash
npm install
npm run dev
```

## Standalone HTML Build

```bash
npm run build
npm run preview
```

`vite-plugin-singlefile` inlines the whole app into `dist/index.html` (~245 kB), which also works opened directly from disk. The PWA extras (`sw.js`, manifest, icon) are copied alongside it; installation and offline caching require serving the folder over HTTPS or localhost.

## GitHub Pages

The repository ships `.github/workflows/deploy.yml`: push to `main` (or run the workflow manually) → `npm ci && npm run build` → upload `dist` → deploy with `actions/deploy-pages`.

1. Create the repository and push this project.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`; the app publishes at `https://<your-login>.github.io/<repo-name>/`.

All asset paths are relative (`sw.js`, `manifest.webmanifest`, `icon.png`, `start_url: "."`), so the app works unchanged in a repository subpath.

## Implementation

* `src/App.tsx` — phases and the single `press()` handler, monotonic RAF timer, turn/nudge gestures, 2 s parent gate, WebAudio bell, `Scene`, `Celestial`, `Hourglass`, `ParentPanel`, and localStorage persistence.
* `src/lib/sand.ts` — pure volume-conserving sand solver: Bézier radius table, slice integration, bisection for surface level and pile apex, SVG surface paths, and the `sandVolumes` test export.
* `src/index.css` — Tailwind entry plus the app's motion vocabulary, parent-panel scrollbar and range slider, and the reduced-motion fallback.
* `public/manifest.webmanifest`, `public/sw.js`, `public/icon.png` — installable PWA shell and offline cache.
* `.github/workflows/deploy.yml` — GitHub Pages build and deploy.
* `index.html` — Polish metadata, viewport/safe-area rules, manifest and icon links.

## Privacy

No backend, cookies, ads, analytics or third-party runtime requests. Five preference values live in `localStorage` on the device; the timer state is memory-only. The service worker caches only the application shell and icon so the app can reopen offline. All audio is synthesised locally; no audio files are fetched. No webfonts are downloaded — type falls back through the local stack `"Baloo 2", "Comic Sans MS", system-ui`.

## Verification

Performed in Chromium (Playwright) against the built app:

* Full one-minute loop: start → pause (surfaces frozen, stream hidden) → resume → completion (top unmounted, stream gone, bell path) → 180° turn → full top again.
* Sand invariant: `top + bottom = V₀` within 0.02 % and monotonic transfer over 1 000 sampled progress values; no surface jump at `p → 0`.
* Parent gate (2 s hold ring), lock (disabled button + nudge), mute persistence, theme/sand live switching, and preference reload.
* Layouts at 390 × 844 and 1440 × 900: no horizontal/vertical overflow, no clipped controls, zero console errors.

The volume invariant can be re-checked at any time:

```bash
npx esbuild src/lib/sand.ts --bundle --format=cjs --outfile=/tmp/sand.cjs
node -e "const {sandVolumes}=require('/tmp/sand.cjs');let e=0;for(let i=0;i<=1000;i++){const v=sandVolumes(i/1000);e=Math.max(e,Math.abs(v.total-v.initial)/v.initial)}console.log('max error %',(e*100).toFixed(4))"
```

There is no committed automated test suite; the checks above were run as scripted browser sessions during development.

## Credits

Original inline SVG artwork and sand physics are in the source. Interface icons are [Lucide](https://lucide.dev) (ISC). Built with React, Vite and Tailwind CSS. The one-control, parent-gated, offline-first design follows the spirit of [BielinskiLukasz/child-train](https://github.com/BielinskiLukasz/child-train).
