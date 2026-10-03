// Exports the 3D scene for native engines (Filament on Android, Metal on iOS) into native/.
// Run: npm i && npm run build && node scripts/export-3d.mjs
// It drives the built page in headless Chromium and exports the game's own objects, not copies of its code:
// glTF models, the textures drawn at runtime, the reflection environment, reference renders with the camera and
// board that made them, and whole reference boards as glTF scenes. native/README.md says how to rebuild the scene.
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const pw = await import(process.env.PLAYWRIGHT || 'playwright'); const { chromium } = pw.default || pw;
const ROOT = fileURLToPath(new URL('..', import.meta.url)), OUT = path.join(ROOT, 'native');
const built = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const BOOT = '/* ---------------- boot ---------------- */';
if (!built.includes(BOOT)) throw new Error('boot marker not found in index.html: run npm run build first');

// a window into the game's module, the GLTFExporter, and Fredoka served locally (the digits are drawn in it)
const HOOK = `window.__sumSort3D = { THREE, scene, camera, renderer, sun, rim, counter, playGroup, RoomEnvironment, makeTileMesh, makeJarView,
  makeDishView, makeLid, drawBadge, skyTexture, shineTex, blobTex, sparkTex, edgeMat, hitMat, miniGeo, miniMat, sculptGuide, FLAVOURS, THEMES,
  viewDir, boardLimits, K: { TILE_W, TILE_H, STEP, JAR_FLOOR, DISH_FLOOR, LID_Y, BADGE_Y, SEALED_RING },
  noIdle: () => clearTimeout(idleTimer),   // the 8-second nudge would light a ring mid-capture
  get sparks() { return bursts.length; },
  get camLook() { return camLook; }, get lastLayout() { return lastLayout; }, get narrow() { return narrow; } };\n`;
const FONT = `<style>@font-face{font-family:'Fredoka';font-weight:600;src:url(/node_modules/@fontsource/fredoka/files/fredoka-latin-600-normal.woff2) format('woff2')}
@font-face{font-family:'Fredoka';font-weight:700;src:url(/node_modules/@fontsource/fredoka/files/fredoka-latin-700-normal.woff2) format('woff2')}</style>`;
const EXPORTER = `<script type="module">import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'; window.__GLTFExporter = GLTFExporter;</script>`;
const page = built.replace(BOOT, HOOK + BOOT).replace('</head>', FONT + '</head>').replace('</body>', EXPORTER + '</body>');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/__export.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page); }
  const f = u.startsWith('/vendor/three/addons/exporters/') ? path.join(ROOT, 'node_modules/three/examples/jsm/exporters', path.basename(u)) : path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/__export.html`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

/* ---------------- in the page ---------------- */
// helpers the page keeps: base64, the extras glTF cannot carry, and the fresnel edge, which is a custom shader
const PAGE_LIB = () => {
  const S = window.__sumSort3D, T = S.THREE;
  const b64 = buf => { const a = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  const hex = c => '#' + c.getHexString();
  const mark = o => {
    if (!o.isMesh) return;
    const x = {}; if (o.renderOrder) x.renderOrder = o.renderOrder; if (o.castShadow) x.castShadow = true; if (o.receiveShadow) x.receiveShadow = true;
    o.userData = x;
    const m = o.material, y = Object.assign({}, m.userData.keep || {});
    if (m.toneMapped === false) y.toneMapped = false;
    if (m.depthWrite === false) y.depthWrite = false;
    if (m.depthTest === false) y.depthTest = false;
    if (m.side === T.DoubleSide) y.doubleSided = true;
    if (m.polygonOffset) y.polygonOffset = { factor: m.polygonOffsetFactor, units: m.polygonOffsetUnits };
    if (m.alphaTest) y.alphaTest = m.alphaTest;
    if (m.transparent) y.blend = 'alpha: src * a + dst * (1 - a), not premultiplied (three.js NormalBlending)';
    m.userData = Object.assign(y, { keep: m.userData.keep });
    delete m.userData.keep;
  };
  const edge = new T.MeshBasicMaterial({ name: 'jar_glass_edge', color: S.edgeMat.uniforms.tint.value, transparent: true, opacity: 0, depthWrite: false });
  edge.userData.keep = { customShader: 'fresnel edge: rgb = tint (sRGB #9479D8, no tone mapping), alpha = strength * pow(1 - |dot(N, V)|, power)', tint: '#9479D8', power: 2.3, strength: 0.82 };
  const glb = async obj => b64(await new window.__GLTFExporter().parseAsync(obj, { binary: true, onlyVisible: true }));
  window.__ex = { S, T, b64, hex, mark, edge, glb };
};

async function exportAssets() {
  const { S, T, mark, edge, glb } = window.__ex, files = {};
  const png = (name, canvas) => { files[`textures/${name}.png`] = canvas.toDataURL('image/png').split(',')[1]; };
  const name = (o, n, mat) => { o.name = n; if (mat && o.material) o.material.name = mat; mark(o); return o; };
  // tiles: a rounded candy body and two digit decals (top and front). One file, one shared body mesh; each tile's
  // root sits 1.2 apart along x so the file reads in a viewer (place the root yourself in the game)
  const tiles = new T.Group(); tiles.name = 'tiles';
  [1, 2, 3, 4, 5, 6, 7, 8, 9, '?'].forEach((v, i) => {
    const id = v === '?' ? 'frosted' : v, g = S.makeTileMesh(v), [body, front, top] = g.children;
    g.name = `tile_${id}`; g.userData = {}; g.position.x = i * 1.2; tiles.add(g);
    name(body, 'candy', `tile_${id}_candy`); name(front, 'digit_front', `tile_${id}_digit_front`); name(top, 'digit_top', `tile_${id}_digit_top`);
    png(`digit_${id}_top`, top.material.map.image); png(`digit_${id}_front`, front.material.map.image);
  });
  files['models/tiles.glb'] = await glb(tiles);
  // the jar: glass, its fresnel edge, the tinted floor, the rim, painted shines, the contact shadow and three floor rings
  const jv = S.makeJarView({ target: 7 }), [glass, edgeMesh, base, rim, shine, dot, back, blob, gold, selr, focus, lid, badge, hit] = jv.group.children;
  jv.group.remove(lid, badge, hit); jv.group.name = 'jar'; jv.group.userData = {};
  edgeMesh.material = edge;
  name(glass, 'glass', 'jar_glass'); name(edgeMesh, 'glass_edge'); name(base, 'floor_tint', 'jar_floor_tint'); name(rim, 'rim', 'jar_rim');
  name(shine, 'shine_front', 'jar_shine'); name(dot, 'shine_dot'); name(back, 'shine_back', 'jar_shine_soft'); name(blob, 'contact_shadow', 'contact_shadow');
  name(gold, 'ring_gold', 'ring_gold'); name(selr, 'ring_select', 'ring_select'); name(focus, 'ring_focus', 'ring_focus');
  files['models/jar.glb'] = await glb(jv.group);
  const lidG = S.makeLid(); lidG.name = 'jar_lid'; ['cap', 'dome', 'band', 'knob'].forEach((n, i) => name(lidG.children[i], n, i === 0 || i === 1 ? 'lid_cream' : 'gold'));
  files['models/jar_lid.glb'] = await glb(lidG);
  const rv = S.makeJarView({ target: 7, locked: true }), ribbon = rv.ribbon; rv.group.remove(ribbon); ribbon.name = 'jar_ribbon';
  name(ribbon.children[0], 'band', 'ribbon_satin'); const bow = ribbon.children[1]; bow.name = 'bow'; bow.children.forEach((c, i) => name(c, i < 2 ? `loop_${i + 1}` : 'knot'));
  files['models/jar_ribbon.glb'] = await glb(ribbon);
  // the dish that holds a stack
  const dv = S.makeDishView(), [dish, gilt, dblob, dsel, dfocus, dhit] = dv.group.children; dv.group.remove(dhit); dv.group.name = 'dish'; dv.group.userData = {};
  name(dish, 'porcelain', 'dish_porcelain'); name(gilt, 'gilt_rim', 'gold'); name(dblob, 'contact_shadow'); name(dsel, 'ring_select', 'ring_select'); name(dfocus, 'ring_focus', 'ring_focus');
  files['models/dish.glb'] = await glb(dv.group);
  // the counter, the confetti candy and the guide hand (sculpted from its distance field, as the game does)
  const c = S.counter.clone(); name(c, 'counter', 'counter_top'); files['models/counter.glb'] = await glb(c);
  const conf = new T.Mesh(S.miniGeo, S.miniMat); name(conf, 'confetti_candy', 'confetti_candy'); files['models/confetti_candy.glb'] = await glb(conf);
  const steps = S.sculptGuide(); let r; do r = steps.next(); while (!r.done);
  const G = r.value; G.hand.visible = true; G.hand.name = 'guide_hand'; name(G.hand.children[0], 'candy_hand', 'hand_glaze');
  files['models/guide_hand.glb'] = await glb(G.hand);
  G.taps.visible = true; G.taps.name = 'guide_tap_arcs'; G.taps.children.forEach((a, i) => { a.material.opacity = 0.95; a.scale.setScalar(0.36 + 0.2 * i); name(a, `arc_${i + 1}`, 'tap_arc'); });
  files['models/guide_tap_arcs.glb'] = await glb(G.taps);
  [G.hand, G.ghost, G.taps].forEach(o => S.scene.remove(o));
  // textures drawn at runtime
  png('shine', S.shineTex.image); png('contact_shadow', S.blobTex.image); png('spark', S.sparkTex.image);
  for (const t of S.THEMES) png(`sky_${t.id}`, S.skyTexture(t.sky).image);
  const BADGES = { waiting: { target: 7, sum: 0 }, filling: { target: 7, sum: 3 }, 'last-jar': { target: 7, sum: 0, finale: true }, sealed: { target: 7, sum: 7, sealed: true },
    locked: { target: 7, sum: 0, locked: true }, spare: { target: null, sum: 0, spare: true }, overfill: { target: 7, sum: 3, flash: true }, 'two-digit': { target: 14, sum: 2 } };
  for (const [n, st] of Object.entries(BADGES)) { const v = S.makeJarView({ target: st.target, spare: st.spare, locked: st.locked }); Object.assign(v.state, st); S.drawBadge(v); png(`badge_${n}`, v.badge.userData.ctx.canvas); }
  return files;
}

// The reflection environment, unwrapped to equirectangular maps in the three.js convention (see native/README.md):
// 'room' is three.js's RoomEnvironment rendered to a cube from the origin (the sharp source). A number is one level of
// the game's own scene.environment (PMREMGenerator.fromScene(room, 0.14)), read as the shader reads it: 8 is the
// sharpest (roughness up to 0.054), -2 the softest (roughness 1, which is also the diffuse light).
async function exportEnvironment([kind, W, H]) {
  const { S, T, b64 } = window.__ex, r = S.renderer, tm = r.toneMapping; r.toneMapping = T.NoToneMapping;
  const DIR = 'float phi = (vUv.x - 0.5) * 6.2831853, th = (vUv.y - 0.5) * 3.1415927; vec3 d = vec3(cos(th) * cos(phi), sin(th), cos(th) * sin(phi));';
  let mat;
  if (kind === 'room') {
    const cube = new T.WebGLCubeRenderTarget(512, { type: T.HalfFloatType, generateMipmaps: false });
    new T.CubeCamera(0.1, 100, cube).update(r, new S.RoomEnvironment());
    mat = new T.ShaderMaterial({ uniforms: { env: { value: cube.texture } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform samplerCube env; varying vec2 vUv; void main() { ${DIR} gl_FragColor = vec4(textureCube(env, d).rgb, 1.0); }` });
  } else {
    const env = S.scene.environment, h = env.image.height, maxMip = Math.log2(h) - 2;
    if (maxMip !== 8) throw new Error('unexpected PMREM size ' + h);
    mat = new T.ShaderMaterial({ uniforms: { envMap: { value: env } },
      defines: { ENVMAP_TYPE_CUBE_UV: '', CUBEUV_TEXEL_WIDTH: 1 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16)), CUBEUV_TEXEL_HEIGHT: 1 / h, CUBEUV_MAX_MIP: maxMip + '.0' },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D envMap; varying vec2 vUv;
        #include <common>
        #include <cube_uv_reflection_fragment>
        void main() { ${DIR} gl_FragColor = vec4(bilinearCubeUV(envMap, d, ${kind.toFixed(1)}), 1.0); }` });
  }
  const rt = new T.WebGLRenderTarget(W, H, { type: T.FloatType }), sc = new T.Scene(); sc.add(new T.Mesh(new T.PlaneGeometry(2, 2), mat));
  r.setRenderTarget(rt); r.render(sc, new T.Camera()); r.setRenderTarget(null); r.toneMapping = tm;
  const px = new Float32Array(W * H * 4); r.readRenderTargetPixels(rt, 0, 0, W, H, px);
  // a preview with the game's environment intensity and tone mapping, for eyes only
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), img = g.createImageData(W, H);
  const enc = x => x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = ((H - 1 - y) * W + x) * 4, o = (y * W + x) * 4; let c = [px[s], px[s + 1], px[s + 2]].map(v => v * 0.85);
    const lo = Math.min(...c), off = lo < 0.08 ? lo - 6.25 * lo * lo : 0.04; c = c.map(v => v - off);
    const peak = Math.max(...c);
    if (peak >= 0.76) { const d = 0.24, np = 1 - d * d / (peak + d - 0.76); c = c.map(v => v * np / peak); const gg = 1 - 1 / (0.15 * (peak - np) + 1); c = c.map(v => v + (np - v) * gg); }
    for (let k = 0; k < 3; k++) img.data[o + k] = Math.round(255 * Math.min(1, Math.max(0, enc(c[k]))));
    img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return { data: b64(new Uint8Array(px.buffer)), preview: cv.toDataURL('image/png').split(',')[1] };
}

// Filament's IBL, one level at a time: six faces of S x S, in the order and orientation Filament's cubemaps use
// (+X -X +Y -Y +Z -Z; texel (x, y) of a face looks along ibl::Cubemap::getDirectionFor). Filament reads level i at
// perceptual roughness r with r(2 - r) = i / 4, so each level holds the game's environment at exactly that roughness.
// The last level is also Filament's diffuse light (no SH given), so the hemisphere light is added to it there.
async function exportFilamentLevel([S, roughness, hemi]) {
  const { S: G, T, b64 } = window.__ex, r = G.renderer, tm = r.toneMapping; r.toneMapping = T.NoToneMapping;
  const env = G.scene.environment, h = env.image.height, maxMip = Math.log2(h) - 2;
  const mat = new T.ShaderMaterial({
    uniforms: { envMap: { value: env }, size: { value: S }, rough: { value: roughness }, hemi: { value: hemi },
      sky: { value: new T.Color('#F3E8FF') }, ground: { value: new T.Color('#FFD9C7') } },
    defines: { ENVMAP_TYPE_CUBE_UV: '', CUBEUV_TEXEL_WIDTH: 1 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16)), CUBEUV_TEXEL_HEIGHT: 1 / h, CUBEUV_MAX_MIP: maxMip + '.0' },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D envMap; uniform float size, rough, hemi; uniform vec3 sky, ground;
      #include <common>
      #include <cube_uv_reflection_fragment>
      void main() {
        float row = floor(gl_FragCoord.y), face = floor(row / size), y = row - face * size, x = floor(gl_FragCoord.x);
        float cx = (x + 0.5) * 2.0 / size - 1.0, cy = 1.0 - (y + 0.5) * 2.0 / size;
        vec3 d = face < 0.5 ? vec3(1.0, cy, -cx) : face < 1.5 ? vec3(-1.0, cy, cx) : face < 2.5 ? vec3(cx, 1.0, -cy)
          : face < 3.5 ? vec3(cx, -1.0, cy) : face < 4.5 ? vec3(cx, cy, 1.0) : vec3(-cx, cy, -1.0);
        d = normalize(d);
        vec3 c = textureCubeUV(envMap, d, rough).rgb + hemi * mix(ground, sky, 0.5 * d.y + 0.5);
        gl_FragColor = vec4(c, 1.0);
      }` });
  const rt = new T.WebGLRenderTarget(S, 6 * S, { type: T.FloatType }), sc = new T.Scene(); sc.add(new T.Mesh(new T.PlaneGeometry(2, 2), mat));
  r.setRenderTarget(rt); r.render(sc, new T.Camera()); r.setRenderTarget(null); r.toneMapping = tm;
  const px = new Float32Array(S * 6 * S * 4); r.readRenderTargetPixels(rt, 0, 0, S, 6 * S, px);
  return b64(new Uint8Array(px.buffer));
}

// The light check: a chrome ball and a grey matte ball lit by the environment and the hemisphere light only, seen
// along the phone camera's direction. Rendered to the canvas, so tone mapping and sRGB output are the game's own.
async function renderProbe(size) {
  const { S: G, T } = window.__ex, r = G.renderer, c = r.domElement, keep = [c.width, c.height, r.getPixelRatio()];
  const sc = new T.Scene(); sc.environment = G.scene.environment; sc.environmentIntensity = 0.85; sc.background = new T.Color('#808080');
  sc.add(new T.HemisphereLight(0xF3E8FF, 0xFFD9C7, 1.05));
  const geo = new T.SphereGeometry(0.8, 128, 64);
  const chrome = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0xFFFFFF, metalness: 1, roughness: 0 })); chrome.position.x = -0.9;
  const matte = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0x808080, metalness: 0, roughness: 1 })); matte.position.x = 0.9;
  sc.add(chrome, matte);
  const cam = new T.PerspectiveCamera(32, 1, 0.1, 120); cam.position.set(0, 0.79151, 0.61116).multiplyScalar(6.5); cam.lookAt(0, 0, 0);
  r.setPixelRatio(1); r.setSize(size, size, false); r.render(sc, cam);
  const png = c.toDataURL('image/png').split(',')[1];
  r.setPixelRatio(keep[2]); r.setSize(keep[0] / keep[2], keep[1] / keep[2], false);
  return png;
}

// what a reference render shows: the camera, the lights, the layout and every jar and stack on the board
function describe() {
  const { S } = window.__ex, v = o => o && [o.x, o.y, o.z].map(n => +n.toFixed(5)), q = o => [o.x, o.y, o.z, o.w].map(n => +n.toFixed(6));
  const c = S.camera, sc = S.sun.shadow.camera, L = S.lastLayout;
  return {
    viewport: { cssWidth: innerWidth, cssHeight: innerHeight, devicePixelRatio, pixelRatio: S.renderer.getPixelRatio(), drawingBuffer: [S.renderer.domElement.width, S.renderer.domElement.height] },
    camera: { fovYDeg: c.fov, near: c.near, far: c.far, aspect: +c.aspect.toFixed(6), position: v(c.position), target: v(S.camLook), quaternion: q(c.quaternion), viewDir: v(S.viewDir()), narrow: S.narrow },
    fitLimits: S.boardLimits(),
    layout: L && { minX: L.minX, maxX: L.maxX, minZ: L.minZ, maxZ: L.maxZ, zones: L.zones.map(z => ({ min: v(z.min), max: v(z.max) })) },
    sun: { position: v(S.sun.position), target: v(S.sun.target.position), shadowCamera: { left: sc.left, right: sc.right, top: sc.top, bottom: sc.bottom, near: sc.near, far: sc.far }, mapSize: [S.sun.shadow.mapSize.x, S.sun.shadow.mapSize.y] },
    jars: window.__sumSort.jars.map(j => ({ position: v(j.view.group.position), target: j.t, sum: j.tiles.reduce((a, t) => a + t.v, 0), tiles: j.tiles.map(t => t.hidden ? '?' : t.v), sealed: j.sealed, ribbon: !!j.view.ribbonOn, spare: j.spare, finale: !!j.view.state.finale })),
    stacks: window.__sumSort.stacks.map(s => ({ position: v(s.view.group.position), tiles: s.tiles.map(t => t.hidden ? '?' : t.v) })),
  };
}

// a whole board as one glTF scene: counter, jars, stacks, lights and the camera exactly as on screen.
// Badges are sprites in the game; here each is a quad turned to the camera, with its drawn texture.
async function exportScene(label) {
  const { S, T, mark, edge, glb } = window.__ex;
  const root = new T.Group(); root.name = `sum_sort_${label}`;
  const board = S.playGroup.clone(true); board.name = 'board';
  const swap = [];
  board.traverse(o => { if (o.userData && o.userData.volume) swap.push([o, null]); else if (o.isSprite) swap.push([o, 'badge']); else if (o.material === S.edgeMat) o.material = edge; });
  for (const [o, kind] of swap) {
    if (kind) {
      const quad = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ name: 'badge', map: o.material.map, transparent: true, depthWrite: false, toneMapped: false }));
      quad.name = 'badge_billboard'; quad.position.copy(o.position); quad.scale.copy(o.scale); quad.renderOrder = o.renderOrder;
      quad.material.userData.keep = { billboard: 'screen-aligned sprite in the game: always faces the camera' };
      o.parent.add(quad); quad.updateWorldMatrix(true, false);
      quad.quaternion.copy(o.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(S.camera.quaternion));
    }
    o.parent.remove(o);
  }
  board.traverse(mark);
  const counter = S.counter.clone(); counter.name = 'counter'; mark(counter);
  const light = (src, nm, target) => {
    const l = new T.DirectionalLight(src.color, src.intensity); l.name = nm; l.position.copy(src.position); l.add(l.target); l.target.position.set(0, 0, -1);
    l.lookAt(target); l.userData = { castShadow: src.castShadow };
    return l;
  };
  const cam = S.camera.clone(); cam.name = 'camera'; cam.userData = { target: S.camLook.toArray() };
  root.add(counter, board, light(S.sun, 'sun', S.sun.target.position), light(S.rim, 'rim', new T.Vector3()), cam);
  root.userData = { hemisphereLight: { sky: '#F3E8FF', ground: '#FFD9C7', intensity: 1.05 }, environment: 'native/environment/room_blur.hdr, intensity 0.85', toneMapping: 'Khronos PBR Neutral, exposure 1', output: 'sRGB' };
  return glb(root);
}

/* ---------------- driving ---------------- */
const write = (rel, b64) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.from(b64, 'base64')); return f; };
async function open(viewport, dpr) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); p.setDefaultTimeout(240000);
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.addInitScript(() => { window.__sumSortKeepQuality = true; });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL_);
  await p.waitForFunction(() => window.__sumSort && window.__sumSort3D && window.__GLTFExporter && window.__sumSort.jars.length > 0);
  if (!(await p.evaluate(() => document.fonts.check('700 120px Fredoka')))) throw new Error('Fredoka did not load: the digits would be drawn in a fallback font');
  await p.evaluate(PAGE_LIB);
  return { p, ctx, errors };
}
const settled = p => p.waitForFunction(() => window.__sumSort.busy === 0 && window.__sumSort.flights === 0);

fs.rmSync(OUT + '/models', { recursive: true, force: true }); fs.rmSync(OUT + '/textures', { recursive: true, force: true });
fs.rmSync(OUT + '/reference', { recursive: true, force: true }); fs.rmSync(OUT + '/environment', { recursive: true, force: true });

// A KTX 1.1 cubemap (RGB16F, mip levels, faces +X -X +Y -Y +Z -Z), which Filament's ktxreader loads as it is
const half = (() => {
  const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
  return v => {
    f32[0] = v; const x = u32[0], sign = (x >>> 16) & 0x8000; let e = ((x >>> 23) & 0xff) - 127 + 15, m = x & 0x7fffff;
    if (e >= 31) return sign | 0x7bff;
    if (e <= 0) { if (e < -10) return sign; m |= 0x800000; const sh = 14 - e; return sign | ((m + (1 << (sh - 1))) >> sh); }
    const hm = (m + 0x1000) >> 13; return hm === 0x400 ? sign | ((e + 1) << 10) : sign | (e << 10) | hm;
  };
})();
function writeKTXCube(rel, levels) {   // levels: [{ S, data: Float32Array RGBA, face-major rows as exportFilamentLevel lays them }]
  const head = Buffer.alloc(64);
  Buffer.from([0xAB, 0x4B, 0x54, 0x58, 0x20, 0x31, 0x31, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A]).copy(head, 0);
  [0x04030201, 0x140B, 2, 0x1907, 0x881B, 0x1907, levels[0].S, levels[0].S, 0, 0, 6, levels.length, 0].forEach((v, i) => head.writeUInt32LE(v, 12 + 4 * i));
  const parts = [head];
  for (const { S, data } of levels) {
    const faceBytes = S * S * 6, padded = (faceBytes + 3) & ~3, size = Buffer.alloc(4); size.writeUInt32LE(faceBytes); parts.push(size);
    for (let f = 0; f < 6; f++) {
      const b = Buffer.alloc(padded);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const s = ((f * S + y) * S + x) * 4, d = (y * S + x) * 6;
        for (let c = 0; c < 3; c++) b.writeUInt16LE(half(data[s + c]), d + 2 * c);
      }
      parts.push(b);
    }
  }
  const file = path.join(OUT, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.concat(parts));
}

// Radiance .hdr (RGBE, flat scanlines) from float RGBA rows that run bottom to top
function writeHDR(rel, W, H, b64) {
  const f = new Float32Array(Buffer.from(b64, 'base64').buffer.slice(0)), body = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = ((H - 1 - y) * W + x) * 4, d = (y * W + x) * 4, m = Math.max(f[s], f[s + 1], f[s + 2]);
    if (m < 1e-32) continue;
    let e = Math.ceil(Math.log2(m)); if (m / 2 ** e >= 1) e++;
    const k = 256 / 2 ** e;
    body[d] = Math.min(255, Math.floor(f[s] * k)); body[d + 1] = Math.min(255, Math.floor(f[s + 1] * k)); body[d + 2] = Math.min(255, Math.floor(f[s + 2] * k)); body[d + 3] = e + 128;
  }
  const head = `#?RADIANCE\n# Sum Sort reflection environment: three.js RoomEnvironment, linear, intensity 1 (the game uses 0.85)\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`;
  const file = path.join(OUT, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.concat([Buffer.from(head), body]));
}

// 1. models and textures, then the environment
{
  const { p, ctx, errors } = await open({ width: 390, height: 844 }, 2);
  const files = await p.evaluate(exportAssets);
  for (const [rel, data] of Object.entries(files)) write(rel, data);
  console.log('models and textures:', Object.keys(files).length, 'files');
  // the sharp room, then every level of the prefiltered environment, each at about its own resolution
  const LEVELS = [['room', 'room', 1024, 512], [8, 'room_blur', 1024, 512]];
  for (let m = 7; m >= -2; m--) LEVELS.push([m, `ggx/mip_${m < 0 ? 'm' + -m : m}`, Math.max(128, 4 * 2 ** Math.max(m, 4)), Math.max(64, 2 * 2 ** Math.max(m, 4))]);
  for (const [kind, name, W, H] of LEVELS) {
    const env = await p.evaluate(exportEnvironment, [kind, W, H]);
    writeHDR(`environment/${name}.hdr`, W, H, env.data);
    if (kind === 'room' || kind === 8 || kind === -2) write(`environment/${name.replace('ggx/mip_m2', 'diffuse')}_preview.png`, env.preview);
    console.log('environment:', name, W + 'x' + H);
  }
  // Filament: 256 down to 16, the roughness each level is read at, and the hemisphere light (÷ π, as three.js applies it,
  // ÷ 0.85, the IBL intensity it will be drawn at) in the last level, which Filament also uses as the diffuse light
  const filament = [];
  for (let i = 0; i < 5; i++) {
    const S = 256 >> i, rough = 1 - Math.sqrt(1 - i / 4);
    const data = await p.evaluate(exportFilamentLevel, [S, rough, i === 4 ? 1.05 / Math.PI / 0.85 : 0]);
    filament.push({ S, rough, data: new Float32Array(Buffer.from(data, 'base64').buffer.slice(0)) });
  }
  writeKTXCube('environment/filament_ibl.ktx', filament);
  write('reference/ibl_probe.png', await p.evaluate(renderProbe, 512));
  console.log('environment: filament_ibl.ktx, roughness per level', filament.map(l => l.rough.toFixed(4)).join(' '));
  await ctx.close(); if (errors.length) throw new Error(errors.join('\n'));
}

// 2. reference renders: the page as the player sees it, the canvas alone, the numbers behind it, and the board as glTF
const REFS = [
  { name: 'phone_level-21', viewport: { width: 390, height: 844 }, dpr: 2.5, level: 21 },
  { name: 'phone_level-21_last-jar', viewport: { width: 390, height: 844 }, dpr: 2.5, level: 21, play: 'finale' },
  { name: 'phone_level-44', viewport: { width: 390, height: 844 }, dpr: 2.5, level: 44 },
  { name: 'tablet_level-21', viewport: { width: 1024, height: 768 }, dpr: 2, level: 21 },
];
fs.mkdirSync(path.join(OUT, 'reference'), { recursive: true });
for (const ref of REFS) {
  const { p, ctx, errors } = await open(ref.viewport, ref.dpr);
  await p.evaluate(n => { window.__sumSort.play(); window.__sumSort.goLevel(n); window.__sumSort3D.noIdle(); }, ref.level);
  await p.waitForTimeout(1500); await settled(p);
  if (ref.play === 'finale') {
    for (let i = 0; i < 30 && (await p.evaluate(() => window.__sumSort.finale)) < 0; i++) {
      const m = await p.evaluate(() => window.__sumSort.plan && window.__sumSort.plan[0]);
      if (!m) throw new Error('no plan on level ' + ref.level);
      await p.evaluate(m => window.__sumSort.tap({ kind: m.src.kind, i: m.src.i }), m); await p.waitForTimeout(200);
      await p.evaluate(m => window.__sumSort.tap({ kind: 'jar', i: m.dst }), m); await p.waitForTimeout(900); await settled(p);
      await p.evaluate(() => window.__sumSort3D.noIdle());
    }
    await p.waitForTimeout(1200);
    await p.waitForFunction(() => window.__sumSort3D.sparks === 0);   // software rendering runs the particles' clock slow
  }
  await p.screenshot({ path: path.join(OUT, 'reference', `${ref.name}.png`) });
  // the canvas alone: its own pixels, drawn now, with nothing of the page over it
  write(`reference/${ref.name}_canvas.png`, await p.evaluate(() => {
    const S = window.__sumSort3D; S.renderer.render(S.scene, S.camera); return S.renderer.domElement.toDataURL('image/png').split(',')[1];
  }));
  const info = await p.evaluate(describe);
  fs.writeFileSync(path.join(OUT, 'reference', `${ref.name}.json`), JSON.stringify({ level: ref.level, ...info }, null, 1) + '\n');
  write(`reference/${ref.name}.glb`, await p.evaluate(exportScene, ref.name));
  console.log('reference:', ref.name, info.viewport.drawingBuffer.join('x'), 'camera', info.camera.position.join(', '));
  await ctx.close(); if (errors.length) throw new Error(errors.join('\n'));
}
await browser.close(); server.closeAllConnections(); server.close();
