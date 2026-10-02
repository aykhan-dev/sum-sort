# Sum Sort roadmap: from polished prototype to attention catcher

Owner view, written to be worked down top to bottom. Each item ships on its own: built, tested, pushed.

## Where the game stands (v0.7)

Strong core. The feel is polished: glossy 3D candy, a celebration ladder, finger-down input, and boosters that arrive one at a time. Levels come from a solver, with a fail-rate curve tuned per chapter. 100 stored levels, then endless generated ones.

What it lacks is a reason to look up, a reason to come back, and a reason to tell anyone:

| Gap | Symptom |
| --- | --- |
| Moment-to-moment juice | A good run of seals feels the same as a slow one. Nothing rewards flow. |
| Return loop | Nothing is new tomorrow. No daily puzzle, no streak. |
| Spread | No way to show off a result. A shared link has no preview. |
| Visible goals | Home shows one number. Nothing says how close the next chapter, booster or reward is. |
| Long-term collection | Stars pile up but buy nothing. |
| App feel | No install, no offline, no icon. |

## North star and guardrails

**North star:** day-1 and day-7 return rate. Proxies we can see without a backend: daily streak length, levels per session, share taps (all counted locally, see M1).

**Guardrails (from the Taste File, kept):**
- One new rule per chapter, the ten fail-proof Match levels, model fail rate capped at 65%.
- Forward-only progression, no level list.
- Nothing ever covers the board during play; messages go to the coach strip.
- Every control 48 px or larger; contrast tokens stay; `prefers-reduced-motion` is honoured by every new animation.
- No dark patterns: no fake timers, no paywalls, no nag screens. The rewarded-ad stand-in stays a stand-in.

## Backlog, in build order

Impact and effort are 1–5. Order weighs impact on the north star against effort and risk.

| # | Item | Why it catches attention | Impact | Effort | Status |
| --- | --- | --- | --- | --- | --- |
| E1 | Fast unit tests, `meta.mjs` for pure meta logic, CI on push | Every feature below lands with tests in seconds, not minutes | enabler | 2 | done |
| F1 | **Combo callouts**: quick seals chain into "Sweet! → Yummy! → Sugar rush!" words, rising pitch, camera punch | Rewards flow; the single biggest "feel" upgrade per line of code | 5 | 2 | done |
| F2 | **Daily Puzzle + streak**: one seeded board per day, same for everyone, Monday easy to Sunday hard; flame streak on home | The return loop. Gives a reason to open the game every day | 5 | 3 | done |
| F3 | **Share result**: Wordle-style text card (stars, moves vs par, streak, jar emoji row) via the share sheet or clipboard | Free spread; players recruit players | 5 | 1 | done |
| F4 | **Journey on home**: chapter progress bar, "next: Split in 3 levels", daily card | Goal-gradient effect: near goals pull players forward | 4 | 2 | done |
| F5 | **Star rewards**: star milestones open a candy box that unlocks counter themes and jar lids | Turns stars into a collection; long-term pull | 4 | 3 | todo |
| F6 | **Level intro and last-jar moment**: a quick level banner; the final seal slows and zooms | Builds and releases tension every level | 3 | 2 | todo |
| F7 | **Install and share preview**: web app manifest, icons, offline service worker, Open Graph image | Feels like an app; links look good where they are posted | 3 | 2 | todo |
| F8 | **Attract mode**: the board behind the home wash plays itself | Motion on the first screen hooks a new visitor | 3 | 2 | todo |
| F9 | **Music**: soft procedural candy-shop loop, its own toggle | Mood and session length | 2 | 2 | todo |
| F10 | **Sugar Rush mode**: timed run of small boards, best score | A second way to play for players who finish the day's daily | 3 | 4 | later |
| M1 | **Local metrics**: counts of sessions, streak days, shares, levels per session, kept on the device and shown in a debug panel | So later tuning has numbers | 2 | 1 | later |

## How each item is done

1. Pure rules go in `src/logic.mjs` or `src/meta.mjs` with unit tests (`npm run test:unit`).
2. Rendering and UI go in `src/page.src.html`; `npm run build` writes `index.html`.
3. The headless playtest (`npm test`) passes, and a screenshot of the new surface is looked at, phone size.
4. Committed and pushed with the roadmap row set to done.

## Iteration log

| When (UTC) | Item | Result |
| --- | --- | --- |
| 21:01 | E1 | Unit tests (7) run in about 1 s; `npm run check`; CI workflow; build inlines several pure modules. |
| 21:16 | F1 | Combo chain = seals in a row with only stack-to-jar moves (exactly what a par game is). From the 2nd seal a wordmark-style word pops over the jar (Sweet → Tasty → Yummy → Delicious → Sugar rush), with a sparkle that climbs in pitch and a 1–4% camera lean. Gold words and extra sparks from the 5th. Words are page text: sharp, sized to fit a 390 px phone, never take a tap. Reduced motion: fade only, no lean. First try was a 3D sprite: too small and pale on a phone, replaced. |
| 21:35 | F2 | Daily puzzle from level 19 (first Sums level, so it asks for nothing untaught; locked card says how far to go). Board seeded from the date text, Monday easy → Sunday hard. On-device generation proved too slow (up to 3 s desktop) and biased about 8 points harder than measured (closest-of-many noisy estimates), so a year of dailies is made offline with an independent 6,000-play re-check: every weekday within 5 points of target, max 0.64 under the 0.65 cap, 25 KB. Streak = dailies on consecutive days. Levels and level stars untouched. |
| 21:39 | F3 | Wordle-style result: title and stars, moves against par, boosters, one square per seal in order (🟩 clean, 🟨 combo, 🟪 after a reshuffle), streak, link. Share sheet on touch devices, clipboard elsewhere, a textarea copy as the last resort. On the daily, Share is the main button; on a level, a quiet corner button; the done daily card shares too. |
| 21:44 | F4 | Home shows the chapter as a segmented bar (one segment per level, the waiting one pulsing) with "3 of 12", and the next thing that opens: "Up next: the Split booster at level 21". The win card shows the same bar with the cleared level filling in. Endless levels count in runs of ten. "At level N" instead of "in N levels": the count was ambiguous on home, where the level shown is the one about to be played. A unit test keeps the milestones in step with the chapters, booster unlocks and the daily. |

