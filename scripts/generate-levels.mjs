import { generate, solve, toState, failRate, mulberry32, chapterOf, TAUGHT, recipe } from '../src/logic.mjs';
const N = 100, rows = [], report = [];
let prev = null, prevCh = null;
for (let n = 1; n <= N; n++) {
  const ch = chapterOf(n).id, newRule = ch !== prevCh;
  const t0 = performance.now();
  // a planned drop is allowed when a new mechanic arrives; otherwise stay within 10 points of the previous level
  const d = generate(n, { tries: 8000, tol: 0.025, runs: 6000, maxJump: 0.075, near: (newRule || TAUGHT[n - 1]) ? null : prev });
  if (!d) { console.error(n, 'FAILED'); process.exit(1); }
  const check = TAUGHT[n] ? 0 : failRate(d, mulberry32(n * 104729), 4000);
  const o = { j: d.jars, s: d.stacks, p: d.par };
  if (d.locks) o.l = d.locks; if (d.hidden) o.h = 1; if (d.exact) o.x = 1; if (d.fill) o.f = d.fill; if (d.teach) { o.t = d.teach; o.r = d.rule; }
  rows.push('  ' + JSON.stringify(o));
  const st = solve(toState(d), 200000).status;
  report.push({ n, ch, want: TAUGHT[n] ? 0 : recipe(n).want, fail: check, ones: d.stacks.flat().filter(v => v === 1).length, tiles: d.stacks.flat().length, st, ms: Math.round(performance.now() - t0) });
  if (!TAUGHT[n]) prev = d.fail; prevCh = ch;
}
import fs from 'node:fs';
fs.mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../src/levels.json', import.meta.url), '[\n' + rows.join(',\n') + '\n]\n');
fs.writeFileSync(new URL('../dist/curve.json', import.meta.url), JSON.stringify(report));
let maxJump = 0, last = null, lastCh = null;
for (const r of report) {
  const taught = !!TAUGHT[r.n];
  const jump = (last == null || taught) ? 0 : r.fail - last;
  const planned = r.ch !== lastCh;
  console.log(String(r.n).padStart(2), r.ch.padEnd(8), 'want', (r.want * 100).toFixed(0).padStart(3), 'fail', (r.fail * 100).toFixed(1).padStart(5), 'jump', (jump * 100).toFixed(1).padStart(6), planned ? '(new rule)' : '', 'tiles', r.tiles, 'ones', r.ones, r.st, r.ms + 'ms', taught ? 'TAUGHT' : '');
  if (!taught && !planned) maxJump = Math.max(maxJump, Math.abs(jump));
  if (!taught) last = r.fail; lastCh = r.ch;
}
const bad = report.filter(r => !TAUGHT[r.n] && Math.abs(r.fail - r.want) > 0.05).map(r => r.n);
console.log('off target by more than 5 points:', bad.length ? bad : 'none');
console.log('max unplanned jump', (maxJump * 100).toFixed(1), 'max ones', Math.max(...report.map(r => r.ones)), 'all solved', report.every(r => r.st === 'solved'));

// runtime cost of generating endless levels on the device (cheap settings, used past the stored range)
let worst = 0; const fr = [];
for (let n = 101; n <= 120; n++) { const t0 = performance.now(); const g = generate(n, { tries: 40, runs: 400, tol: 0.07 }); worst = Math.max(worst, performance.now() - t0); fr.push(Math.round(failRate(g, mulberry32(n), 4000) * 100)); }
console.log('endless 101-120 worst gen ms', worst.toFixed(0), 'fail %', fr.join(' '));
