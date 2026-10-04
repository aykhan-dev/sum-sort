// Draws the app icons and the link-preview image from the game itself. Run after a build: node scripts/make-art.mjs
// (add `icons` or `og` to draw only those)
//   icons/icon-192.png, icons/icon-512.png   squircle tile, for browsers and the install sheet
//   icons/maskable-512.png                   full bleed, for Android's shaped icons (the jar sits in the safe circle)
//   icons/apple-touch-icon.png               180 px, full bleed (iOS rounds the corners itself)
//   icons/icon-1024.png                      1024 px, full bleed, no transparency: the master for the app stores
//   og.png                                   1200 x 630 link preview: the wordmark and a real board, mid-combo
// Needs Playwright with Chromium. Fonts come from Google Fonts, or from FONTS_DIR (Fredoka-700.woff2, Nunito-800.woff2)
// when the browser has no network.
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const pw = await import(process.env.PLAYWRIGHT || 'playwright'); const { chromium } = pw.default || pw;
const ROOT = fileURLToPath(new URL('..', import.meta.url)), FONTS = process.env.FONTS_DIR;
const only = process.argv[2];
fs.mkdirSync(path.join(ROOT, 'icons'), { recursive: true });

const fontFace = () => FONTS
  ? ['Fredoka', 'Nunito'].map(f => `@font-face{font-family:'${f}';font-weight:400 900;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(FONTS, f + (f === 'Fredoka' ? '-700' : '-800') + '.woff2')).toString('base64')}) format('woff2')}`).join('')
  : `@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@800&display=block');`;

/* The icon is a real render of the game's own candy, in three.js: a sealed glass jar holding the 4, 3, 1 and 2 gummies,
   with a gold badge coin of 10 above the lid (the whole rule in one picture), on a raspberry sunburst. The jar, tiles,
   lid and lighting are the game's Candy Jar asset set. The coin's 10 still reads at home-screen size (60 px). */
const iconScene = () => `<!doctype html><html><head><style>${fontFace()}html,body{margin:0;background:transparent}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"./vendor/three/three.module.min.js","three/addons/":"./vendor/three/addons/"}}</script>
</head><body><script type="module">
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
await document.fonts.load('700 100px Fredoka');
const FONT = '"Fredoka","Arial Rounded MT Bold",sans-serif', GOLD = '#F5B83D', INK = '#3B2747';
const FLAVOURS = { 1: { hex: '#F4DE3D', mat: '#B0A203', ink: '#453E03' }, 2: { hex: '#9063F6', mat: '#6036B6', ink: '#332354' },
  3: { hex: '#F68741', mat: '#B55903', ink: '#613112' }, 4: { hex: '#6891E9', mat: '#385C9F', ink: '#1E3D70' } };
const TILE_W = 0.9, TILE_H = 0.44, STEP = 0.455, JAR_FLOOR = 0.095, LID_Y = 2.31;
const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const canvas = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.14).texture; scene.environmentIntensity = 0.85;
scene.add(new THREE.HemisphereLight(0xF3E8FF, 0xFFD9C7, 1.05));
const sun = new THREE.DirectionalLight(0xFFF1E2, 2.3); sun.position.set(-4.5, 10, 6.5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
const rim = new THREE.DirectionalLight(0xE7D6FF, 0.9); rim.position.set(6, 4, -7); scene.add(sun, rim);

/* the jar: tinted glass, a darker edge where the wall turns away, painted highlights (as in the game) */
const v2 = (x, y) => new THREE.Vector2(x, y);
const curve = new THREE.CatmullRomCurve3([v2(0, 0), v2(0.6, 0), v2(0.74, 0.03), v2(0.8, 0.12), v2(0.82, 0.3), v2(0.82, 1.72), v2(0.79, 1.86),
  v2(0.72, 1.96), v2(0.7, 2.02), v2(0.7, 2.14), v2(0.745, 2.16), v2(0.745, 2.27), v2(0.66, 2.27), v2(0.66, 2.02), v2(0.7, 1.95), v2(0.76, 1.85),
  v2(0.765, 1.72), v2(0.765, 0.3), v2(0.735, 0.16), v2(0.6, JAR_FLOOR), v2(0, JAR_FLOOR)].map(p => new THREE.Vector3(p.x, p.y, 0)), false, 'centripetal');
const jarGeo = new THREE.LatheGeometry(curve.getPoints(72).map(p => v2(Math.max(0, p.x), p.y)), 128);
const jar = new THREE.Group(); scene.add(jar);
jar.add(Object.assign(new THREE.Mesh(jarGeo, new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#D9C8FF'), transparent: true, opacity: 0.11,
  depthWrite: false, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.04, specularIntensity: 1, envMapIntensity: 1.5 })), { renderOrder: 1 }));
jar.add(Object.assign(new THREE.Mesh(jarGeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
  uniforms: { tint: { value: new THREE.Color('#9479D8') } },
  vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform vec3 tint; varying vec3 vN; varying vec3 vV; void main() { gl_FragColor = vec4(tint, pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.3) * 0.82);\\n#include <colorspace_fragment>\\n}' })), { renderOrder: 2 }));
const flat = (color, opacity, map) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color), map, transparent: true, opacity, depthWrite: false, toneMapped: false });
const base = new THREE.Mesh(new THREE.CircleGeometry(0.75, 96), flat('#BFA6EE', 0.2)); base.rotation.x = -Math.PI / 2; base.position.y = JAR_FLOOR + 0.004; jar.add(base);
const shine = tex(64, 256, g => {
  const v = g.createLinearGradient(0, 0, 0, 256); [[0, 0], [0.16, 1], [0.8, 1], [1, 0]].forEach(([at, a]) => v.addColorStop(at, 'rgba(255,255,255,' + a + ')'));
  g.fillStyle = v; g.fillRect(0, 0, 64, 256); g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 64, 0); [[0, 0], [0.3, 1], [0.7, 1], [1, 0]].forEach(([at, a]) => h.addColorStop(at, 'rgba(255,255,255,' + a + ')'));
  g.fillStyle = h; g.fillRect(0, 0, 64, 256); });
[[1.22, -1.05, 0.44, 0.9, 1.02], [0.42, -0.54, 0.11, 0.9, 1.36], [1.0, 0.82, 0.17, 0.36, 1.0]].forEach(([h, from, arc, a, y]) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.842, 0.842, h, 24, 1, true, from, arc), flat('#FFFFFF', a, shine)); m.position.y = y; m.renderOrder = 3; jar.add(m); });

/* the gummies, bottom to top, each turned a little: glossy candy with the digit in a deep shade of its colour */
const tileGeo = new RoundedBoxGeometry(TILE_W, TILE_H, TILE_W, 9, 0.13), decalGeo = new THREE.PlaneGeometry(0.44, 0.44);
[[4, 0.1], [3, -0.12], [1, 0.05], [2, -0.06]].forEach(([v, turn], k) => {
  const f = FLAVOURS[v], tile = new THREE.Group();
  const body = new THREE.Mesh(tileGeo, new THREE.MeshPhysicalMaterial({ color: new THREE.Color(f.mat), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.55 }));
  body.castShadow = body.receiveShadow = true;
  const digit = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, map: tex(512, 512, g => {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 500px ' + FONT;
    g.fillStyle = '#' + new THREE.Color(f.hex).lerp(new THREE.Color('#FFFFFF'), 0.6).getHexString(); g.globalAlpha = 0.85; g.fillText(v, 256, 295);
    g.fillStyle = f.ink; g.globalAlpha = 1; g.fillText(v, 256, 286); }) }));
  digit.position.z = TILE_W / 2 + 0.002; tile.add(body, digit);
  tile.position.y = JAR_FLOOR + TILE_H / 2 + 0.005 + k * STEP; tile.rotation.y = turn; scene.add(tile);
});

/* the lid, down: the jar is sealed */
const cream = new THREE.MeshPhysicalMaterial({ color: 0xFFF1DC, roughness: 0.2, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 });
const gold = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(GOLD), roughness: 0.16, metalness: 0.85, clearcoat: 0.6, clearcoatRoughness: 0.08 });
const lid = new THREE.Group(); lid.position.y = LID_Y; scene.add(lid);
const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.79, 0.81, 0.17, 112), cream);
const dome = new THREE.Mesh(new THREE.SphereGeometry(0.79, 112, 16, 0, Math.PI * 2, 0, 0.32), cream); dome.scale.y = 0.6; dome.position.y = 0.085 - 0.79 * 0.6 * Math.cos(0.32);
const band = new THREE.Mesh(new THREE.TorusGeometry(0.81, 0.035, 16, 128), gold); band.rotation.x = Math.PI / 2; band.position.y = -0.02;
const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 28, 20), gold); knob.scale.set(2.1, 1.5, 2.1); knob.position.y = 0.2;
cap.castShadow = dome.castShadow = knob.castShadow = true; lid.add(cap, dome, band, knob);

/* the jar's badge as a gold coin, turned toward the light so its edge shows */
const coin = new THREE.Group(); coin.position.set(0, 3.16, 0.3); coin.rotation.set(-0.28, 0.22, 0.08); coin.scale.setScalar(0.82); scene.add(coin);
const rimMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.16, 96), gold); rimMesh.rotation.x = Math.PI / 2; rimMesh.castShadow = true;
const face = new THREE.Mesh(new THREE.CircleGeometry(0.6, 96), new THREE.MeshPhysicalMaterial({ roughness: 0.25, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.6,
  map: tex(512, 512, g => {
    const gr = g.createRadialGradient(200, 170, 20, 256, 256, 260); gr.addColorStop(0, '#FFE9A0'); gr.addColorStop(0.6, '#F8C14A'); gr.addColorStop(1, '#E09A22');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    g.lineWidth = 22; g.strokeStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(256, 256, 206, 0, Math.PI * 2); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 280px ' + FONT;
    g.fillStyle = '#FFF3C4'; g.fillText('10', 256, 302); g.fillStyle = INK; g.fillText('10', 256, 290); }) }));
face.position.z = 0.081; coin.add(rimMesh, face);

/* a soft contact shadow under the jar */
const blob = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), flat('#FFFFFF', 1, tex(128, 128, g => {
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 64); [[0, 0.5], [0.55, 0.2], [1, 0]].forEach(([at, a]) => gr.addColorStop(at, 'rgba(70,10,50,' + a + ')'));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); })));
blob.rotation.x = -Math.PI / 2; blob.position.y = 0.002; blob.renderOrder = -1; scene.add(blob);

/* sparkles around the jar, placed in the scene so they follow the framing */
const SPARKLES = [[1.13, 3.29, 0.036, 1], [-1.13, 3.01, 0.028, 0.9], [1.41, 1.48, 0.022, 0.8], [-1.41, 1.15, 0.018, 0.7]];
function sparkle(g, x, y, r, a) {
  g.save(); g.globalAlpha = a; g.translate(x, y);
  const halo = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.1); halo.addColorStop(0, 'rgba(255,255,255,.7)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = halo; g.beginPath(); g.arc(0, 0, r * 1.1, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(r, 0);
  for (let i = 1; i <= 4; i++) { const a = i * Math.PI / 2, m = a - Math.PI / 4; g.quadraticCurveTo(Math.cos(m) * r * 0.16, Math.sin(m) * r * 0.16, Math.cos(a) * r, Math.sin(a) * r); }
  g.fill(); g.restore();
}
/* the room: a raspberry sunburst that opens behind the jar, a warm glow behind the coin, darker toward the corners */
function room(S, cam) {
  const at = (x, y, z) => { const p = new THREE.Vector3(x, y, z).project(cam); return [(p.x + 1) / 2 * S, (1 - p.y) / 2 * S]; };
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), [cx, cy] = at(0, 1.6, 0), zoom = cam.zoom;
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, S * 0.85);
  [[0, '#FFE6EC'], [0.3, '#FF9DB8'], [0.7, '#EC4D78'], [1, '#B8245A']].forEach(([s, col]) => gr.addColorStop(s, col)); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const r = document.createElement('canvas'); r.width = r.height = S; const h = r.getContext('2d');
  h.translate(cx, cy); h.fillStyle = '#FFFFFF';
  for (let i = 0; i < 14; i++) { h.rotate(Math.PI / 7); h.beginPath(); h.moveTo(0, 0); h.arc(0, 0, S * 1.5, -Math.PI / 28, Math.PI / 28); h.fill(); }
  h.setTransform(1, 0, 0, 1, 0, 0); h.globalCompositeOperation = 'destination-in';
  const fade = h.createRadialGradient(cx, cy, S * 0.05, cx, cy, S * 0.72); fade.addColorStop(0, '#000'); fade.addColorStop(1, 'rgba(0,0,0,0)'); h.fillStyle = fade; h.fillRect(0, 0, S, S);
  g.globalAlpha = 0.14; g.drawImage(r, 0, 0); g.globalAlpha = 1;
  const [gx, gy] = at(coin.position.x, coin.position.y, coin.position.z), glow = g.createRadialGradient(gx, gy, 0, gx, gy, S * 0.2 * zoom);
  glow.addColorStop(0, 'rgba(255,240,190,.75)'); glow.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = glow; g.fillRect(0, 0, S, S);
  const v = g.createRadialGradient(S / 2, S / 2, S * 0.45, S / 2, S / 2, S * 0.75); v.addColorStop(0, 'rgba(60,0,40,0)'); v.addColorStop(1, 'rgba(60,0,40,.25)');
  g.fillStyle = v; g.fillRect(0, 0, S, S);
  return { texture: Object.assign(new THREE.CanvasTexture(c), { colorSpace: THREE.SRGBColorSpace }), at };
}
/* draw at 2048 px or more and step down by halves, so every edge is smooth; a squircle is cut out for the rounded icons */
window.drawIcon = ({ size, zoom = 1, squircle = false }) => {
  const S = size * Math.max(2, Math.ceil(2048 / size));
  renderer.setPixelRatio(1); renderer.setSize(S, S, false);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100), el = 14 * Math.PI / 180;
  cam.position.set(0, 1.8 + Math.sin(el) * 8.1, Math.cos(el) * 8.1); cam.lookAt(0, 1.8, 0); cam.zoom = zoom; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const { texture, at } = room(S, cam);
  if (scene.background) scene.background.dispose(); scene.background = texture;
  renderer.render(scene, cam);
  let src = document.createElement('canvas'); src.width = src.height = S; const g = src.getContext('2d'); g.drawImage(canvas, 0, 0);
  SPARKLES.forEach(([x, y, r, a]) => sparkle(g, ...at(x, y, 0), r * S * zoom, a));
  while (src.width / 2 >= size * 1.4) { const half = document.createElement('canvas'); half.width = half.height = src.width / 2;
    const hg = half.getContext('2d'); hg.imageSmoothingQuality = 'high'; hg.drawImage(src, 0, 0, half.width, half.height); src = half; }
  const out = document.getElementById('out') || document.body.appendChild(Object.assign(document.createElement('canvas'), { id: 'out' }));
  out.width = out.height = size; const og = out.getContext('2d'); og.clearRect(0, 0, size, size);
  if (squircle) {   // a superellipse, the shape phones give their icons
    og.beginPath();
    for (let i = 0; i <= 720; i++) { const t = i / 360 * Math.PI, c = Math.cos(t), s = Math.sin(t);
      og.lineTo(size / 2 * (1 + Math.sign(c) * Math.abs(c) ** 0.4), size / 2 * (1 + Math.sign(s) * Math.abs(s) ** 0.4)); }
    og.fill(); og.globalCompositeOperation = 'source-in';
  }
  og.imageSmoothingQuality = 'high'; og.drawImage(src, 0, 0, size, size); og.globalCompositeOperation = 'source-over';
};
window.iconReady = true;
</script></body></html>`;

/* serve the built page to take a real board for the preview, and the icon scene beside it (three.js comes from vendor/) */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (req.url === '/__icon.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(iconScene()); }
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

if (only !== 'og') {
  const p = await browser.newPage({ viewport: { width: 1024, height: 1024 } }); p.on('pageerror', e => { throw e; });
  await p.goto(`http://127.0.0.1:${server.address().port}/__icon.html`); await p.waitForFunction(() => window.iconReady, null, { timeout: 180000 });
  // full-bleed icons are saved without an alpha channel: the App Store turns down a 1024 px icon that has one
  for (const [file, size, opts] of [['icons/icon-512.png', 512, { squircle: true }], ['icons/icon-192.png', 192, { squircle: true }],
    ['icons/maskable-512.png', 512, { zoom: 0.74 }], ['icons/apple-touch-icon.png', 180, {}], ['icons/icon-1024.png', 1024, {}]]) {
    await p.evaluate(o => window.drawIcon(o), { size, ...opts });
    await p.locator('#out').screenshot({ path: path.join(ROOT, file), omitBackground: !!opts.squircle });
    console.log('wrote', file);
  }
  await p.close();
}
if (only === 'icons') { await browser.close(); server.close(); process.exit(0); }

// a real board, mid-combo, in the game's own fonts
const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const game = await ctx.newPage(); game.setDefaultTimeout(180000);
await game.addInitScript(css => { window.__sumSortKeepQuality = true; localStorage.setItem('sumsort.proto.v1', JSON.stringify({ stars: {}, last: 26, sound: false }));
  document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }); }, FONTS ? fontFace() : '');
if (FONTS) await game.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await game.goto(`http://127.0.0.1:${server.address().port}/index.html`);
await game.waitForFunction(() => window.__sumSort && window.__sumSort.jars.length > 0);
await game.evaluate(() => document.fonts.ready);
await game.evaluate(() => { __sumSort.play(); });
await game.waitForTimeout(800);
const settled = () => game.waitForFunction(() => __sumSort.busy === 0 && __sumSort.flights === 0);
await game.addStyleTag({ content: '.callout{animation-play-state:paused!important;animation-delay:-.32s!important}' });
for (let k = 0; k < 30; k++) {   // play the plan until a combo word is up
  const m = await game.evaluate(() => __sumSort.plan && __sumSort.plan[0]); if (!m) break;
  await game.evaluate(m => { __sumSort.tap(m.src); __sumSort.tap({ kind: 'jar', i: m.dst }); }, m); await settled();
  if (await game.evaluate(() => __sumSort.chain >= 2)) { await game.waitForFunction(() => document.querySelector('.callout')); await game.waitForTimeout(600); break; }
}
const board = (await game.screenshot()).toString('base64');
await ctx.close();

const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await og.setContent(`<!doctype html><html><head><style>${fontFace()}
html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{background:linear-gradient(180deg,#E9DCFF 0%,#FFE0D2 55%,#FFD3C2 100%);font-family:'Nunito',sans-serif;color:#3B2747;position:relative}
.left{position:absolute;left:84px;top:64px;width:600px}
.mark{margin:0;display:grid;rotate:-4deg;font:700 150px/.86 'Fredoka',sans-serif;letter-spacing:1px}
.mark span:first-child{color:#E8456B;text-shadow:0 8px 0 #C7304F,0 22px 28px rgba(199,48,79,.28)}
.mark span:last-child{color:#3B2747;text-shadow:0 8px 0 #1F1228,0 22px 28px rgba(59,39,71,.25);margin-left:90px}
.motif{display:flex;align-items:center;gap:14px;margin:58px 0 0 6px;font:700 40px 'Fredoka',sans-serif;color:#6A5676}
.t{width:72px;height:72px;border-radius:20px;display:grid;place-items:center;font:700 42px 'Fredoka',sans-serif;box-shadow:inset 0 3px 0 rgba(255,255,255,.5),inset 0 -5px 0 rgba(0,0,0,.12),0 5px 0 rgba(59,39,71,.22)}
.t2{background:#9063F6;color:#332354}.t3{background:#F68741;color:#613112}
.badge{width:76px;height:76px;border-radius:50%;display:grid;place-items:center;font:700 42px 'Fredoka',sans-serif;color:#3B2747;background:#fff;border:5px solid #EADDF0;box-shadow:0 5px 12px -4px rgba(110,40,90,.45)}
.tag{margin:34px 0 0 8px;font:800 34px/1.25 'Nunito',sans-serif;max-width:560px}
.pills{display:flex;gap:12px;margin:22px 0 0 6px}
.pill{font:800 22px 'Nunito',sans-serif;padding:10px 20px;border-radius:999px;background:rgba(255,255,255,.85);border:2px solid #fff;box-shadow:0 8px 16px -10px rgba(110,40,90,.5)}
.phone{position:absolute;right:92px;top:38px;width:300px;height:585px;border-radius:44px;padding:10px;background:#3B2747;rotate:5deg;
  box-shadow:0 40px 60px -26px rgba(59,39,71,.65),0 0 0 3px rgba(255,255,255,.35) inset}
.phone img{width:100%;height:100%;border-radius:34px;display:block;object-fit:cover;object-position:top}
</style></head><body>
<div class="left">
  <h1 class="mark"><span>Sum</span><span>Sort</span></h1>
  <div class="motif"><span class="t t2">2</span>+<span class="t t3">3</span>=<span class="badge">5</span></div>
  <p class="tag">Fill every candy jar to its number.</p>
  <div class="pills"><span class="pill">100 levels and endless</span><span class="pill">A new daily puzzle</span></div>
</div>
<div class="phone"><img src="data:image/png;base64,${board}"></div>
</body></html>`);
await og.evaluate(() => document.fonts.ready);
await og.waitForTimeout(300);
await og.screenshot({ path: path.join(ROOT, 'og.png') });
console.log('wrote og.png');
await browser.close(); server.close();
