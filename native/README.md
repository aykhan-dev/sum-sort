# Sum Sort in 3D: the scene for Filament and Metal

Everything needed to rebuild the game board natively, so that it looks and moves as the web game does. Use the models, textures and maps in this folder as they are. Use this page for everything they cannot carry: the renderer, the camera, the lights, the layout, the animations and the input. When this page and the web build disagree, the web build is right. Regenerate the folder from it with:

```
npm i && npm run build && npm run export:3d     # scripts/export-3d.mjs, about 8 minutes
```

The exporter runs the built `index.html` in headless Chromium. It exports the game's own meshes, materials and runtime-drawn textures through three.js's `GLTFExporter`, so nothing here is redrawn by hand. Line references (`page.src.html:1234`) point into `src/page.src.html`.

## Contents

1. [What is in this folder](#1-what-is-in-this-folder)
2. [Conventions](#2-conventions)
3. [Colour pipeline and tone mapping](#3-colour-pipeline-and-tone-mapping)
4. [Camera](#4-camera)
5. [Lights, shadows and the environment](#5-lights-shadows-and-the-environment)
6. [The counter and the room](#6-the-counter-and-the-room)
7. [Assets: geometry, materials, states](#7-assets-geometry-materials-states)
8. [Draw order and transparency](#8-draw-order-and-transparency)
9. [Board layout](#9-board-layout)
10. [Animation](#10-animation)
11. [Particles and confetti](#11-particles-and-confetti)
12. [The guide hand](#12-the-guide-hand)
13. [Input](#13-input)
14. [2D layers over the scene](#14-2d-layers-over-the-scene)
15. [Reference renders](#15-reference-renders)
16. [Filament recipe](#16-filament-recipe)
17. [Metal recipe](#17-metal-recipe)
18. [Porting the rest of the game](#18-porting-the-rest-of-the-game)

## 1. What is in this folder

| Path | What it is |
| --- | --- |
| `models/tiles.glb` | The ten tiles: `tile_1` … `tile_9` and `tile_frosted` (the hidden "?" tile). Each root has `candy` (the body) and two digit decals, `digit_front` and `digit_top`. The roots sit 1.2 apart on x so the file reads in a viewer: reset a root's translation when you place it. |
| `models/jar.glb` | The jar: `glass`, `glass_edge` (fresnel rim, custom shader), `floor_tint`, `rim`, `shine_front`, `shine_dot`, `shine_back`, `contact_shadow`, and three floor rings: `ring_gold`, `ring_select`, `ring_focus` (exported at opacity 0, their resting state). |
| `models/jar_lid.glb` | The lid of a sealed jar: `cap`, `dome`, `band`, `knob`. Its origin goes to y = 2.31 in jar space. |
| `models/jar_ribbon.glb` | The ribbon of a locked jar: `band` and a `bow` (`loop_1`, `loop_2`, `knot`). Its origin goes to y = 1.15 in jar space. |
| `models/dish.glb` | The dish under a stack: `porcelain`, `gilt_rim`, `contact_shadow`, `ring_select`, `ring_focus`. |
| `models/counter.glb` | The counter top (120 × 1 × 120 rounded box). Its colour changes with the theme (§6). |
| `models/confetti_candy.glb` | One win-confetti candy (white; each instance is tinted, §11). |
| `models/guide_hand.glb` | The tutorial hand, sculpted exactly as the game does it (surface nets over a distance field). The fingertip is the origin, +y runs up the finger. |
| `models/guide_tap_arcs.glb` | The two tap arcs that ring out from the fingertip. |
| `textures/digit_<n>_top.png`, `digit_<n>_front.png` | The digit decals (512²), for 1–9 and `frosted`. Already inside `tiles.glb`; here for reuse. |
| `textures/badge_<state>.png` | The jar badge (256²) in each state, with the number 7: `waiting`, `filling` (3 of 7 in), `last-jar`, `sealed`, `locked`, `spare`, `overfill`, `two-digit` (14). Other numbers are drawn at runtime (§7.6). |
| `textures/shine.png`, `contact_shadow.png`, `spark.png` | The painted glass highlight, the soft shadow under jars and dishes, the sugar spark. |
| `textures/sky_<theme>.png` | The room behind the board for each of the 8 counter themes (§6). |
| `environment/room.hdr` | The reflection room, sharp (three.js `RoomEnvironment`), equirectangular, linear. |
| `environment/room_blur.hdr` | The room as the game reflects it: the sharpest level of its prefiltered environment. |
| `environment/ggx/mip_7.hdr` … `mip_m2.hdr` | Every other level of that prefiltered environment, down to `mip_m2` (roughness 1, which is also the diffuse light). For an exact Metal port (§17). |
| `environment/filament_ibl.ktx` | Ready for Filament: a 256² cubemap with 5 levels made from the levels above, with the hemisphere light built into the last one (§16). |
| `environment/*_preview.png` | The maps tone-mapped, for eyes only. |
| `reference/<board>.png` | Screenshots of the web game: `phone_level-21` (390 × 844 pt at 2.5×), `phone_level-21_last-jar` (the same board played to its last jar), `phone_level-44` (5 jars, ribbons, frosted tiles), `tablet_level-21` (1024 × 768 pt at 2×). |
| `reference/<board>_canvas.png` | The same frame with the page's 2D controls hidden: only the 3D canvas. Compare your renders with these. |
| `reference/<board>.json` | The numbers behind that frame: viewport, camera, fit limits, layout, sun, every jar and stack. |
| `reference/<board>.glb` | That whole frame as one glTF scene: counter, jars, stacks, tiles, lids, ribbons, badges (as camera-facing quads), sun, rim light and the camera. |
| `reference/ibl_probe.png` | A chrome ball and a grey matte ball lit by the environment and hemisphere light only (§16 says how to rebuild it). |

## 2. Conventions

- **Units and axes.** One unit is the board's unit: a tile is 0.9 wide. Right-handed, +Y up, as in glTF and Filament. The camera sits on +Z and looks toward −Z and down. On the board, jars are at the back (smaller z) and stacks in front (larger z).
- **Colours.** Hex values on this page are sRGB, as written in the code. Engines want them linear: `c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055)^2.4`. glTF factors in the models are already linear. Light colours must be converted too.
- **Textures.** All PNGs are sRGB colour with straight (not premultiplied) alpha. Sample them as sRGB (`SRGB8_A8` in Filament, `.rgba8Unorm_srgb` in Metal), with trilinear filtering and mipmaps. The digit decals use anisotropy 8.
- **HDR maps.** Radiance `.hdr` (RGBE), linear, at intensity 1 (the game draws the environment at 0.85). Rows run top (+Y) to bottom. A texel at `u, v` (0..1, `v` = 1 at the top) holds the light arriving from world direction `phi = (u − 0.5) · 2π`, `theta = (v − 0.5) · π`, `d = (cos θ cos φ, sin θ, cos θ sin φ)`. That is three.js's equirectangular layout: the centre column looks along +X and the column at u = 0.75 along +Z.
- **glTF extras.** glTF has no place for some of the settings, so they are in `extras`:
  - on nodes: `renderOrder`, `castShadow`, `receiveShadow`;
  - on materials: `toneMapped: false` (§3), `depthWrite: false`, `depthTest: false`, `doubleSided`, `polygonOffset: { factor, units }`, `alphaTest`, `blend` (always straight alpha, `src·a + dst·(1−a)`), and for `jar_glass_edge` a `customShader` description with its parameters.
  - Materials with `KHR_materials_unlit` are flat colour (the painted highlights, rings, decals, shadows).
- **Time.** Durations are in milliseconds. With the system's reduce-motion setting on, the game multiplies every duration by 0.45 and turns off scale, lean and flash effects (§10).

## 3. Colour pipeline and tone mapping

This section decides whether the result looks the same, so read it before writing any shader.

What the web game does, per fragment:

1. Lighting in linear RGB, exposure 1.
2. **Tone mapping, per material, in the fragment shader**: Khronos PBR Neutral (three.js `NeutralToneMapping`). Materials marked `toneMapped: false` skip it: the digits, the badge, the painted shines, the rim, the floor tint, the rings, the contact shadows, the sparks, the tap arcs and the fresnel edge.
3. sRGB encoding, also in the fragment shader.
4. Blending into an 8-bit, non-sRGB framebuffer, so **transparent layers blend in sRGB-encoded (gamma) space**, with straight alpha: `rgb = src·a + dst·(1 − a)`; alpha channel `a + dst_a·(1 − a)`.
5. 4× MSAA. Render scale `min(devicePixelRatio, 2.5)`; on a slow device the game drops to 1.5 and to a 1024² shadow map.

The tone mapper, exactly as three.js r170 and Filament (`PBRNeutralToneMapper`) have it:

```glsl
vec3 neutralToneMap(vec3 c) {                    // Khronos PBR Neutral, exposure 1
  const float S = 0.76, DESAT = 0.15, d = 1.0 - S;
  float x = min(c.r, min(c.g, c.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c -= offset;
  float peak = max(c.r, max(c.g, c.b));
  if (peak < S) return c;
  float newPeak = 1.0 - d * d / (peak + d - S);
  c *= newPeak / peak;
  float g = 1.0 - 1.0 / (DESAT * (peak - newPeak) + 1.0);
  return mix(c, vec3(newPeak), g);
}
```

Its exact inverse, for an engine that tone-maps the whole frame (Filament): feed `neutralInverse(linear colour)` to a material that must reach the screen unchanged. It holds for any colour the tone mapper can produce; very bright saturated colours cannot be produced and come back clamped.

```glsl
vec3 neutralInverse(vec3 t) {
  const float S = 0.76, DESAT = 0.15, d = 1.0 - S;
  t = min(t, vec3(0.9999));
  float newPeak = max(t.r, max(t.g, t.b));
  vec3 c = t;
  if (newPeak >= S) {
    float peak = d * d / (1.0 - newPeak) + S - d;
    float g = 1.0 - 1.0 / (DESAT * (peak - newPeak) + 1.0);
    c = (t - g * newPeak) / (1.0 - g) * (peak / newPeak);
  }
  float m = min(c.r, min(c.g, c.b));
  return c + (m >= 0.04 ? 0.04 : sqrt(max(m, 0.0)) / 2.5 - m);
}
```

**Metal** can do all five steps exactly as above (§17). **Filament** tone-maps once, after all blending, in linear HDR. Opaque surfaces come out the same. Unlit overlays need `neutralInverse` to keep their colour, and anything partly transparent blends in linear light instead of gamma space, so soft edges and see-through layers come out a little different (§16 says what to tune).

## 4. Camera

- Perspective, **vertical field of view 32°**, near 0.1, far 120, aspect = drawable width / height. No roll, no yaw: the camera always looks straight down its view direction with +Y up.
- **View direction** (from the board toward the camera):
  - narrow screens (aspect < 0.95, phones in portrait): `normalize(0, 0.79, 0.61)` = (0, 0.79151, 0.61116), 52.33° above the counter;
  - wider screens: `normalize(0, 0.66, 0.75)` = (0, 0.66063, 0.75071), 41.35° above the counter.
- **Distance and centre** come from fitting the board into the free part of the screen (`fitToPoints`, `page.src.html:2713`). Port it as it is:
  1. Points: the 8 corners of each layout zone (§9).
  2. Limits in clip space: `x = ±1/1.03` (narrow) or `±1/1.08`; `y0 = −1 + 2·bottom/H`, `y1 = 1 − 2·top/H`, where `top` = the top bar's lower edge, measured from the top of the canvas, + 4 px; `bottom` = the gap under the bottom controls' container + the booster tray's height + 10 (when the tray shows) + 50 (the coach line, fixed) + 4 px; `H` = the canvas height; all in points (`boardLimits`, `page.src.html:2705`).
  3. Start at the centre of the points' bounding box. Four passes: binary-search the distance along the view direction (22 halvings between 2 and 90) for the closest camera that keeps every point inside the limits and in front of the camera; then measure how far the points' screen box is off the middle of the limits and move the centre by that much (in camera right/up, scaled by `tan(16°)·distance`, and by the aspect for x). Stop when it is within 0.01 both ways.
  4. Camera position = centre + view direction × distance; look at the centre.
- Reference results (also in `reference/*.json`):

| Board | Screen | Camera position | Looks at | Limits x, y0, y1 |
| --- | --- | --- | --- | --- |
| Level 21, 4 jars, 3 stacks | 390 × 844 pt | (0, 22.74543, 21.56061) | (0, 1.30523, 5.00552) | 0.97087, −0.62085, 0.75118 |
| Level 44, 5 jars, 4 stacks | 390 × 844 pt | (0, 22.74543, 21.56061) | (0, 1.30523, 5.00552) | same |
| Level 21 | 1024 × 768 pt | (0, 12.46222, 14.43734) | (0, 1.46416, 1.93954) | 0.92593, −0.58333, 0.72656 |

- **When it moves.** On a resize the layout and the fit are redone at once. When a spare jar is added, the layout slides and the camera refits over 360 ms (`inOutCubic`), lerping position and look-at point.
- **Lean (camera kick).** On a combo of 3 or more and on the winning tile, the camera is pushed toward the jar for the frame only: `dir = normalize((jar.x, 1.2, jar.z) − camera)`, `peak = |(jar.x, 1.2, jar.z) − camera| · min(0.045, 0.012 + 0.007·n)` (n = combo; 7 for the win), `amount = peak · sin(πk) · (1 − 0.4k)` over 340 ms (1500 ms for the win). Add `dir · amount` to the camera position before drawing and take it off after.

## 5. Lights, shadows and the environment

| Light | Colour (sRGB → linear) | Intensity | Direction or placement | Shadows |
| --- | --- | --- | --- | --- |
| Hemisphere | sky #F3E8FF → (0.8963, 0.8070, 1.0); ground #FFD9C7 → (1.0, 0.6939, 0.5711) | 1.05 | sky colour on normals up, ground down: `mix(ground, sky, 0.5·n.y + 0.5)` | — |
| Sun (directional) | #FFF1E2 → (1.0, 0.8796, 0.7605) | 2.3 | travels along (0.35301, −0.78446, −0.50990): from (cx − 4.5, 10, cz + 6.5) to (cx, 0, cz) | yes |
| Rim (directional) | #E7D6FF → (0.7991, 0.6724, 1.0) | 0.9 | travels along (−0.59702, −0.39801, 0.69653): from (6, 4, −7) to the origin | no |
| Environment | `room_blur.hdr` and its levels | 0.85 | as stored (§2) | — |

- Intensities are three.js r170's physical units: a directional light adds `colour · intensity · max(N·L, 0) · BRDF`, with the Lambert BRDF `albedo/π`. The hemisphere light is diffuse only and is divided by π too: `albedo · hemisphere(n) · 1.05 / π`. Filament with camera exposure 1.0 uses the same numbers (§16).
- **Every lit material sees the environment at 0.85.** The source sets `envMapIntensity` 0.55 on tiles and 1.5 on glass, but three.js r170 ignores a material's `envMapIntensity` when the map comes from `scene.environment` and uses `scene.environmentIntensity` (0.85) instead. Do not copy those two values.
- **The environment** is three.js's `RoomEnvironment` (a grey room with bright ceiling and wall panels), prefiltered with `PMREMGenerator.fromScene(room, 0.14)`: blurred by σ = 0.14 rad, then one level per roughness band. A material of roughness r reads `mip = roughnessToMip(r)` (§17), mixing the two levels around it. Diffuse light reads the roughness-1 level (`mip_m2`) along the normal.
- **Shadows** come from the sun only. Shadow map 2048² (1024² on a slow device), PCF soft (three.js `PCFSoftShadowMap`), bias −0.0005, normal bias 0.04. The shadow camera is orthographic and fitted to the board: centre `(cx, cz)` of the layout's bounds, half size `max(maxX − minX, maxZ − minZ)/2 + 2.6` (7.9 on the phone level-21 board), near 1, far 40; the sun's position and target move with it (§9 for the bounds).
- Casters: tile bodies, the dish, the lid cap, dome and knob, the ribbon band, the confetti and the guide hand. Receivers: the counter, tile bodies and the dish. Glass casts nothing.

## 6. The counter and the room

- **Counter**: a rounded box 120 × 1 × 120 (radius 0.45, 4 segments) at (0, −0.5, −4), so its top is the plane y = 0. Material: physical, roughness 0.55, clearcoat 0.3, clearcoat roughness 0.45, colour from the theme below. Receives shadows.
- **The room behind** is a vertical sRGB gradient filling the screen, not tone-mapped: `top` at 0, `mid` at 55%, `bottom` at 100% (`textures/sky_<theme>.png`, 4 × 256, stretched). With these camera angles the counter fills the whole frame on every screen shape, so the sky never shows during play. Clear to it anyway.

| Theme | Counter | Counter, linear | Sky top · mid · bottom |
| --- | --- | --- | --- |
| strawberry (default) | #F6D8CF | 0.9216, 0.6867, 0.6240 | #E9DCFF · #FFE0D2 · #FFD3C2 |
| mint | #CBEADF | 0.5972, 0.8228, 0.7379 | #D6F2EA · #E6F6EE · #C7ECDF |
| lemon | #F6E4B2 | 0.9216, 0.7758, 0.4452 | #FFF4C7 · #FFEFD5 · #FAE0A8 |
| blueberry | #CFDAF4 | 0.6240, 0.7011, 0.9047 | #D9E3FF · #E6EBFF · #C9D6F6 |
| cotton | #F0D3E8 | 0.8714, 0.6514, 0.8070 | #FFD6EC · #E8DFFF · #D3E5FF |
| caramel | #EACFB2 | 0.8228, 0.6240, 0.4452 | #FBE4CF · #F5DAC1 · #F2D5B9 |
| grape | #D9CAF2 | 0.6939, 0.5906, 0.8879 | #E4D7FF · #EDE2FF · #DED2F7 |
| peach | #F9D0BA | 0.9473, 0.6308, 0.4910 | #FFE1D3 · #FFEADB · #FFCDB4 |

The page around the canvas (status bar, letterbox) uses the theme's `stage` colour; see `THEMES` in `src/meta.mjs`.

## 7. Assets: geometry, materials, states

All geometry is in the glTF files with its normals and UVs; the shapes below are for understanding, not for rebuilding. Constants (`page.src.html:792`): `TILE_W 0.9`, `TILE_H 0.44`, `STEP 0.455`, `JAR_FLOOR 0.095`, `DISH_FLOOR 0.085`, `LID_Y 2.31`, `BADGE_Y 3.08`, `JAR_CAP 4` tiles.

### 7.1 Tiles

- Body: rounded box 0.9 × 0.44 × 0.9, radius 0.13, 9 segments. Casts and receives shadows.
- Numbered tile material: physical, colour = the flavour's `mat` colour below, roughness 0.18, clearcoat 1, clearcoat roughness 0.05, metalness 0. No emissive. (`mat` is darker than the colour you see on screen on purpose: under this light it renders as `hex`.)
- Frosted tile: colour #F4EEF8, roughness 0.85, sheen 1 with sheen colour #FFFFFF and sheen roughness 0.6, clearcoat 0.2 (clearcoat roughness 0).
- Digit decals: unlit, `toneMapped: false`, transparent, no depth write, alpha test 0.02, polygon offset factor −4 units −4. Top decal 0.72 × 0.72, rotated flat, at y = 0.222 (TILE_H/2 + 0.002). Front decal 0.44 × 0.44 at z = 0.452, facing +Z (the camera side). Each is drawn at 512²: Fredoka 700, 440 px (top) or 500 px (front), centred at y 280 (top) or 286 (front); first a glint (the flavour colour mixed 60% toward white, at 85% alpha) 9 px lower, then the ink on top. The frosted tile shows "?" in #6B4AA8 with a white glint.

| Value | Flavour | On screen (`hex`) | Material (`mat`) | `mat`, linear | Digit ink |
| --- | --- | --- | --- | --- | --- |
| 1 | Lemon | #F4DE3D | #B0A203 | 0.4342, 0.3613, 0.0009 | #453E03 |
| 2 | Grape | #9063F6 | #6036B6 | 0.1170, 0.0369, 0.4678 | #332354 |
| 3 | Tangerine | #F68741 | #B55903 | 0.4621, 0.0999, 0.0009 | #613112 |
| 4 | Blueberry | #6891E9 | #385C9F | 0.0395, 0.1070, 0.3467 | #1E3D70 |
| 5 | Lime | #83F572 | #53B445 | 0.0865, 0.4564, 0.0595 | #1D4618 |
| 6 | Bubblegum | #F683CE | #B65A98 | 0.4678, 0.1022, 0.3140 | #632850 |
| 7 | Mint | #3EBFA0 | #18816A | 0.0091, 0.2195, 0.1441 | #1B453A |
| 8 | Cherry | #DD4A3D | #942517 | 0.2961, 0.0185, 0.0086 | #541711 |
| 9 | Cola | #A67566 | #6D4A3E | 0.1529, 0.0685, 0.0482 | #482116 |

- **Where tiles sit.** A tile's origin is its centre. In a jar, slot k (0 at the bottom) is at y = `0.095 + 0.22 + 0.005 + 0.455·k` = 0.320, 0.775, 1.230, 1.685. On a dish: `0.085 + 0.22 + 0.005 + 0.455·k` = 0.310, 0.765, 1.220, 1.675, 2.130 … Tiles are children of their jar or dish, at x = z = 0. Tiles keep their face toward +Z; only animations rotate them.
- **States.** Resting; lifted (selected: +0.42 in y, wobbling, §10); flying (§10); hidden (shows `tile_frosted` until it becomes the top of its stack, then swaps to its number with a burst, §10). A tile split in two is replaced by two new tiles.

### 7.2 Jar

The jar body is a lathe of a smooth centripetal Catmull-Rom spline (72 samples, 88 segments) through the profile below, which runs up the outside, over the lip and back down the inside to the floor at y = 0.095:

`(0,0) (0.6,0) (0.74,0.03) (0.8,0.12) (0.82,0.3) (0.82,1.72) (0.79,1.86) (0.72,1.96) (0.7,2.02) (0.7,2.14) (0.745,2.16) (0.745,2.27) (0.66,2.27) (0.66,2.02) (0.7,1.95) (0.76,1.85) (0.765,1.72) (0.765,0.3) (0.735,0.16) (0.6,0.095) (0,0.095)`

| Part | Material | Draw | Notes |
| --- | --- | --- | --- |
| `glass` | physical: #D9C8FF, opacity 0.11, roughness 0.04, metalness 0, clearcoat 1, clearcoat roughness 0.04, specular intensity 1 (IOR 1.5) | transparent, no depth write, order 1, front faces | No refraction or transmission. Its reflections are multiplied by 0.11 like the rest, because the blend is straight alpha. |
| `glass_edge` | custom shader: `rgb = #9479D8` (encoded as is, no tone mapping), `alpha = 0.82 · (1 − abs(dot(N, V)))^2.3`, N and V in view space | transparent, no depth write, order 2 | Same mesh as the glass. Darkens the walls where they turn away from the eye. |
| `floor_tint` | unlit #BFA6EE at 0.2 | transparent, no depth write, not tone-mapped | Disc r 0.75 at y 0.099. |
| `rim` | unlit white at 0.62 | transparent, no depth write, order 3, not tone-mapped | Flat ring r 0.668–0.742 at y 2.274. |
| `shine_front` | unlit white × `shine.png`, opacity 0.9 | transparent, no depth write, order 3, not tone-mapped | Open cylinder strip r 0.842, height 1.22, angle −1.05 rad to −0.61, centre y 1.02. |
| `shine_dot` | same, 0.9 | same | r 0.842, height 0.42, angle −0.54 to −0.43, y 1.36. |
| `shine_back` | same, 0.36 | same | r 0.842, height 1.0, angle 0.82 to 0.99, y 1.0. |
| `contact_shadow` | unlit × `contact_shadow.png` | transparent, no depth write, order −1, not tone-mapped | Flat square 2.4 at y 0.004. |
| `ring_gold` | unlit #F5B83D, opacity per state | transparent, not tone-mapped | Torus R 1 tube 0.05, scaled 0.88, flat at y 0.03. |
| `ring_select` | unlit #E8456B | same | scaled 0.9, y 0.035. |
| `ring_focus` | unlit #3B2747 | same | scaled 1.06, y 0.03. |

Angles on the cylinder strips are three.js `thetaStart`/`thetaLength` (θ = 0 on +Z, increasing toward +X), so the front shine faces the camera a little to the left, toward the sun.

**Jar states** (opacities are of the rings; the badge is §7.6):

| State | Gold ring | Select ring | Focus ring | Lid | Ribbon | Badge |
| --- | --- | --- | --- | --- | --- | --- |
| Waiting / filling | 0 | 0 | 0 | — | — | waiting / filling |
| Selected (its top tile is lifted) | 0 | 0.9 | | — | — | |
| Keyboard focus | | | 0.75 | | | |
| Last jar (one numbered jar left open) | 0.55 | | | — | — | last-jar, breathing |
| Sealed | 0.9 | 0 | | on, y 2.31 | — | sealed |
| Locked (tied until n jars are sealed) | 0 | | | — | on | locked |
| Spare (+1 Jar booster, holds any 4) | 0 | | | — | — | spare |
| Overfill (rejected move) | | | | | | overfill for 480 ms, jar shakes |

### 7.3 Lid

Group at y = 2.31 in jar space; cast shadows except the band.

- `cap`: cylinder radius 0.79 top / 0.81 bottom, height 0.17, 112 segments, at y 0.
- `dome`: sphere cap r 0.79 (θ 0–0.32 rad), scaled y 0.6, at y −0.36494, so it rises from the cap's top to y 0.109.
- `band`: torus R 0.81, tube 0.035, flat, at y −0.02.
- `knob`: sphere r 0.08 scaled (2.1, 1.5, 2.1) at y 0.2.
- Lid cream (`cap`, `dome`): #FFF1DC, roughness 0.2, metalness 0.1, clearcoat 1, clearcoat roughness 0.08.
- Gold (`band`, `knob`, and the dish's gilt rim): #F5B83D, roughness 0.16, metalness 0.85, clearcoat 0.6, clearcoat roughness 0.08.

### 7.4 Ribbon

Group at y = 1.15 in jar space. `band`: torus R 0.835, tube 0.07, flat (casts shadow). `bow` at (0, 0, 0.88), the camera side: two loops (torus R 0.17, tube 0.055) at x ±0.17, rotated ±0.5 rad about z, scaled 0.7 in y; and a `knot` (sphere r 0.08). Satin: #E8456B, roughness 0.45, sheen 1, sheen colour #FFC2D1, sheen roughness 0.35.

### 7.5 Dish

Lathe through `(0,0) (0.62,0) (0.78,0.03) (0.92,0.1) (0.99,0.17) (0.96,0.19) (0.85,0.125) (0.66,0.085) (0,0.085)`, 40 samples, 96 segments. Porcelain: #FFF8F4, roughness 0.16, clearcoat 1, clearcoat roughness 0.08; casts and receives shadows. `gilt_rim`: torus R 0.975 tube 0.016 at y 0.178, gold. `contact_shadow` 2.5. `ring_select` scale 1.0 at y 0.04 (0.9 when selected), `ring_focus` scale 1.14 at y 0.035 (0.75 on keyboard focus).

### 7.6 Badge

A 256² texture drawn at runtime, shown as a camera-facing square of 0.98 units at (0, 3.08, 0) in jar space: three.js `Sprite`, so it stays parallel to the screen, is scaled with its jar but never rotated, is depth-tested, writes no depth, draws at order 5 and is not tone-mapped. It bobs: `y = 3.08 + 0.035·sin(2t + i)` (t in seconds, i the jar's index).

The badge counts down: it shows what the jar still needs, `target − sum` of the tiles that have landed. Drawing (`drawBadge`, `page.src.html:1161`), on a cleared 256² canvas, centre (128, 124):

1. Disc r 92 with a drop shadow (`rgba(110,40,90,0.28)`, blur 14, offset y 6): #F5B83D sealed, #FBEFF3 locked, #FFF4D6 last jar, else white.
2. Unless sealed: track ring r 108, width 13 (17 on the last jar), round caps, #F3E3EC (gold on the last jar), dashed 14/14 for the spare jar. If some tiles are in: progress arc on the same ring from 12 o'clock clockwise over `sum/target` of the circle, #E8456B (#E63946 while flashing).
3. Overfill flash: the full ring in #E63946, width 13.
4. Text, centred: the spare jar says `any` (Fredoka 600, 70 px, at cy + 4). Otherwise the number in Fredoka 700, 116 px (104 px from 10 up), at cy + 6 (cy − 6 when sealed). Colour #3B2747; #6A5676 when locked; #E63946 while flashing. A sealed badge shows the jar's target.
5. Sealed: a tick under the number, #3B2747, width 11, round joins: (cx − 22, cy + 52) → (cx − 6, cy + 66) → (cx + 24, cy + 38).
6. Locked: a padlock tag at (196, 190): disc r 40 #E8456B; a white shackle (arc r 11 around (196, 182), upper half, width 8); a white body (rounded rect 34 × 26 at (179, 182), corner 9, superellipse corners).

`textures/badge_*.png` are this drawing for the number 7. Fredoka is free (SIL OFL) and comes with `npm i` in `node_modules/@fontsource/fredoka`.

### 7.7 Shared painted textures

- `shine.png` (64 × 256): white; alpha ramps 0 → 1 over the top 16%, stays 1 to 80%, ramps to 0 at the bottom, multiplied by a horizontal 0 → 1 (30%) → 1 (70%) → 0.
- `contact_shadow.png` (128²): radial gradient from r 6 to 64: rgba(90,40,90,0.30) → (0.12 at 55%) → 0.
- `spark.png` (64²): radial glow (white 1 → 0.65 at 35% → 0 at r 30) plus a white 4-point star (points at r 30, waist r 6).

## 8. Draw order and transparency

three.js draws all opaque objects first, then all transparent ones sorted by `renderOrder`, then back to front by distance. The transparent list in this scene:

| Order | What | Depth test | Depth write |
| --- | --- | --- | --- |
| −1 | contact shadows | yes | no |
| 0 | digit decals, floor tint, rings, the guide's see-through tile | yes | rings yes, others no |
| 1 | glass | yes | no |
| 2 | glass edge | yes | no |
| 3 | jar rim, the three shines | yes | no |
| 5 | badges | yes | no |
| 6 | sparks | yes | no |
| 7 | tap arcs | **no** | no |

So the digits of tiles inside a jar are drawn before its glass, and the glass and its highlights tint them. In Filament map these orders to `RenderableManager::Builder::priority` 0–7 in the same sequence (−1 → 0 … 7 → 7); in Metal sort draws the same way. Within one mesh, triangles draw in index order, as in the files.

## 9. Board layout

`layoutPlay` / `arrange`, `page.src.html:1690`. Jars and dishes stand at y = 0 on a grid; the board is never rotated.

- Jars: rows of `jPer`, 2.1 apart in x, rows 2.9 apart in z from z = 0. Each row is centred on x = 0 (a short last row too).
- Stacks: rows of `sPer`, 2.2 apart in x, rows 2.5 apart, the first at z = `(jarRows − 1)·2.9 + 3.1`.
- Two zones keep the board in frame: the jars' zone (their x/z extent, padded 1.0 in x, 1.0 behind, 0.9 in front, 3.7 high, for the badges) and the stacks' zone (padded 1.1 in x, 1.0 behind, 1.1 in front, 2.7 high).
- Every grid with `jPer` from 2 to min(jars, 7) and `sPer` from 2 to min(stacks, 5), at most 3 jar rows and 2 stack rows, is tried; the one that lets the camera come closest wins (distance + 0.05 per row, so fewer rows win a tie).
- Layout bounds (both zones together) feed the shadow camera (§5).

Examples: level 21 on a phone puts jars at (±1.05, 0) and (±1.05, 2.9), stacks at (±1.1, 6) and (0, 8.5); on a tablet, jars in one row at x = −3.15, −1.05, 1.05, 3.15 and stacks at x = −2.2, 0, 2.2, z = 3.1.

## 10. Animation

A tween runs `fn(ease(k))` with `k = clamp((now − start)/duration, 0, 1)` every frame. Durations are × 0.45 with reduce-motion on. Easings (`page.src.html:852`):

```
linear(k) = k
inOutCubic(k) = k < .5 ? 4k³ : 1 − (−2k + 2)³ / 2
outCubic(k) = 1 − (1 − k)³
inQuad(k) = k²
outBack(k) = 1 + 2.70158·(k − 1)³ + 1.70158·(k − 1)²
outBounce(k): n = 7.5625, d = 2.75;
  k < 1/d ? n k² : k < 2/d ? n (k − 1.5/d)² + .75 : k < 2.5/d ? n (k − 2.25/d)² + .9375 : n (k − 2.625/d)² + .984375
```

| Event | What moves | Time | Ease | Detail |
| --- | --- | --- | --- | --- |
| Board appears | each jar and dish group scale 0.001 → 1 | 300, staggered 40 per item (jars first) | outBack | Not with reduce-motion. |
| Select a tile | tile y → slot + 0.42 | 190 | outBack | Select ring opacity → 0.9 in 180 (linear). While selected: `rotation.z = 0.05·sin(9t)`. |
| Deselect | tile y → slot | 150 | outCubic | Ring → 0 in 180; rotation.z back to 0. |
| Move: flight | quadratic Bézier from the tile to `(jar.x, 3.35, jar.z)`, control = their midpoint raised to `max(start.y, 3.35) + 1` | 310 | inOutCubic | `rotation.y = 0.7·sin(πk)`. The winning tile flies 1.9× slower. An undo flies back the same way (top at 3.0 over a dish). |
| Move: drop | y from 3.35 to the slot | 170 | inQuad | |
| Move: landing squash | tile scale `(1 + 0.15d, 1 − 0.25d, 1 + 0.15d)`, `d = e^(−4.5k)·cos(13k)·(1 − k)` | 280 | linear | Then the badge redraws and bumps: scale × `(1 + 0.2·sin(πk))` over 220. |
| Seal: lid drop | lid from y 4.1, `rotation.z` 0.3, to y 2.31 and 0 | 440 | outBounce | Then: gold burst, gold ring → 0.9 in 420, jar hop. |
| Jar hop | group `y = h·sin(π·e)` | 400 (h 0.22) | e = outCubic(k) | The win hops every jar: h 0.3, 420, staggered 70. |
| Unseal (undo) | lid up by 2, `rotation.z` → 0.4, then hidden | 260 | inQuad | Gold ring → 0 in 200. |
| Reject | jar group `rotation.z = 0.09·sin(5πk)·(1 − k)` | 340 | linear | Selected tile `rotation.y = 0.4·sin(4πk)·(1 − k)` over 280. Badge in overfill state for 480. |
| Last jar | badge scale × `(1 + 0.07·sin(4.5t))` | continuous | | Gold ring → 0.55 in 500; the vignette (§14). |
| Hint / idle nudge | badge scale × `(1 + 0.28·|sin(πk·n)|)` | 1000 | linear | n = 3 for Hint, 2 for the idle nudge (after 8 s, or 2.2 s while learning). The nudge also takes the source ring → 0.8 in 260, holds 380, → 0 in 300. |
| Ribbon ties | ribbon scale 0.001 → 1 | 220 | outBack | |
| Ribbon unties | ribbon scale 1 → 0.001, then hidden | 260 | inQuad | Ribbon burst. |
| Frosted tile revealed | the top tile swaps to its number; scale × `(1 + 0.2·sin(πk))` | 260 | linear | Sugar burst. |
| Split | the tile shrinks to 0.4 | 140 | inQuad | Two new tiles (bigger half below) pop in: scale 0.001 → 1, 240, outBack. Sugar burst. |
| Spare jar | new jar scale 0.001 → 1 | 380 | outBack | Layout slides and camera refits, 360, inOutCubic. |
| Keyboard focus | focus ring → 0.75 / → 0 | 140 | linear | |

Reduce-motion turns off the entrance pop, the selected tile's wobble, the badge's bob, bump and breathing, the camera lean, the confetti, the winning flash and the guide's motion (the hand rests on the tile); ribbons appear and go at once. Everything else still plays, 0.45× as long.

## 11. Particles and confetti

**Sugar bursts** (`burst`, `page.src.html:1276`): `n` points from one spot. Each gets an angle `a` in [0, 2π), `up = rand(2.2, 4.6)·power`, `out = rand(1.2, 2.8)·power`, velocity `(cos a·out, up, sin a·out)`, and colour `palette[i % palette.length]`. Every frame (dt clamped to 0.05 s): `v.y −= 7.5·dt`, `v *= 0.985` (per frame, at 60 fps), `p += v·dt`. Life 0.95 s; opacity `1 − (age/life)²`. Drawn as screen-aligned squares textured with `spark.png` × colour, not tone-mapped, order 6, no depth write. Size: three.js point size 0.34 with distance attenuation, which is a square of **0.0975 world units** (0.34 · tan 16°) facing the camera.

| When | Where | n | Palette | Power |
| --- | --- | --- | --- | --- |
| A jar seals | (jar.x, 2.55, jar.z) | 28 (56 for the winning seal) | gold | 1 (1.45) |
| Combo of 5+ | (jar.x, 3.2, jar.z) | 30 | gold | 1.35 |
| Three-star win | (jar.x, 2.7, jar.z), each numbered jar, 260 + 90·i ms after | 22 | gold | 1.15 |
| Frosted tile revealed | the tile | 12 | sugar | 0.5 |
| Split | (dish or jar x, slot y + 0.4, z) | 14 | sugar | 0.6 |
| Ribbon unties | (jar.x, 1.3, jar.z + 0.6) | 16 | ribbon | 0.7 |
| Guide hand presses | the fingertip | 7 | gold | 0.3 |

Palettes: gold #F5B83D, #FFFFFF, #FFD6E2, #FFE9A8; sugar #FFFFFF, #F4EEF8, #E3D2F7; ribbon #E8456B, #FFC2D1, #FFFFFF.

**Win confetti** (`makeConfetti`, `page.src.html:1308`): instances of `confetti_candy.glb` (rounded box 0.34 × 0.17 × 0.34, white physical, roughness 0.18, clearcoat 1, clearcoat roughness 0.06), instance `i` tinted with flavour `1 + i % 9`'s `mat` colour (the tint multiplies the material colour). Casts shadows. Count: `round(min(60, 20 + par·3) × 1.5 for a three-star clear (not on tutorial levels) × 0.5 on a slow device)`, plus 60 more in a second wave when a chapter or a streak milestone ends (they wait 0.7 s, 30 units higher). Each starts at x in [minX, maxX], z in [minZ, maxZ] of the layout, y in [5, 10], velocity (±0.6, −2…0, ±0.6), Euler angles (XYZ) in [0, 6), spin ±6 rad/s per axis. Per frame: `v.y −= 14·dt`, move, spin. Below y 0.085: put it at 0.085, `v.y *= −0.32`, `v.x, v.z *= 0.6`, spin × 0.5; once `|v.y| < 0.6` it rests with x and z rotation 0. A Sugar Rush best score drops 40.

## 12. The guide hand

On levels 1 and 2 and the jar-to-jar lesson, a hand shows the first move until the player touches the board; on level 1 it comes back with the next move after a pause. `guide_hand.glb` is the sculpted hand: glaze #F8C49A, roughness 0.34, clearcoat 1, clearcoat roughness 0.06, sheen 1, sheen colour #FF8FA3, sheen roughness 0.45; casts shadows. It is drawn at scale 1.3.

The demo loops every 3400 ms: bounce in (0–360, scale outBack), glide to the tile, press it at 640 (squash), lift, arc over to the jar leaning into the turn, press it at 2020, float off and shrink (2420–2720). Each press: two tap arcs (`guide_tap_arcs.glb`, #E8456B, order 7, no depth test) open toward the hand, scale `(0.36 + 0.2i)·(0.85 + 0.3·outCubic(e))`, opacity `0.95·(1 − e²)`, `e = (since press − 90i)/520`; and a 7-spark burst. A see-through copy of the tile (body at 0.5 opacity, decals at 0.8) lifts at 820 and flies to the jar along the same curve as a real move.

The hand is oriented against the camera every frame (fingertip on the spot, finger pointing up the screen, tilted 0.6 rad toward the viewer, leaning ±0.4 rad) and squashes along the finger at each press: `squish(ms) = ms < 110 ? 0.14·sin(π/2·ms/110) : 0.14·e^(−7(ms − 110)/1000)·cos(16(ms − 110)/1000)`, scale `(1 + sq/2, 1 − sq, 1 + sq/2)`. The full pose is `poseGuide`, `page.src.html:1608`: port that function as written, it uses only vectors and the camera matrix. Pressed spots: on a dish, 0.1 above the top tile's upper face and 0.3 toward the camera; on a jar, (x, 1.95, z) moved 0.84 toward the camera.

## 13. Input

- Act on finger **down**, not up.
- Ray from the camera through the touch. The first hit on any drawn mesh of a jar or dish (glass, tiles, rings, shadow, badge) picks that jar or dish. If nothing is hit, try the invisible hit volumes: a cylinder r 0.98, height 3.6, centred at y 1.7 for a jar; r 1.02, height 3.2, centred at y 1.5 for a dish. Nothing hit deselects.
- The rules (what a tap does, when a move is rejected) are in `tap` and `moveTo` (`page.src.html:2780`, `1890`) and in the pure logic of `src/logic.mjs`.

## 14. 2D layers over the scene

These are page elements in the web game, drawn over the canvas. Build them in native UI, not in the 3D scene.

- Vignette, always: radial gradient (ellipse 140% × 100% at 50% 45%), clear at 55% to rgba(190,120,160,0.16) at the edge.
- Last-jar vignette (fades in over 0.6 s): ellipse 110% × 80% at 50% 42%, clear at 40% to rgba(110,50,100,0.34).
- Winning flash: white radial (circle at 50% 40%: white, 60% white at 40%, clear at 75%), opacity 0 → 0.75 at 15% → 0 over 0.5 s.
- Combo words over the sealing jar's badge (Fredoka 700, raspberry with a white outline; gold from 5): `.callout`, `page.src.html:143`.
- The level bar, coach strip, booster tray and win card: see `docs/DESIGN_SYSTEM.md` and the Figma file.

## 15. Reference renders

Every board in `reference/` comes as four files. Rebuild a board from its `.json` (or open its `.glb`, which already holds the meshes, lights and camera), render it at the `drawingBuffer` size, and compare with `<board>_canvas.png` pixel for pixel. The phone renders are 975 × 2110 px (390 × 844 pt at 2.5); the tablet 2048 × 1536.

In the `.glb` scenes, badges are quads already turned to that frame's camera; lights carry their direction in their rotation (they shine down their −Z, as glTF lights do) and the root's `extras` names the hemisphere light, the environment and the tone mapping, which glTF cannot hold. The scene's `camera` node carries the look-at point in `extras.target`.

## 16. Filament recipe

Filament works on both platforms (Vulkan or OpenGL on Android, Metal on iOS).

**View and camera**

```cpp
camera->setProjection(32.0, aspect, 0.1, 120.0, Camera::Fov::VERTICAL);
camera->lookAt(eye, center, {0, 1, 0});
camera->setExposure(1.0f);          // physical units off: values on this page are used as they are
auto* neutral = new PBRNeutralToneMapper();
view->setColorGrading(ColorGrading::Builder()
    .toneMapping(ColorGrading::ToneMapping::FILMIC)   // deprecated, but it keeps grading in Rec.709 primaries, as three.js
    .toneMapper(neutral)                              // the tone mapper actually used
    .dimensions(64)                                   // finest LUT; nothing else is graded
    .build(*engine));
view->setMultiSampleAntiAliasingOptions({ .enabled = true, .sampleCount = 4 });
view->setAntiAliasing(View::AntiAliasing::NONE);   // no FXAA
view->setBloomOptions({ .enabled = false });
view->setAmbientOcclusionOptions({ .enabled = false });
view->setShadowType(View::ShadowType::PCF);
```

Filament runs a custom tone mapper in Rec.2020 primaries unless the old `ToneMapping::FILMIC` is selected (`selectColorGradingTransformIn` in `ColorGrading.cpp`); three.js runs it in Rec.709. The curve is the same, but its min/max steps work per channel, so in Rec.2020 saturated colours (the tiles) come out slightly shifted. If your Filament version has dropped `toneMapping()`, expect that small shift.

**Lights**

```cpp
LightManager::Builder(LightManager::Type::DIRECTIONAL)          // sun
    .color({1.0f, 0.8796f, 0.7605f}).intensity(2.3f)
    .direction({0.35301f, -0.78446f, -0.50990f})
    .castShadows(true)
    .shadowOptions({ .mapSize = 2048, .shadowCascades = 1 })
    .build(*engine, sun);
LightManager::Builder(LightManager::Type::DIRECTIONAL)          // rim
    .color({0.7991f, 0.6724f, 1.0f}).intensity(0.9f)
    .direction({-0.59702f, -0.39801f, 0.69653f})
    .build(*engine, rim);
```

Filament fits its own shadow camera; the web fits a box of half size `max(w, d)/2 + 2.6` around the board. three.js's bias (−0.0005 in depth, 0.04 world units along the normal) does not carry over to Filament's units, so start from Filament's defaults and tune `constantBias`, `normalBias` and the PCF softness against the reference renders (the soft shadows under tiles and on the dishes).

**Environment and hemisphere light**

```cpp
// environment/filament_ibl.ktx: 256², 5 levels, RGB16F, faces +X −X +Y −Y +Z −Z
Texture* ibl = ktxreader::Ktx1Reader::createTexture(engine, bundle, /*srgb*/ false);
IndirectLight* light = IndirectLight::Builder()
    .reflections(ibl)          // do NOT call .irradiance(): Filament then takes diffuse from the last level
    .intensity(0.85f)
    .build(*engine);
scene->setIndirectLight(light);
```

Filament reads level i of a 5-level cubemap at perceptual roughness r with `4·r·(2 − r) = i`, so the levels hold the game's environment at roughness 0, 0.1340, 0.2929, 0.5 and 1.0. With no spherical harmonics set, Filament's diffuse light is the last level (roughness 1) along the normal, which is exactly what three.js uses for diffuse; the hemisphere light is added into that level (already divided by π and by 0.85), so there is no separate hemisphere light. Between levels Filament mixes linearly in its own LOD scale, three.js in its own: glossy reflections at roughness between the five levels differ slightly (most visible on the clear coat of the tiles, roughness 0.05).

The cubemap's faces follow Filament's convention (`ibl::Cubemap::getDirectionFor`), so it needs no `cmgen` and no rotation. To check: rebuild `reference/ibl_probe.png` with no other lights: camera at `6.5·(0, 0.79151, 0.61116)` looking at the origin, 32° vertical, square; a chrome sphere (metallic 1, roughness 0, white) of radius 0.8 at x −0.9 and a matte sphere (metallic 0, roughness 1, #808080) at x +0.9; clear colour #808080, which three.js does not tone-map. If the bright panels on the chrome ball are mirrored or turned, fix it with `IndirectLight::Builder::rotation`. If the matte ball differs, the diffuse light is wrong. A second landmark is in the board renders: the soft light patch on the counter to the right of the back-right jar in `phone_level-21_last-jar_canvas.png` (around world (2.4, 0, −1.4)) is a bright panel of the room reflected in the counter's clear coat.

**Materials**

- Lit materials (`tiles.glb` bodies, glass, lid, gold, porcelain, ribbon, counter, confetti, hand) load through gltfio as they are: base colour, roughness, metalness, clear coat and sheen map one to one, and three.js's IOR 1.5 equals Filament's default reflectance 0.5.
- **Glass**: `blending: fade` (Filament's equivalent of straight alpha, which also fades reflections), opacity 0.11, depth write off, priority 2.
- **Unlit overlays** (`toneMapped: false` in the extras): write a small unlit `.mat` that undoes the tone mapper so the colour lands on screen as in the web game:

```
material {
    name : Overlay, shadingModel : unlit, blending : transparent, depthWrite : false,
    parameters : [ { type : sampler2d, name : map }, { type : float4, name : tint }, { type : float, name : alphaTest } ],
    requires : [ uv0 ]
}
fragment {
    // neutralInverse() from section 3
    void material(inout MaterialInputs material) {
        prepareMaterial(material);
        vec4 t = texture(materialParams_map, getUV0()) * materialParams.tint;   // map sampled as sRGB, tint linear
        if (t.a < materialParams.alphaTest) discard;
        vec3 c = neutralInverse(min(t.rgb, vec3(0.97)));
        material.baseColor = vec4(c * t.a, t.a);                                  // transparent blending is premultiplied
    }
}
```

  Use it for the digit decals (alpha test 0.02, `MaterialInstance::setPolygonOffset(-4, -4)`), the badge (camera-facing quad, priority 5), shines, rim, floor tint, rings, contact shadows (priority 0), sparks (priority 6) and tap arcs (`setDepthCulling(false)`, priority 7). The fresnel edge is the same idea with `alpha = 0.82·pow(1 − abs(dot(N, V)), 2.3)` and colour #9479D8.
- **What will still differ, and what to tune.** Filament blends before tone mapping, in linear light; the web blends after, in gamma space. Opaque pixels and fully opaque overlay pixels match exactly. Half-transparent pixels do not: soft shadow edges look lighter, the glass a little lighter, and the edges of the shines a little wider. Compare with `reference/*_canvas.png` and adjust the overlay opacities (contact shadow, glass, shines) until they match; the colours themselves need no change.

## 17. Metal recipe

A hand-written Metal renderer can match the web game exactly, because it can do what three.js does.

- Drawable `MTLPixelFormatBGRA8Unorm` (**not** `_sRGB`), 4× MSAA, depth `Depth32Float`, depth compare `lessEqual`, depth range [0, 1] (build the projection for it).
- Every fragment function ends with: lighting → `neutralToneMap()` (only if the material is tone-mapped) → sRGB encode (`c <= 0.0031308 ? 12.92c : 1.055·c^(1/2.4) − 0.055`) → output with straight alpha. Blending: rgb `sourceAlpha, oneMinusSourceAlpha`; alpha `one, oneMinusSourceAlpha`.
- Draw: the sky as a full-screen quad, then opaque meshes, then the transparent list sorted as in §8.
- Shading: port three.js r170's `MeshPhysicalMaterial` (MIT licence) from these shader chunks: `lights_physical_pars_fragment` (`BRDF_GGX`, `V_GGX_SmithCorrelated`, `D_GGX`, `F_Schlick`, clear coat, Charlie sheen, `computeMultiscattering`, `DFGApprox`), `lights_fragment_begin/maps/end`, `envmap_physical_pars_fragment`, `shadowmap_pars_fragment` (the `SHADOWMAP_TYPE_PCF_SOFT` branch) and `lights_pars_begin` (`getHemisphereLightIrradiance`). Keep three.js's details: roughness clamped to at least 0.0525 plus the geometric term from the normal's screen derivatives; the reflection vector bent toward the normal by roughness²; sheen first, `colour·(1 − 0.157·max(sheenColour)) + sheen`, then clear coat, `colour·(1 − clearcoat·Fcc) + clearcoat·clearcoatSpecular`.
- Environment: replace `textureCubeUV` with a lookup in the exported levels (`room_blur.hdr` is mip 8, then `ggx/mip_7` … `ggx/mip_m2`), keeping its mip choice and blend:

```c
float roughnessToMip(float r) {           // three.js r170
  if (r >= 0.8)   return (1.0 - r) * (-1.0 - -2.0) / (1.0 - 0.8) + -2.0;
  if (r >= 0.4)   return (0.8 - r) * (2.0 - -1.0) / (0.8 - 0.4) + -1.0;
  if (r >= 0.305) return (0.4 - r) * (3.0 - 2.0) / (0.4 - 0.305) + 2.0;
  if (r >= 0.21)  return (0.305 - r) * (4.0 - 3.0) / (0.305 - 0.21) + 3.0;
  return -2.0 * log2(1.16 * r);
}
// mip = clamp(roughnessToMip(r), -2, 8); colour = mix(level[floor(mip)], level[floor(mip) + 1], fract(mip))
// diffuse from the environment = level[-2] along the normal × 0.85 × diffuseColour × (1 − max(single + multi scattering)),
// as RE_IndirectSpecular_Physical does it
```

  Higher mip numbers are sharper. Every lookup is multiplied by 0.85.

## 18. Porting the rest of the game

- **Logic**: `src/logic.mjs` (solver, generator, chapters) and `src/meta.mjs` (combos, daily, streaks, themes, rush) are pure JavaScript with unit tests in `tests/unit/`; port them with their tests. Levels 1–100 are data in `src/levels.json`; daily puzzles in `src/dailies.json`.
- **Frame loop**: dt is clamped to 0.05 s. When nothing moves but the badges' bob, the web draws every other frame to save battery; that is optional.
- **Sound**: every sound is synthesised (`sfx`, `page.src.html:900`): oscillator notes and envelopes you can render once into files.
- **What is not here**: the 2D interface (`docs/DESIGN_SYSTEM.md` and its Figma file), and the home screen, which is page UI over the same scene.
