# Sum Sort

A sorting puzzle on a candy counter: tap a numbered gummy tile, then a glass jar. A jar seals when its tiles add up to the number on its badge. Seal every jar to clear the level.

This is a web prototype (three.js, one HTML page). It opens on a home screen with the current level and a Play button. Progress only moves forward, one level at a time.

## Play

Open `index.html` through any static server:

```
npm run serve        # http://localhost:8080
```

On GitHub Pages: repository Settings → Pages → Deploy from a branch → `main`, folder `/ (root)`. The game is then served at `https://<user>.github.io/<repo>/`.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The built game. Generated, do not edit by hand. |
| `src/page.src.html` | Page source: styles, markup, rendering and game code. |
| `src/logic.mjs` | Pure game logic: solver, fail-rate model, level generator, chapters. |
| `src/meta.mjs` | Pure meta-game logic around the levels (combos, daily puzzle, streaks, sharing). |
| `src/levels.json` | Levels 1–100, generated once and checked by the solver. Later levels are generated on the device. |
| `src/dailies.json` | Daily puzzles for a year from 1 Oct 2026, one per day, checked by the solver. Later days are generated on the device. |
| `scripts/build.mjs` | Inlines the pure modules and levels into the page and writes `index.html`. |
| `scripts/generate-levels.mjs` | Regenerates `src/levels.json` and prints the difficulty curve. |
| `scripts/generate-dailies.mjs` | Regenerates `src/dailies.json` and prints the fail rate per weekday. |
| `tests/unit/` | Unit tests for the pure modules (node's built-in runner, about a second). |
| `tests/playtest.mjs` | Plays the built page in headless Chromium with real touches. |
| `docs/ROADMAP.md` | What gets built next, and why. |
| `src/sw.src.js` | Service worker source. The build stamps its version and writes `sw.js`. |
| `manifest.webmanifest`, `icons/`, `og.png` | Install manifest, app icons and the link-preview image. `scripts/make-art.mjs` draws them from the game. |
| `vendor/three/` | three.js r170 (MIT), so the page needs no CDN for code. |

## Build and test

```
npm run build
npm run test:unit    # pure logic, about a second
npm run check        # build, fail if index.html was stale, unit tests
npm i && npx playwright install chromium && npm test
```

CI (`.github/workflows/ci.yml`) runs `npm run check` and the headless play-test on every push.

## Chapters

| Levels | Chapter | New rule |
| --- | --- | --- |
| 1–10 | Match | One tile per jar, same number. |
| 11–18 | Pairs | Jars need two tiles. |
| 19–30 | Sums | Bigger sums, tiles fit several jars. |
| 31–38 | Frosted | Tiles under the top one are hidden. |
| 39–46 | Ribbons | Some jars open only after others seal. |
| 47+ | Mixed | Everything at once. |

Boosters arrive one at a time: Undo (level 11), Hint (13), +1 Jar (15), Split (21).

## Daily puzzle

From level 19 the home screen offers one extra board a day, the same for everyone on that calendar date. It uses only the rules of the first three chapters. Monday is easy and the week climbs to Sunday (model fail rate 20% to 60%). Finishing dailies on consecutive days builds a streak. A daily never moves the level progress.

## Sugar Rush

From level 25 a second card sits beside the daily: a minute of quick, small boards with no boosters. A seal scores 10 points times the combo chain, a cleared board adds 25 points and 8 seconds (up to 90 on the clock), and a dead end can be skipped for 5 seconds. Boards grow as the run goes on; every run is new. The best score is kept and can be shared.

## Stars and candy boxes

Stars from levels and dailies open candy boxes at 15, 40, 70, 105, 145, 190 and 240 stars. Each box holds a new counter theme for the room around the board. The star tally on the home screen opens the candy shop.

## Install and offline

Served over https (GitHub Pages), the page registers a service worker: after one visit the game opens and plays with no network, and browsers that support it offer to install it. A new build reaches players on their next visit. Shared links show `og.png` as their preview; its address is set by `SITE` in `scripts/build.mjs`.

## Status

Prototype. Fonts load from Google Fonts. Progress is saved in the browser's local storage only. Tested in a software-rendered headless browser, not yet on real phones.
