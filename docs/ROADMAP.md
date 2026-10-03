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
- Forward-only progression, no level list. (A win card may offer its own level again for three stars; once the player moves on, the level is behind them.)
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
| F5 | **Star rewards**: star milestones open a candy box that unlocks counter themes | Turns stars into a collection; long-term pull | 4 | 3 | done |
| F6 | **Level intro and last-jar moment**: the level number pops; the last jar is singled out; the final seal slows and zooms | Builds and releases tension every level | 3 | 2 | done |
| F7 | **Install and share preview**: web app manifest, icons, offline service worker, Open Graph image | Feels like an app; links look good where they are posted | 3 | 2 | done |
| F8 | **Living motif**: home's "2 + 3 = 5" plays the game on a loop (was: the board behind the wash plays itself) | Motion on the first screen hooks a new visitor and teaches the rule in 3 seconds | 3 | 1 | done |
| F9 | **Music**: soft procedural candy-shop loop, its own toggle | Mood and session length | 2 | 2 | done |
| F10 | **Sugar Rush mode**: timed run of small boards, best score | A second way to play for players who finish the day's daily | 4 | 4 | done |
| R1 | **Resume boards**: a half-played level survives a detour to the daily or a rush, and closing the tab | Found in review: progress silently lost is the fastest way to lose a player | 4 | 2 | done |
| F11 | **First-move hand**: on the first levels a finger shows "this tile, then this jar" until the first move | The first ten seconds decide whether a new visitor stays | 4 | 1 | done |
| F12 | **Streak milestones**: 3, 7, 14 and 30 days in a row get their own celebration and a mark on the daily card | Makes the streak worth protecting | 3 | 1 | done |
| F13 | **Endless runs**: past level 47, every run of ten levels closes with the chapter-finish celebration | Endless players get a goal every ten levels | 3 | 1 | done |
| F14 | **Keyboard play**: arrows move a ring between jars and stacks, Enter taps, U undoes, H hints; each spot is read out | Desktop visitors from shared links, and players who use a keyboard or a screen reader | 3 | 2 | done |
| F15 | **Challenge links**: a shared Sugar Rush result is a link to the same boards with the score to beat | Every share becomes an invitation to play, not just a brag | 5 | 2 | done |
| F16 | **Streak freeze**: earned on milestones from a week, forgives one missed day by itself | The day a long streak breaks is the day most daily players stop | 4 | 1 | done |
| F17 | **Battery**: a still board is drawn every other frame | A game that drains the phone gets closed | 2 | 1 | done |
| F18 | **Share cards**: where the share sheet takes images, the result goes out as a 1080×1350 picture with the text | Stories and chat feeds favour pictures over text | 4 | 2 | done |
| F19 | **Replay for three stars**: a level cleared under three stars offers "Replay for 3 stars" on its own win card | One more try is the cheapest way to extend a session, and stars feed the candy boxes | 3 | 1 | done |
| F20 | **The daily's week**: the daily win card stamps the day on a Monday-to-Sunday row and names tomorrow's board | A week to complete, and a concrete reason to come back tomorrow | 3 | 1 | done |
| F21 | **Daily links**: a shared daily opens today's board for whoever taps it, even on a first visit; a player who has played it gets the friend's moves against theirs | Every daily share becomes an invitation, as challenge links did for Rush | 5 | 2 | done |
| M1 | **Your record**: levels cleared, 3-star levels, best combo, dailies, best streak, rush best, in the candy shop (was: a debug metrics panel) | Pride, and a number to beat in every mode | 2 | 1 | done |

## Recommended next: needs people, data or a server

These could not be done well from a headless browser overnight, and are the highest-value next steps.

1. **Real phones.** Everything here was tested in software-rendered headless Chromium (about 2 frames a second). Check frame rate, touch feel, audio and haptics on a low-end Android and an iPhone SE before launch.
2. **Measure the north star.** Day-1 and day-7 return, levels per session, share taps, challenge links opened. Needs consented analytics (a privacy-friendly service, or a tiny endpoint).
3. **Localization.** Azerbaijani, Turkish and Russian would widen the home market. Copy lives inline in `src/page.src.html`; extract it into one table first, then translate with native review.
4. **Server features.** A daily leaderboard and challenge-link results ("12 friends beat 340") need a small backend. Daily reminders need push notifications.
5. **Calibrate difficulty with real players.** The fail-rate model is a simulated casual player; real completion data should retune the chapter targets and the daily week.
6. **Repository access.** The Claude GitHub App could not push to `aykhan-dev/sum-sort` (HTTP 403), so this branch was delivered as a git bundle.

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
| 21:55 | F5 | Stars from levels and dailies open candy boxes at 15, 40, 70, 105, 145, 190, 240 (gaps never shrink; all open within the 100 stored levels). Each box holds a counter theme that recolours the sky, counter, page and home veil. The star tally is now a button with a ring filling toward the next box; it opens the Candy shop. A win that crosses a box shows "New counter: Mint Parlour" with one-tap "Use it", and the room changes behind the card. A unit test holds every theme to 7:1 ink and 4.5:1 soft-ink contrast; it caught two shades, which were lightened. |
| 22:05 | F7 | Manifest, icons (rounded, maskable, Apple) and a 1200×630 link preview, all drawn from the game by `scripts/make-art.mjs` (the preview holds a real board mid-combo with "Sweet!" up). Service worker stamped per build: page network-first, assets cache-first, old caches dropped. It registers only on the https build, so the artifact copy and local tests are untouched; the play-test proves offline play with `?sw=1`. An Install chip appears on home once the browser offers it and the player is past level 5. Shared result links now get a proper preview card. |
| 22:22 | F6 | Once one numbered jar is left, its badge turns gold and breathes, a gold ring lights the counter under it, and the room's edges dim. The winning tile flies at 1.9× slow motion while the camera leans in; the lid lands with a double burst and a soft white flash. The level number pops on every new board. Reduced motion: no slow motion, lean or flash. The first cue (pale gold track only) was too faint on a phone and was strengthened. |
| 22:39 | F8 | Swapped the planned 3D attract mode for the cheaper, clearer version: the home motif plays the game on a 5.2 s CSS loop (the 2 hops into the badge, 5 becomes 3, the 3 follows, the badge seals gold with a check). Costs no rendering, so home still stops drawing the board after 1.6 s. Static under reduced motion. Measured home on 360×640 and 375×667: it fit with no slack, so below 700 px tall the level number shrinks to 88 px. Also seeded the play-test's random dead-end search, which had passed on luck and failed once. |
| 22:48 | F10 | Sugar Rush from level 25, on a card beside the daily (home had no room for a third full card: measured at 360×640). 60 s on the clock; a seal scores 10 × chain, a cleared board +25 and +8 s (cap 90), a dead end can be skipped for 5 s; no boosters, no free hints. Boards are made on the device in a few ms (rarely 0.25 s), the next one while the current is played, targets 0.20 → 0.35 fail rate as the run grows (tuned: loose settings gave 0.5–0.6). The clock turns red and ticks under 10 s, stops in a hidden tab; leaving mid-run is not scored. Best score kept, end card shares it. |
| 23:09 | Review | Self-review of the night's diff found 10 issues; 9 fixed here: a rush board won in its last second was lost (now credited on the winning move), Restart let a rush farm points and dodge the skip cost (hidden in a rush), a tied best was shared as "new best", the service worker could store og.png as the offline game, home's "Up next" named the daily or Rush already on screen, the daily generator crashed on short runs, the daily epoch was duplicated, the rush prefetch could stall the clock (now one attempt per idle moment), the leave-home steps were copied three times. The 10th (a half-played level lost on a detour) gets its own item, R1. |
| 23:18 | R1 | A level in progress is written to storage after every change (tiles with their frosting, sealed jars, the spare jar, boosters left, combo, undo steps including splits). Coming back from the daily or a rush, or reopening the tab, rebuilds that exact board; undo still works across the reload. Restart and a win clear it. A snapshot carries the level's content and is dropped if a new version changed that level. |
| 23:52 | F11 | On levels 1–2 and the jar-to-jar lesson, a hand presses the first tile of the plan, glides to its jar and presses again, on a loop, until the player touches the board; it never comes back that level, and never appears over a selection. Static under reduced motion. Found while testing: the play-test's "board cannot be touched through home" tap landed on the Play button (every run logged COVERED), so the next "Play" tap hit the board and selected a tile. That check now taps a jar under the wordmark and asserts home stays open. |
| 00:03 | F12 | A daily win that lands the streak on 3, 7, 14, 30, 50 or 100 days gets the chapter rung: "7-day streak!" as the title, a "7 dailies in a row" tag, a second wave of candy and the chapter fanfare; the note names the next mark. From a week on, the flame on the daily card grows and glows. Win titles longer than ten characters step down a size so they stay on one line. |
| 00:11 | F9 | A procedural candy-shop loop made with Web Audio, no files: F, D minor, B flat, C as a music-box arpeggio over a quiet bass, mixed under the effects (peak about 0.07 against 0.045–0.07 per effect). 92 BPM, 128 in a rush. Starts with the first touch (browser rule), stops in a hidden tab, picks up from now after a stall. A music button beside sound on home; the sound button silences both. |
| 00:20 | M1 | Turned "local metrics" into a player-facing record under the counters in the candy shop: six tiles, each a number to beat. Best combo is now kept across levels. A debug panel would have served nobody without a backend to send numbers to. |
| 00:29 | F13 | Levels 56, 66, 76… close a run of ten: "Run complete!", a "Levels 47–56 cleared" tag, the second wave of candy and the chapter fanfare, and "Next run: levels 57–66." The journey bar already counted these runs; now finishing one pays off. |
| 00:43 | Review 2 | Second self-review, of R1 through F13, found 9 issues, all fixed: a resumed board showed a ribbon already untied (refreshLocks compared against a field syncBadge also writes), a spare or split before the first move was not kept (and Play threw it away), the snapshot waited for the tile to land so leaving mid-flight lost the move, a resumed board did not single out its last jar, the hand came back after Home and Play on a touched board, keyboard-only players never got music, a test board's combo counted in the record, the level signature was serialized on every move, and the sealed look was copied by hand for resumed jars. 53 play-test checks pass. |
| 00:52 | F14 | The board takes keyboard focus: arrows move an ink ring (left and right in reading order, up and down to the nearest jar or stack), Enter or Space taps, Escape puts a lifted tile back, U undoes, H hints. The ring shows only once a key is used and hides on touch. A hidden live region reads each spot ("Jar: needs 7, 2 tiles in it, top 3"; "Holding an 8"). |
| 01:15 | F15 | A Sugar Rush share now carries `?rush=<seed>&beat=<score>`; boards come from the seed alone, so the friend who opens it plays the same boards. The link opens a "Beat 340" card over home (even for a brand-new player, with a one-line rule); the clock shows "· beat 340"; the end card says "You beat it!" or how far short; Play again replays the same boards; the address is cleaned so a reload does not ask again. Found while testing: `history.replaceState` failed silently because the module's undo list is also named `history` (now `window.history`). |
| 01:35 | F16 | A streak freeze is earned at each milestone from 7 days (two held at most) and spent by itself when exactly one day was missed: the streak goes on and the win card says "A freeze covered the day you missed: 8-day streak!". While a freeze is holding the streak, the daily card says "A freeze holds it"; freezes in hand are read out in the card's label. Opening the daily now also clears a finished rush still attached to the board (found by the play-test). |
| 02:08 | F17 | When nothing moves but the slowly bobbing badges (no tweens, flights, sparks, falling candy, lifted tile or camera lean), the board is drawn every other frame: measured 45% of frames drawn on a still board, every frame with a tile lifted. Not in the first 90 frames, which measure how fast the device draws. A new board now also clears the previous board's sparks, which could otherwise fly over it. |
| 02:18 | QA | Visual sweep of home, shop, board and win card at 360×640, 768×1024 and 1280×800: no overflow anywhere, but the daily card truncated beside Rush ("Mon · …", "Keep yo…") on phones and desktop. Play and the card row are now 360 px wide (full width on a 390 px phone), the Rush card a little narrower, and the shared-row subtitles shorter; checked by measuring the text boxes. 57 play-test checks pass. |
| 02:34 | Review 3 | Third self-review, of keyboard play through the layout polish, found 10 issues, all fixed: browser shortcuts (Alt+←, Ctrl+U, Ctrl+H) were taken by the board; a tied challenge said "0 short of 340" (now "It's a tie!"); a last daily dated after today showed a live streak the rules would reset; Up/Down could slide sideways and Left/Right used a non-transitive sort (both now walk rows by depth); a key on the board did not retire the first-move hand; closing the challenge card dropped focus; the canvas was a tab stop behind home with no visible focus; every arrow faded every ring; a resize on a skipped frame could flash blank. |
| 02:44 | F18 | A share now carries a picture where the phone's share sheet accepts files: 1080×1350 in the room's colours, with the wordmark, the result (stars or the rush score), moves against par, the seal squares, the streak, a line to play, and the link. No board, so the daily stays unspoiled. It is drawn when the result appears, so it is ready before the tap (share sheets need the tap's user activation). Elsewhere the text share is unchanged. |
| 03:12 | Review 4 | Final cross-feature review of the whole night found 10 issues, all fixed: home's "focus Play" call had been swallowed by a comment; U and H still worked in Sugar Rush (and undo let a jar be re-sealed for points); a win was only saved after the lid animation, so leaving during the winning flight lost the stars and the streak (now recorded at the winning move); an older daily finished later reset the streak; on-device dailies past the pool could exceed the 65% cap; the worker's cache version ignored icon and manifest changes (now hashes every kept file, read from the worker's own list); Rush built its first board synchronously on tap (now prepared ahead in idle time); a duplicated swatch style; stray comments. The play-test's taps now wait for cards to stop moving, and its level jumps leave any daily or rush; its viewport is configurable (VIEWPORT=WxH). |
| 03:33 | QA | Full play-test at 360×640 (the smallest phone we design for): all 61 checks pass, no horizontal overflow. |
| 04:02 | F19 | A level cleared under three stars shows a "Replay for 3 stars" chip under the note (an icon-only button squeezed "Next chapter" onto two lines and did not say what it was for). The replay is a side trip: it never moves the resume point back (found while testing: building a level wrote it as the resume point), is not kept on a reload, and Home from the middle of it goes on to the next new level. A better replay keeps the new stars and says "Up from 2 stars"; a chapter or run end is not celebrated twice. |
| 04:02 | F20 | The daily's win card shows the week, Monday to Sunday: a stamp for each daily played (gold for three stars), missed days hollow, today ringed, and "2 of 7 this week. Tomorrow: Thursday, medium." The streak note dropped its "A new board tomorrow" to make room. Fits a 360×640 phone with a milestone tag. |
| 04:12 | F21 | A daily share now links to `?daily=<date>&moves=<n>`. Opening it shows a card over home: today's date tile, "Daily #7", "A friend solved today's board in 9 moves", the day's difficulty and the one-line rule, and Play it, for any player, even a brand-new one (who also gets the first-move hand on it); levels are untouched. A link from an earlier day offers today's board. A player who has already played today's sees "you took 12. They win this one." and Share yours. The address is cleaned so a reload does not ask again. |
