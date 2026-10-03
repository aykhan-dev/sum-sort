# Sum Sort design system

The game's look, written down as tokens, components and states. The Figma file is the visual source; this page says what is in it and how it maps to `src/page.src.html`.

**Figma:** [Sum Sort — Design System](https://www.figma.com/design/gBpB5HeQuipdys7Trki0yR)

| Page | What it holds |
| --- | --- |
| Foundations | Cover and principles, colour, counter themes, typography, spacing/radius/size, elevation, motion, 3D board materials |
| Components | 37 sections, one per component: the main component set, then every state as a labelled instance on the counter colour |
| Screens | Home, Play, Dead end, Win, Sugar Rush, Daily treat and Candy shop at 430 × 932, built only from component instances |

## Principles

1. **One surface.** The candy counter fills the screen. Controls float at its top and bottom edges, and nothing covers the board during play: messages go to the coach strip.
2. **Every raised control is a gummy.** It has the tiles' glossy slab: a top gloss, a bottom shade and a candy lip that sinks when pressed.
3. **Squircles.** Every rounded rectangle has continuous corners: `corner-shape: squircle` with radii × 1.5 in CSS, and 60% corner smoothing in Figma. Circles and pills stay round.
4. **48 px or larger** for every control.
5. **Contrast holds on every counter.** Ink is 7:1 and soft ink 4.5:1 on all eight themes, and each tile's digit is 3.4:1 on its face.
6. **Motion is earned**, and `prefers-reduced-motion` turns it off: fades only, with no scale, lean or flash.

## Tokens (Figma variables)

| Collection | Count | Contents |
| --- | --- | --- |
| Primitives | 91 | Raw palette (`ink/900`, `raspberry/400`, `gold/600`, `flavour/<name>/face/material/digit` …). Hidden from pickers. |
| Color | 98 | Semantic roles aliasing primitives. Every variable has scopes and WEB code syntax (the CSS custom property where one exists). |
| Counter | 54 | The eight counter themes as `theme/<id>/sky-top · sky-mid · sky-bottom · surface · stage · wash`, plus `counter/*` aliasing the active theme (Strawberry). |
| Layout | 29 | `space/*` (2–26 px), `radius/*` (6–32 px and `full`), `size/*` (icon 20, touch 48, cta 52, hero 66 …). |

The Figma file is on a Starter plan, which allows one variable mode and three pages. That is why the themes are variable groups rather than modes. On a paid plan, `Counter` becomes one collection with eight modes.

### Colour roles

| Role | Value | CSS |
| --- | --- | --- |
| `text/primary` | #3B2747 | `--ink` |
| `text/secondary` | #6A5676 | `--ink-soft` |
| `text/brand` | #E8456B | `--raspberry` |
| `text/danger` | #B32643 | `--raspberry-ink` |
| `surface/card` | #FFFFFF | `--card` |
| `surface/ground` | #FFF0E8 | `--ground` |
| `surface/frost` | #FFFFFF 80% | `--frost` |
| `border/default` | #EED9E4 | `--line` |
| `border/strong` | #E2C7D6 | `--line-deep` (the candy lip) |
| `brand/gold`, `brand/gold-deep` | #F5B83D, #D9962B | `--gold`, `--gold-deep` |
| `gummy/<flavour>/hi · base · lo` | 7 flavours | `.c-rasp` `.c-blue` `.c-mint` `.c-orange` `.c-gold` `.c-pink` `.c-grape` |
| `tile/<1-9>/face · digit · material` | 9 flavours + frosted | `FLAVOURS` in `page.src.html` |
| `badge/*`, `star/*`, `flame/*` | | Jar badge, win stars, streak flame |

### Typography

**Fredoka** (600/700) is used for numbers, titles, buttons and the wordmark; **Nunito** (700/800) for reading text and labels. There are 27 text styles in four groups:

- `Display/*`: wordmark 92, callout 62, hero number 60, title 42, button 18, values
- `Heading/*`: Fredoka 600 labels, 15–19 px
- `Body/*`: Nunito 700 text, 12.5–14 px
- `Label/*`: Nunito 800 eyebrows, counts and micro caps

### Elevation (effect styles)

| Style | Effects | Used on |
| --- | --- | --- |
| `Elevation/Raised` | 4 px lip + soft plum lift | All raised controls |
| `Elevation/Raised Pressed` | 1 px lip | Pressed raised controls |
| `Elevation/Raised Selected` | Raspberry lip | Selected and rescue controls |
| `Elevation/Raised Inverse` | Ink lip | The armed booster |
| `Elevation/Raised Disabled` | Pale lip | Disabled controls |
| `Elevation/Chip` | 2 px lip | Chips |
| `Elevation/Chip Pressed` | 1 px lip | Pressed chips |
| `Elevation/Card`, `Elevation/Card Perfect` | 6 px lip + deep shadow | Win card and dialogs |
| `Elevation/Float` | Soft shadow | Frosted labels |
| `Elevation/Badge` | Soft shadow | Jar badge |
| `Gummy/Gloss`, `Gummy/Gloss Hero` | Inset top gloss + bottom shade | Gummies |
| `Track/Sunken` | Inset shadow | Candy tracks |

## Components and states

Pressable controls reserve their lip inside the component, so **Pressed** really sinks 3–5 px. **Focus** is a 3 px raspberry ring set 2 px off the body. Text that changes between states, such as the badge number or the strip message, belongs to each variant. Shared labels and icons are component properties: Label, Icon (instance swap), Show icon, Dot and Count.

| Group | Component | Variants |
| --- | --- | --- |
| Icons | 21 icons | Home, Sound, Sound Off, Music, Music Off, Restart, Undo, Jar Plus, Split, Hint, Share, Check, Arrow Right, Close, Treat, Install, Gift, Play, Bolt, Star, Flame |
| Board | Gummy Tile | Value 1–9, Frosted × State Default, Lifted, Ghost |
| | Tile Chip | Value 1–9, Frosted |
| | Jar Badge | Waiting, Filling, Last jar, Sealed, Locked, Spare, Overfill |
| | Jar | Default, Selected, Focus, Last jar, Sealed, Locked |
| | Dish | Default, Selected, Focus |
| | Combo Callout | Combo (Sweet → Delicious), Top (Sugar rush!) |
| Controls | Button | Raspberry, Orange, Grape × Default, Pressed, Focus |
| | Play Button | Default, Pressed, Focus |
| | Icon Button | Default, Pressed, Focus, Off (+ Dot) |
| | Chip | Default, Pressed, Focus |
| | Ghost Button | Default, Pressed, Focus |
| | Count Badge | Default, Disabled |
| | New Tag | No variants |
| HUD | Level Tag | Level, Daily, Rush |
| | HUD Pill | Level, Rush, Rush hurry |
| | Coach Strip | Tip, Note, Soft, Stuck |
| | Booster | Undo, +1 Jar, Split, Hint × Default, Pressed, Armed, Disabled, Rescue, New |
| Home | Star Tally | Default, Pressed, New |
| | Streak | Warm, Hot |
| | Daily Card | Locked, Ready, Streak, Hot streak, At risk, Done × Full, Narrow |
| | Rush Card | New, Best, Pressed |
| | Journey Segment | 6 chapters × Done, Current, Todo |
| | Journey Bar | No variants |
| | Chapter Tag | 6 chapters × Ground, Frost |
| | Hero Level Number | Tall, Short, Compact |
| | Wordmark | No variants |
| | Motif | Start, Halfway, Sealed |
| | Counter Backdrop | Default, Finale |
| Rewards | Star | On, Off × Side, Center |
| | Stars Row | 0–3 |
| | Stat | No variants |
| | Bonus Pill | No variants |
| | Record Stat | No variants |
| | Reward Row | No variants |
| | Week Day | Upcoming, Today, Played, Three stars, Missed, Not open, Prize, Prize won |
| | Treat Day | Day, Big × Upcoming, Today, Opened |
| | Theme Swatch | 8 counters |
| | Theme Card | Owned, Selected, Locked |
| | Progress Track | 0, 25, 50, 75, 100 |
| | Win Card | Sealed, Sweet, Perfect |

## Limits

- The jar, dish and tiles are 3D in the game (three.js). The Figma versions are 2D stand-ins for mockups and share art. The scene's material colours are listed on the Foundations page.
- The guide hand, the confetti and the sugar bursts are not drawn.
- Motion is documented in a table on the Foundations page (durations, curves, reduced-motion behaviour), not prototyped.
