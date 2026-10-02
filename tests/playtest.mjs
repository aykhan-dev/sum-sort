// Play-test: drives the built index.html in headless Chromium with real touches.
// Run: npm i && npx playwright install chromium && npm test     (set PLAYWRIGHT=/path/to/playwright/index.js to reuse an install)
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const pw = await import(process.env.PLAYWRIGHT || 'playwright'); const { chromium } = pw.default || pw;
const ROOT = fileURLToPath(new URL('..', import.meta.url)), SHOTS = path.join(ROOT, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const URL_ = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await ctx.newPage(); page.setDefaultTimeout(180000);
await page.addInitScript(() => { window.__sumSortKeepQuality = true; });   // the test decides the render quality itself
// sharing goes to a clipboard the test can read, never to a real share sheet
await page.addInitScript(() => { window.__copied = []; Object.defineProperty(navigator, 'share', { value: undefined });
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__copied.push(t); return Promise.resolve(); } } }); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());   // system fonts are enough here, and the run stays offline
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(URL_);
await page.waitForFunction(() => window.__sumSort && window.__sumSort.jars.length > 0);
await page.evaluate(() => __sumSort.dropQuality());
let fails = 0;
const pass = (name, ok, extra = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
// 0. home: the game opens on it, shows the current level, and Play is the only way in
const H = () => page.evaluate(() => ({ open: __sumSort.home, off: document.getElementById('home').classList.contains('off'), num: document.getElementById('homeNum').textContent, chapter: document.getElementById('homeChapter').textContent, tally: document.getElementById('starTally').hidden ? null : document.getElementById('starTally').textContent, level: __sumSort.level, moves: __sumSort.moves }));
const tapEl = async sel => { const p = await page.evaluate(sel => { const el = document.querySelector(sel), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y); return { x, y, ok: !!hit && (hit === el || el.contains(hit)) }; }, sel);
  if (!p.ok) console.log('COVERED: ' + sel); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(450); };
let h0 = await H(); console.log('home at start'.padEnd(30), JSON.stringify(h0));
pass('game opens on home with level 1 and no star tally', h0.open && !h0.off && h0.num === '1' && h0.chapter === 'Match' && h0.tally === null);
{ const d = await page.evaluate(() => ({ dis: document.getElementById('dailyBtn').getAttribute('aria-disabled'), label: document.getElementById('dailyBtn').getAttribute('aria-label') }));
  await page.evaluate(() => document.getElementById('dailyBtn').click()); await page.waitForTimeout(300);
  pass('a new player sees the daily locked, with how far to go', d.dis === 'true' && /opens at level 19, 18 levels to go/.test(d.label) && await page.evaluate(() => __sumSort.home && !__sumSort.daily), d.label); }
{ const p = await page.evaluate(() => __sumSort.screenOf('stack', 0, 0.5)); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(250);
  pass('board cannot be touched through home', !(await page.evaluate(() => __sumSort.sel))); }
{ const j = await page.evaluate(() => ({ count: homeCount.textContent, next: homeNext.textContent, segs: homeBar.children.length, now: homeBar.querySelectorAll('.now').length }));
  pass('home shows the chapter journey and what opens next', j.count === '1 of 10' && j.segs === 10 && j.now === 1 && j.next === 'Up next: two-tile jars and the Undo booster at level 11', JSON.stringify(j)); }
pass('no level list, no replay of old levels', (await page.evaluate(() => ['levelBtn', 'levels', 'replayBtn'].every(id => !document.getElementById(id)))));
await page.screenshot({ path: SHOTS + '/home-1.png' });
await tapEl('#playBtn'); h0 = await H();
pass('Play opens the current level', !h0.open && h0.off && h0.level === 1);
const settled = () => page.waitForFunction(() => __sumSort.busy === 0 && __sumSort.flights === 0);
const S = () => page.evaluate(() => ({
  jars: __sumSort.jars.map(j => (j.sealed ? '#' : '') + j.t + ':' + j.tiles.map(x => x.v).join('+')).join(' '),
  stacks: __sumSort.stacks.map(s => s.tiles.map(x => (x.hidden ? '?' : '') + x.v).join(',')).join(' | '),
  dead: __sumSort.dead, soft: __sumSort.softDead, won: __sumSort.won, moves: __sumSort.moves, sel: __sumSort.sel, flights: __sumSort.flights, busy: __sumSort.busy,
  tip: document.getElementById('tip').textContent, strip: document.getElementById('strip').className,
  tray: [...document.querySelectorAll('#tray button')].filter(b => !b.hidden).map(b => b.id.replace('Btn', '') + (b.classList.contains('fresh') ? '*' : '')).join(','),
  trayHidden: document.getElementById('tray').hidden, hudHidden: document.getElementById('hud').hidden }));
const log = (label, v) => console.log(label.padEnd(30), typeof v === 'string' ? v : JSON.stringify(v));
const go = async n => { await page.evaluate(n => __sumSort.goLevel(n), n); await page.waitForTimeout(900); };
const touch = async (kind, i, y) => { const p = await page.evaluate(([k, i, y]) => __sumSort.screenOf(k, i, y), [kind, i, y ?? (kind === 'jar' ? 0.9 : 0.5)]); await page.touchscreen.tap(p.x, p.y); };

// 1. chapter 1: nothing but the board; a wrong jar says which tile it wants; cannot dead-end
await go(1); let s = await S(); log('L1', s);
pass('chapter 1 hides boosters and Moves/Par', s.trayHidden && s.hudHidden);
await touch('stack', 0); await page.waitForTimeout(250);
const wrong = await page.evaluate(() => { const v = __sumSort.stacks[0].tiles.at(-1).v; return __sumSort.jars.findIndex(j => j.t !== v); });
await touch('jar', wrong); await page.waitForTimeout(250); s = await S();
pass('exact-fit jar rejects the wrong tile', s.moves === 0 && /wants the/.test(s.tip), s.tip);
await page.evaluate(() => __sumSort.tap(null));
// 2. finger-down + overlapping moves: fire three full moves 60 ms apart on level 5 and check none is lost
await go(5); await settled();
const plan = await page.evaluate(() => __sumSort.plan.slice(0, 3).map(m => ({ s: m.src.i, d: m.dst })));
const t0 = Date.now();
for (const m of plan) { await page.evaluate(m => { __sumSort.tap({ kind: 'stack', i: m.s }); __sumSort.tap({ kind: 'jar', i: m.d }); }, m); await page.waitForTimeout(60); }
s = await S(); log('3 moves in ' + (Date.now() - t0) + ' ms', { moves: s.moves, flights: s.flights, busy: s.busy });
pass('no tap is dropped while tiles fly', s.moves === 3);
await settled(); await page.waitForTimeout(700); log('L5 after landing', (await S()).jars);
// real touch acts on finger-down
await go(2); await settled();
const p0 = await page.evaluate(() => __sumSort.screenOf('stack', 0, 0.5));
const cdp = await ctx.newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p0.x, y: p0.y }] });
await page.waitForTimeout(120); const selDown = (await S()).sel;
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
pass('selection starts on finger-down', !!selDown, JSON.stringify(selDown));
// 3. booster unlocks
const trays = {};
for (const n of [10, 11, 12, 13, 15, 21]) { await go(n); trays[n] = (await S()).tray; }
log('boosters by level', trays);
pass('boosters arrive one at a time', trays[10] === '' && trays[11] === 'undo*' && trays[13] === 'undo,hint*' && trays[15] === 'undo,spare*,hint' && trays[21] === 'undo,spare,split*,hint');
// 4. jar-to-jar tutorial level: only legal move is jar to jar
await go(12); await settled(); s = await S(); log('L12', s);
await touch('stack', 0); await page.waitForTimeout(200); await touch('jar', 0); await page.waitForTimeout(300); const rej = (await S()).tip;
await page.evaluate(() => __sumSort.tap(null));
await touch('jar', 0); await page.waitForTimeout(250); await touch('jar', 1); await settled(); await page.waitForTimeout(800);
await touch('stack', 0); await page.waitForTimeout(250); await touch('jar', 0); await page.waitForTimeout(2800);
s = await S(); pass('tutorial: stack tile rejected, jar-to-jar move wins the level', /Too big/.test(rej) && s.won, rej);
log('L12 win card', await page.evaluate(() => ({ title: document.getElementById('winTitle').textContent, statsHidden: document.getElementById('winStats').hidden, text: document.getElementById('winText').textContent })));
// 5. soft dead end and hard dead end on level 11
await go(11); await settled(); s = await S(); log('L11', s);
// play random non-plan stack moves until the board is soft-dead or dead. The random source is seeded, so every run
// plays the same moves and reaches the same dead ends.
await page.evaluate(() => { let a = 20261002; window.__rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; });
let seenSoft = false, seenDead = false;
for (let tryNo = 0; tryNo < 24 && !(seenSoft && seenDead); tryNo++) {
  await go(11 + (tryNo % 6 === 1 ? 2 : tryNo % 6)); await settled();
  for (let k = 0; k < 14; k++) {
    const mv = await page.evaluate(() => { const S = __sumSort.stacks, J = __sumSort.jars, out = [];
      S.forEach((s, si) => { const t = s.tiles.at(-1); if (!t) return; J.forEach((j, di) => { const sum = j.tiles.reduce((a, x) => a + x.v, 0); if (!j.sealed && j.tiles.length < 4 && sum + t.v <= j.t && sum + t.v !== j.t) out.push([si, di]); }); });
      return out.length ? out[Math.floor(window.__rnd() * out.length)] : null; });
    if (!mv) break;
    await page.evaluate(([a, b]) => { __sumSort.tap({ kind: 'stack', i: a }); __sumSort.tap({ kind: 'jar', i: b }); }, mv); await settled(); await page.waitForTimeout(80);
    s = await S();
    if (s.soft && !seenSoft) { seenSoft = true; log('soft dead end', { level: await page.evaluate(() => __sumSort.level), tip: s.tip, strip: s.strip, jars: s.jars, stacks: s.stacks }); await page.screenshot({ path: SHOTS + '/soft.png' }); }
    if (s.dead && !seenDead) { seenDead = true; log('hard dead end', { tip: s.tip, strip: s.strip }); await page.waitForTimeout(600); await page.screenshot({ path: SHOTS + '/dead.png' }); }
    if (s.dead || s.won) break;
  }
}
pass('soft dead end has its own message', seenSoft); pass('hard dead end still reported', seenDead);
// 6. remembered tap during an undo, and undo lock time
await go(14); await settled();
let m = await page.evaluate(() => __sumSort.plan[0]);
await page.evaluate(m => { __sumSort.tap(m.src); __sumSort.tap({ kind: 'jar', i: m.dst }); }, m); await settled();
const lock = await page.evaluate(() => new Promise(res => { const t = performance.now(); document.getElementById('undoBtn').click(); __sumSort.tap({ kind: 'stack', i: 0 });
  const was = __sumSort.pending; const iv = setInterval(() => { if (__sumSort.busy === 0) { clearInterval(iv); setTimeout(() => res({ ms: Math.round(performance.now() - t), remembered: was, sel: __sumSort.sel, moves: __sumSort.moves }), 60); } }, 10); }));
log('undo', lock); pass('tap during undo is remembered and replayed', lock.remembered && lock.sel && lock.sel.kind === 'stack');
console.log('(undo lock time is inflated by the software renderer; design value 480 ms)');
// 6b. the last jar: singled out once every other jar is sealed, let go when the level is won
await go(5); await settled();
{ const n = await page.evaluate(() => __sumSort.plan.length);
  for (let k = 0; k < n - 1; k++) { const m = await page.evaluate(() => __sumSort.plan[0]); await page.evaluate(m => { __sumSort.tap(m.src); __sumSort.tap({ kind: 'jar', i: m.dst }); }, m); await settled(); }
  const on = await page.evaluate(() => ({ finale: __sumSort.finale, open: __sumSort.jars.findIndex(j => !j.sealed), dim: document.getElementById('stage').classList.contains('finale') }));
  const m = await page.evaluate(() => __sumSort.plan[0]); await page.evaluate(m => { __sumSort.tap(m.src); __sumSort.tap({ kind: 'jar', i: m.dst }); }, m);
  await page.waitForFunction(() => __sumSort.won && !document.getElementById('win').hidden, null, { timeout: 60000 });
  const off = await page.evaluate(() => ({ finale: __sumSort.finale, dim: document.getElementById('stage').classList.contains('finale') }));
  pass('the last open jar is singled out, and let go on the win', on.finale >= 0 && on.finale === on.open && on.dim && off.finale === -1 && !off.dim, JSON.stringify({ on, off })); }
// 7. celebration ladder: plain clear, perfect, chapter done
const playOut = async () => { for (let k = 0; k < 40; k++) { const st = await page.evaluate(() => ({ won: __sumSort.won, m: __sumSort.plan && __sumSort.plan[0] })); if (st.won || !st.m) break;
  await page.evaluate(m => { __sumSort.tap(m.src); __sumSort.tap({ kind: 'jar', i: m.dst }); }, st.m); await settled(); } await page.waitForTimeout(5000);
  return page.evaluate(() => ({ cls: document.getElementById('winCard').className, title: document.getElementById('winTitle').textContent, stars: document.getElementById('winStars').getAttribute('aria-label'), tag: document.getElementById('winChapter').hidden ? null : document.getElementById('winChapter').textContent, next: document.getElementById('nextLabel').textContent, text: document.getElementById('winText').textContent, shown: !document.getElementById('win').hidden })); };
await go(3); await settled(); const w3 = await playOut(); log('win L3 (tutorial)', w3);
await go(16); await settled(); const w16 = await playOut(); log('win L16 (3 stars)', w16); await page.screenshot({ path: SHOTS + '/win-perfect.png' });
{ const c = await page.evaluate(() => ({ best: __sumSort.bestChain, words: __sumSort.callouts, jars: __sumSort.jars.length }));
  pass('a clean run chains every jar into a combo, with a word from the second seal on', c.best === c.jars && c.words === c.jars - 1, JSON.stringify(c));
  const wj = await page.evaluate(() => ({ hidden: winJourney.hidden, on: winBar.querySelectorAll('.on').length, segs: winBar.children.length, next: winNext.textContent }));
  pass('the win card fills in the cleared level on the chapter bar', !wj.hidden && wj.segs === 8 && wj.on === 6 && wj.next === 'Up next: bigger sums and the daily puzzle at level 19', JSON.stringify(wj));
  await page.click('#winShareBtn', { force: true }); await page.waitForTimeout(300);
  const t = await page.evaluate(() => window.__copied.at(-1) || '');
  pass('the win card shares a spoiler-free result', /^Sum Sort Level 16 ⭐⭐⭐\n8 moves, par 8 · no boosters\n🟩🟨🟨🟨/.test(t), JSON.stringify(t)); }
await go(10); await settled(); const w10 = await playOut(); log('win L10 (chapter end)', w10); await page.screenshot({ path: SHOTS + '/win-chapter.png' });
pass('ladder: tutorial clear < perfect < chapter', !/perfect/.test(w3.cls) && /perfect/.test(w16.cls) && /chapter-done/.test(w10.cls) && w10.next === 'Next chapter');
await page.click('#nextBtn', { force: true }); await page.waitForTimeout(1200);
log('after Next chapter', { level: await page.evaluate(() => __sumSort.level), tip: (await S()).tip });
// 7b. controls floating over the counter: real touches on the buttons
await go(21); await settled();
const SEL = { undo: '#undoBtn', hint: '#hintBtn', spare: '#spareBtn', split: '#splitBtn', sound: '#soundBtn', home: '#homeBtn', restart: '#restartBtn' };
// a real touch at the centre of the button, only counted if the button is what the finger actually lands on
const tapProp = async id => { const p = await page.evaluate(sel => { const el = document.querySelector(sel), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y); return { x, y, ok: !!hit && (hit === el || el.contains(hit)) }; }, SEL[id]);
  if (!p.ok) console.log('COVERED: ' + id); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(350); };
let m7 = await page.evaluate(() => __sumSort.plan[0]);
await page.evaluate(m => { __sumSort.tap(m.src); __sumSort.tap({ kind: 'jar', i: m.dst }); }, m7); await settled();
await tapProp('undo'); await settled(); await page.waitForTimeout(300); s = await S();
pass('Undo button undoes the move', s.jars.split(' ').every(j => j.endsWith(':')), s.jars);
await tapProp('hint'); await page.waitForTimeout(300); pass('Hint button lifts a tile', !!(await S()).sel);
await page.evaluate(() => __sumSort.tap(null));
await tapProp('spare'); await settled(); await page.waitForTimeout(600); pass('+1 Jar button adds a jar', (await S()).jars.split(' ').length === (await page.evaluate(() => __sumSort.getLevel(21).jars.length)) + 1);
await tapProp('sound'); pass('sound button toggles sound', (await page.evaluate(() => document.getElementById('soundBtn').getAttribute('aria-pressed'))) === 'false'); await tapProp('sound');
// home in the middle of a level keeps the level as it is
m7 = await page.evaluate(() => __sumSort.plan[0]);
await page.evaluate(m => { __sumSort.tap(m.src); __sumSort.tap({ kind: 'jar', i: m.dst }); }, m7); await settled();
const before = await S();
await tapProp('home'); let h7 = await H(); await page.waitForTimeout(2500); await page.screenshot({ path: SHOTS + '/home-21.png' });
log('home wash after 2.5 s', await page.evaluate(() => ({ opacity: getComputedStyle(document.getElementById('home')).opacity, bands: getComputedStyle(document.getElementById('topUi')).opacity })));
pass('home button opens home on the same level', h7.open && h7.num === '21' && h7.chapter === 'Sums', JSON.stringify(h7));
await tapEl('#playBtn'); const after = await S(); h7 = await H();
pass('Play resumes the level in progress', !h7.open && after.jars === before.jars && after.stacks === before.stacks && after.moves === before.moves, after.jars);
await tapProp('restart'); await page.waitForTimeout(900); pass('restart button restarts', (await S()).moves === 0);
const sizes = await page.evaluate(sel => Object.fromEntries(Object.entries(sel).map(([k, q]) => { const r = document.querySelector(q).getBoundingClientRect(); return [k, Math.round(r.width) + 'x' + Math.round(r.height)]; })), SEL);
log('touch targets (px)', sizes);
pass('every control is at least 48 px to the finger', Object.values(sizes).every(v => v.split('x').every(n => +n >= 48)));
// the board must stay clear of the two bands of controls, and a tap between the buttons must reach the board
const clear = await page.evaluate(() => { const top = document.getElementById('topUi').getBoundingClientRect().bottom, strip = document.getElementById('strip').getBoundingClientRect().top;
  const hi = Math.min(...__sumSort.jars.map((j, i) => __sumSort.screenOf('jar', i, 3.6).y)), lo = Math.max(...__sumSort.stacks.map((j, i) => __sumSort.screenOf('stack', i, 0).y));
  return { top: Math.round(top), jarBadgeTop: Math.round(hi), stackBase: Math.round(lo), strip: Math.round(strip) }; });
pass('board sits between the level bar and the coach line', clear.jarBadgeTop > clear.top && clear.stackBase < clear.strip, JSON.stringify(clear));
await page.screenshot({ path: SHOTS + '/surface-21.png' });
// 7c. winning moves progress on; home from the win card waits on the next level
await go(3); await settled(); await playOut();
await tapEl('#winHomeBtn'); await page.waitForTimeout(500); let h8 = await H(); await page.screenshot({ path: SHOTS + '/home-4.png' });
pass('home from the win card shows the next level and the stars', h8.open && h8.num === '4' && h8.level === 4 && Number(h8.tally) > 0 && (await page.evaluate(() => document.getElementById('win').hidden)), JSON.stringify(h8));
{ await tapEl('#starTally');
  const shop = await page.evaluate(() => { const all = [...document.querySelectorAll('#themes .theme')], total = __sumSort.totalStars();
    const at = b => Number((b.querySelector('.ts').textContent.match(/\d+/) || [0])[0]);
    return { open: !document.getElementById('shop').hidden, themes: all.length, total, inUse: all.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.id),
      locked: all.filter(b => b.disabled).length, lockedRight: all.filter(b => b.disabled).every(b => at(b) > total) }; });
  await page.keyboard.press('Escape');
  pass('the star tally opens the candy shop: every counter, the first in use, the rest locked until their box', shop.open && shop.themes === 8 && shop.inUse.join() === 'strawberry' && shop.locked >= 6 && shop.lockedRight && await page.evaluate(() => document.getElementById('shop').hidden), JSON.stringify(shop)); }
const homeSizes = await page.evaluate(() => Object.fromEntries(['#playBtn', '#homeSound', '#starTally'].map(q => { const r = document.querySelector(q).getBoundingClientRect(); return [q, Math.round(r.width) + 'x' + Math.round(r.height)]; })));
pass('home controls are at least 48 px', Object.values(homeSizes).every(v => v.split('x').every(n => +n >= 48)), JSON.stringify(homeSizes));
await tapEl('#homeSound'); pass('home sound button toggles both sound buttons', (await page.evaluate(() => ['soundBtn', 'homeSound'].map(id => document.getElementById(id).getAttribute('aria-pressed')).join())) === 'false,false'); await tapEl('#homeSound');
await tapEl('#playBtn'); h8 = await H(); pass('Play starts the next level', !h8.open && h8.level === 4 && h8.moves === 0);
// 8. generated level beyond the stored range, and reload
await go(101); await settled(); const w101 = await playOut(); log('win L101 (generated)', { shown: w101.shown, title: w101.title });
await page.reload(); await page.waitForFunction(() => window.__sumSort && window.__sumSort.jars.length > 0);
{ const h = await H(); pass('after a win and a reload, home waits on the next level', h.open && h.num === '102' && h.level === 102, JSON.stringify(h)); await page.screenshot({ path: SHOTS + '/home-102.png' }); }
// 9. daily puzzle: one board a day, its own result and streak, levels untouched
await page.evaluate(() => { window.__sumSortToday = '2026-10-05'; __sumSort.showHome(); });
{ const card = await page.evaluate(() => document.getElementById('dailyBtn').getAttribute('aria-label'));
  await tapEl('#dailyBtn'); await settled();
  const d = await page.evaluate(() => ({ daily: __sumSort.daily, level: __sumSort.level, tag: document.getElementById('levelTag').innerText.replace(/\n/g, ' '), jars: __sumSort.jars.length }));
  pass('the daily card opens today\'s board', /^Play daily puzzle 5, Monday, Easy/.test(card) && d.daily === '2026-10-05' && /Daily #5 Monday/i.test(d.tag), JSON.stringify(d));
  const w = await playOut(); log('win daily', w); await page.screenshot({ path: SHOTS + '/win-daily.png' });
  const after = await page.evaluate(() => ({ result: __sumSort.save.daily['2026-10-05'], streak: __sumSort.save.streak, last: __sumSort.save.last }));
  pass('a daily win records the day and starts a streak, and leaves the levels alone', w.shown && /^Daily #5/.test(await page.evaluate(() => document.getElementById('winEyebrow').textContent)) && after.result && after.result.stars >= 1 && after.streak.count === 1 && after.last === 102, JSON.stringify(after));
  await tapEl('#nextBtn');
  const shared = await page.evaluate(() => ({ t: window.__copied.at(-1) || '', label: document.getElementById('nextLabel').textContent }));
  pass('sharing is the daily\'s main button', w.next === 'Share result' && /^Sum Sort Daily #5 ⭐/.test(shared.t) && shared.label === 'Copied!', JSON.stringify(shared));
  await tapEl('#winHomeBtn'); const h9 = await H();
  const done = await page.evaluate(() => ({ dis: document.getElementById('dailyBtn').getAttribute('aria-disabled'), label: document.getElementById('dailyBtn').getAttribute('aria-label') }));
  pass('back home: the level waits where it was, the daily shows done until tomorrow', h9.open && h9.level === 102 && /done with.*Share result$/.test(done.label), JSON.stringify({ h9, done }));
  await tapEl('#dailyBtn'); pass('the done card shares the same result', await page.evaluate(() => window.__copied.at(-1) === window.__copied.at(-2)));
  await page.screenshot({ path: SHOTS + '/home-daily-done.png' });
  await page.evaluate(() => { window.__sumSortToday = '2026-10-06'; __sumSort.showHome(); });
  pass('the next day brings a new daily and the streak is at stake', /^Play daily puzzle 6, Tuesday.*Keep your 1-day streak/.test(await page.evaluate(() => document.getElementById('dailyBtn').getAttribute('aria-label')))); }
// 10. a win that crosses a box's star count opens it; its counter is one tap away
await page.evaluate(() => { const s = __sumSort.save, daily = __sumSort.totalStars() - Object.values(s.stars).reduce((a, b) => a + b, 0); s.stars = { 1: 14 - daily }; });
await page.evaluate(() => __sumSort.play()); await go(3); await settled(); await playOut();
{ const r = await page.evaluate(() => ({ shown: !document.getElementById('winReward').hidden, name: document.getElementById('rewardName').textContent, total: __sumSort.totalStars() }));
  await page.click('#rewardUse', { force: true }); await page.waitForTimeout(400);
  const t = await page.evaluate(() => ({ theme: __sumSort.save.theme, stage: getComputedStyle(document.documentElement).getPropertyValue('--stage').trim() }));
  pass('crossing 15 stars opens the first box, and Use it repaints the room', r.shown && r.name === 'Mint Parlour' && r.total === 17 && t.theme === 'mint' && t.stage === '#D0EDE2', JSON.stringify({ r, t }));
  await page.screenshot({ path: SHOTS + '/win-box.png' }); }
log('overflow', await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })));
// 11. installed and offline: a manifest to install from, and after one visit the game opens with no network
{ const head = await page.evaluate(() => ({ manifest: !!document.querySelector('link[rel="manifest"]'), og: document.querySelector('meta[property="og:image"]')?.content }));
  const off = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
  const p2 = await off.newPage(); p2.setDefaultTimeout(180000);
  await p2.addInitScript(() => { window.__sumSortKeepQuality = true; });
  await p2.goto(URL_ + '?sw=1'); await p2.evaluate(() => navigator.serviceWorker.ready);
  await p2.reload(); await p2.waitForFunction(() => !!navigator.serviceWorker.controller);
  await off.setOffline(true); await p2.reload();
  const ok = await p2.waitForFunction(() => window.__sumSort && window.__sumSort.jars.length > 0, null, { timeout: 120000 }).then(() => true, () => false);
  pass('the built page can be installed, previews well, and plays offline after one visit', head.manifest && /\/og\.png$/.test(head.og || '') && ok, JSON.stringify({ ...head, offline: ok }));
  await off.close(); }
// 12. Sugar Rush: from level 25 a minute of quick boards; clearing one wins time back, the clock ends it, the best is kept
await page.evaluate(() => { window.__sumSortRushSeed = 4242; __sumSort.goLevel(30); __sumSort.showHome(); });
{ const card = await page.evaluate(() => ({ two: document.getElementById('modes').classList.contains('two'), shown: !document.getElementById('rushBtn').hidden }));
  await tapEl('#rushBtn'); await settled();
  const r0 = await page.evaluate(() => ({ r: __sumSort.rush, hud: document.getElementById('hud').innerText.replace(/\n/g, ' '), tray: document.getElementById('tray').hidden, last: __sumSort.save.last }));
  const restartHidden = await page.evaluate(() => document.getElementById('restartBtn').hidden);
  // play the board to its last move, then let the clock nearly run out: the winning move must still count
  for (let k = 0; k < 30; k++) { const m = await page.evaluate(() => __sumSort.plan && __sumSort.plan.length > 1 && __sumSort.plan[0]); if (!m) break;
    await page.evaluate(m => { __sumSort.tap(m.src); __sumSort.tap({ kind: 'jar', i: m.dst }); }, m); await settled(); }
  await page.evaluate(() => { __sumSort.setRushLeft(0.4); const m = __sumSort.plan[0]; __sumSort.tap(m.src); __sumSort.tap({ kind: 'jar', i: m.dst }); });
  await page.waitForFunction(() => __sumSort.rush.round === 1, null, { timeout: 30000 });
  const r1 = await page.evaluate(() => __sumSort.rush);
  pass('in a rush: no restart button, and a board won in the last second still counts and wins time', restartHidden && !r1.over && r1.boards === 1 && r1.left > 0, JSON.stringify({ restartHidden, r1 }));
  await page.evaluate(() => __sumSort.setRushLeft(0.2));
  await page.waitForFunction(() => !document.getElementById('win').hidden, null, { timeout: 30000 }); await page.waitForTimeout(600);
  const end = await page.evaluate(() => ({ title: document.getElementById('winTitle').textContent, score: Number(document.getElementById('winMoves').textContent), best: __sumSort.save.rush, next: document.getElementById('nextLabel').textContent }));
  await page.screenshot({ path: SHOTS + '/rush-end.png' });
  await page.click('#winShareBtn', { force: true }); await page.waitForTimeout(300);
  const shared = await page.evaluate(() => window.__copied.at(-1) || '');
  pass('Sugar Rush opens beside the daily, runs on a clock without boosters, and leaves the levels alone', card.two && card.shown && r0.r.left > 55 && /^Time (1:00|0:5\d) Score 0$/.test(r0.hud) && r0.tray && r0.last === 30, JSON.stringify({ card, r0 }));
  pass('a cleared rush board scores and wins time; the clock ends the run, keeps the best and shares it', r1.boards === 1 && r1.score >= 3 * 10 + 25 && end.title === 'New best!' && end.score === r1.score && end.best.best === r1.score && end.next === 'Play again' && /^Sum Sort Sugar Rush ⚡ \d+/.test(shared), JSON.stringify({ r1, end, shared }));
  await tapEl('#winHomeBtn'); const hr = await H();
  pass('home after a rush: the level waits, the best score shows', hr.open && hr.level === 30 && /^Best \d+$/.test(await page.evaluate(() => document.getElementById('rushSub').textContent)), JSON.stringify(hr)); }
// 13. a level in progress survives a detour to the daily, and closing the tab
await page.evaluate(() => { window.__sumSortToday = '2026-10-07'; }); await go(26); await page.evaluate(() => __sumSort.play()); await settled();
{ for (let k = 0; k < 3; k++) { const m = await page.evaluate(() => __sumSort.plan[0]); await page.evaluate(m => { __sumSort.tap(m.src); __sumSort.tap({ kind: 'jar', i: m.dst }); }, m); await settled(); }
  const board = st => ({ jars: st.jars, stacks: st.stacks, moves: st.moves }), before = board(await S());
  await page.evaluate(() => __sumSort.showHome()); await tapEl('#dailyBtn'); await settled();
  const inDaily = await page.evaluate(() => __sumSort.daily);
  await tapProp('home'); await tapEl('#playBtn'); await settled();
  const back = board(await S());
  await page.reload(); await page.waitForFunction(() => window.__sumSort && window.__sumSort.jars.length > 0); await page.evaluate(() => __sumSort.dropQuality());
  const h13 = await H(); await tapEl('#playBtn'); await settled();
  const reloaded = board(await S());
  pass('a half-played level comes back as it was after the daily, and after closing the tab', inDaily === '2026-10-07' && before.moves === 3 && JSON.stringify(back) === JSON.stringify(before) && h13.level === 26 && JSON.stringify(reloaded) === JSON.stringify(before), JSON.stringify({ before, back, reloaded })); }
console.log('errors:', errors.join('\n') || 'none');
await browser.close(); server.close();
console.log(fails ? fails + ' check(s) failed' : 'all checks passed'); process.exitCode = fails || errors.length ? 1 : 0;
