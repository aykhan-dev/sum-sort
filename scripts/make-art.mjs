// Draws the app icons and the link-preview image from the game itself. Run after a build: node scripts/make-art.mjs
//   icons/icon-192.png, icons/icon-512.png   rounded tile, for browsers and the install sheet
//   icons/maskable-512.png                   full bleed, for Android's shaped icons (the jar sits in the safe circle)
//   icons/apple-touch-icon.png               180 px, full bleed (iOS rounds the corners itself)
//   og.png                                   1200 x 630 link preview: the wordmark and a real board, mid-combo
// Needs Playwright with Chromium. Fonts come from Google Fonts, or from FONTS_DIR (Fredoka-700.woff2, Nunito-800.woff2)
// when the browser has no network.
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const pw = await import(process.env.PLAYWRIGHT || 'playwright'); const { chromium } = pw.default || pw;
const ROOT = fileURLToPath(new URL('..', import.meta.url)), FONTS = process.env.FONTS_DIR;
fs.mkdirSync(path.join(ROOT, 'icons'), { recursive: true });

const fontFace = () => FONTS
  ? ['Fredoka', 'Nunito'].map(f => `@font-face{font-family:'${f}';font-weight:400 900;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(FONTS, f + (f === 'Fredoka' ? '-700' : '-800') + '.woff2')).toString('base64')}) format('woff2')}`).join('')
  : `@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@800&display=block');`;

/* The icon: a glass candy jar with a gold lid and three gummies, on the counter's pink. No text, so it reads at 16 px. */
const jar = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD466"/><stop offset=".55" stop-color="#F5B83D"/><stop offset="1" stop-color="#D9962B"/></linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".55"/><stop offset=".5" stop-color="#E9DDFF" stop-opacity=".35"/><stop offset="1" stop-color="#C9B4F5" stop-opacity=".55"/></linearGradient>
  </defs>
  <ellipse cx="50" cy="86" rx="27" ry="4.5" fill="#B0507A" opacity=".18"/>
  <rect x="25" y="27" width="50" height="59" rx="11" fill="url(#glass)" stroke="#A58BE6" stroke-width="2.4"/>
  ${[['#F4DE3D', '#B0A203', 70], ['#9063F6', '#6036B6', 58], ['#F68741', '#B55903', 46]].map(([c, d, y]) =>
    `<rect x="31.5" y="${y}" width="37" height="11" rx="3.6" fill="${c}"/><rect x="31.5" y="${y + 8}" width="37" height="3" rx="1.5" fill="${d}" opacity=".45"/><rect x="34" y="${y + 1.6}" width="32" height="2.4" rx="1.2" fill="#FFFFFF" opacity=".55"/>`).join('')}
  <rect x="29" y="31" width="4.5" height="40" rx="2.25" fill="#FFFFFF" opacity=".85"/>
  <rect x="21.5" y="17" width="57" height="12" rx="5" fill="url(#g)"/>
  <rect x="21.5" y="25" width="57" height="4" rx="2" fill="#C88A20" opacity=".55"/>
  <rect x="26" y="19.2" width="48" height="2.6" rx="1.3" fill="#FFFFFF" opacity=".6"/>
  <circle cx="50" cy="14" r="4.6" fill="url(#g)"/>
  <path d="M80 18l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill="#FFFFFF"/>
</svg>`;
const iconPage = (size, { bleed, radius }) => `<!doctype html><html><head><style>
html,body{margin:0;width:${size}px;height:${size}px;background:transparent}
.t{width:${size}px;height:${size}px;border-radius:${radius}%;overflow:hidden;display:grid;place-items:center;
  background:radial-gradient(120% 90% at 30% 15%,#FFF1EA 0%,#FFD9CF 45%,#F6B9CB 100%)}
.t svg{width:${bleed ? 70 : 88}%;height:${bleed ? 70 : 88}%}
</style></head><body><div class="t">${jar}</div></body></html>`;

/* serve the built page to take a real board for the preview */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

for (const [file, size, opts] of [['icons/icon-512.png', 512, { radius: 22 }], ['icons/icon-192.png', 192, { radius: 22 }],
  ['icons/maskable-512.png', 512, { bleed: true, radius: 0 }], ['icons/apple-touch-icon.png', 180, { radius: 0 }]]) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(iconPage(size, opts)); await p.screenshot({ path: path.join(ROOT, file), omitBackground: true }); await p.close();
  console.log('wrote', file);
}

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
