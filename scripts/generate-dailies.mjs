// Makes the daily-puzzle pool, src/dailies.json: one board per day from daily #1, checked by the solver.
// Run: node scripts/generate-dailies.mjs [days=366]
// Each board is accepted only if an independent re-measure (6,000 simulated plays, a fresh seed) lands within
// 5 points of the weekday's target and under the 65% cap: picking the closest of many noisy estimates otherwise
// lets boards through that are harder than they measured.
import fs from 'node:fs';
import { generateWith, mulberry32, solve, toState, failRate } from '../src/logic.mjs';
import { dailyRecipe, dailySeed, addDays, weekdayOf, WEEKDAYS, DAILY_CAP, DAILY_FIRST as FIRST } from '../src/meta.mjs';
const DAYS = Number(process.argv[2]) || 366;
const rows = [], by = WEEKDAYS.map(() => []);
let key = FIRST, slowest = 0;
for (let i = 0; i < DAYS; i++, key = addDays(key, 1)) {
  const r = dailyRecipe(key), seed = dailySeed(key), t0 = performance.now();
  let pick = null;
  for (let salt = 0; salt < 40 && !pick; salt++) {
    const d = generateWith(r, mulberry32(seed + salt * 0x9E3779B1), { tries: 1500, tol: 0.03, runs: 3000 });
    if (!d || solve(toState(d), 200000).status !== 'solved') continue;
    const check = failRate(d, mulberry32(seed ^ (salt + 1) * 104729), 6000);
    if (Math.abs(check - r.want) <= 0.05 && check <= DAILY_CAP) pick = { d, check };
  }
  if (!pick) { console.error(key, 'FAILED'); process.exit(1); }
  rows.push('  ' + JSON.stringify({ j: pick.d.jars, s: pick.d.stacks, p: pick.d.par }));
  by[weekdayOf(key)].push(pick.check);
  slowest = Math.max(slowest, performance.now() - t0);
  if (i % 30 === 0) console.log(key, WEEKDAYS[weekdayOf(key)].padEnd(9), 'want', r.want, 'fail', pick.check.toFixed(3), Math.round(performance.now() - t0) + 'ms');
}
fs.writeFileSync(new URL('../src/dailies.json', import.meta.url), '[\n' + rows.join(',\n') + '\n]\n');
by.forEach((a, w) => { if (!a.length) return; a.sort((x, y) => x - y); console.log(WEEKDAYS[w].padEnd(9), 'want', dailyRecipe(addDays('2026-10-05', w)).want, 'min', a[0].toFixed(2), 'median', a[a.length >> 1].toFixed(2), 'max', a.at(-1).toFixed(2)); });
console.log(DAYS, 'dailies from', FIRST, 'slowest', Math.round(slowest) + 'ms');
