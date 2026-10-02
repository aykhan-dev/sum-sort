// Unit tests for the meta game: combos, daily puzzle, streaks, sharing. Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comboWord, comboStep, COMBO_WORDS } from '../../src/meta.mjs';

test('combo: clean moves keep the chain, each seal grows it, anything else ends it', () => {
  let c = 0;
  c = comboStep(c, { clean: true, seals: false }); assert.equal(c, 0);
  c = comboStep(c, { clean: true, seals: true }); assert.equal(c, 1);
  c = comboStep(c, { clean: true, seals: false }); assert.equal(c, 1);
  c = comboStep(c, { clean: true, seals: true }); assert.equal(c, 2);
  c = comboStep(c, { clean: false, seals: true }); assert.equal(c, 0);   // a jar-to-jar seal starts over
});

test('combo words: silent for the first seal, then climbing, capped at the top word', () => {
  assert.equal(comboWord(0), ''); assert.equal(comboWord(1), '');
  assert.equal(comboWord(2), 'Sweet!');
  assert.equal(comboWord(6), 'Sugar rush!');
  assert.equal(comboWord(40), 'Sugar rush!');
  assert.equal(new Set(COMBO_WORDS.slice(2)).size, COMBO_WORDS.length - 2, 'every rung has its own word');
});

import { dayKey, addDays, dailyNumber, weekdayOf, dailyLabel, dailySeed, dailyRecipe, streakAfter, streakNow, msToNextDay,
  generateDaily, dailyFromPool, DAILY_CAP, DAILY_OPENS } from '../../src/meta.mjs';
import { solve, toState, failRate, mulberry32, chapterOf } from '../../src/logic.mjs';
import fs from 'node:fs';

test('dates: local calendar key, day arithmetic across month, year and clock changes', () => {
  assert.equal(dayKey(new Date(2026, 9, 3, 23, 59)), '2026-10-03');
  assert.equal(dayKey(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-03-01', -1), '2027-02-28');
  assert.equal(addDays('2027-03-28', 1), '2027-03-29');   // the night clocks go forward in Europe
  assert.equal(msToNextDay(new Date(2026, 9, 3, 23, 0)), 3600000);
});

test('daily numbering and calendar: #1 is 1 Oct 2026, weeks start on Monday', () => {
  assert.equal(dailyNumber('2026-10-01'), 1);
  assert.equal(dailyNumber('2026-10-03'), 3);
  assert.equal(dailyNumber('2027-10-01'), 366);
  assert.equal(weekdayOf('2026-10-05'), 0);
  assert.equal(weekdayOf('2026-10-04'), 6);
  assert.equal(dailyLabel('2026-10-03'), 'Saturday 3 Oct');
  assert.equal(dailyRecipe('2026-10-05').level, 'Easy');
  assert.equal(dailyRecipe('2026-10-04').level, 'Hard');
});

test('daily seeds: stable, and different every day', () => {
  assert.equal(dailySeed('2026-10-03'), dailySeed('2026-10-03'));
  const seen = new Set(); let k = '2026-10-01';
  for (let i = 0; i < 400; i++, k = addDays(k, 1)) seen.add(dailySeed(k));
  assert.equal(seen.size, 400);
});

test('streak: consecutive days grow it, the same day keeps it, a missed day starts over', () => {
  let s = streakAfter(null, '2026-10-03'); assert.deepEqual(s, { count: 1, best: 1, last: '2026-10-03' });
  s = streakAfter(s, '2026-10-04'); assert.equal(s.count, 2);
  s = streakAfter(s, '2026-10-04'); assert.equal(s.count, 2);
  s = streakAfter(s, '2026-10-05'); assert.equal(s.count, 3); assert.equal(s.best, 3);
  s = streakAfter(s, '2026-10-07'); assert.equal(s.count, 1); assert.equal(s.best, 3);
  assert.equal(streakNow(s, '2026-10-07'), 1);
  assert.equal(streakNow(s, '2026-10-08'), 1, 'still alive the next day, until that day is over');
  assert.equal(streakNow(s, '2026-10-09'), 0);
  assert.equal(streakNow(undefined, '2026-10-09'), 0);
});

test('the daily asks only for rules a player has learned when it opens', () => {
  assert.equal(chapterOf(DAILY_OPENS).id, 'sums');
  for (let w = 0; w < 7; w++) {
    const r = dailyRecipe(addDays('2026-10-05', w));
    assert.ok(!r.hidden && !r.locks && !r.exact, 'no frosted tiles, ribbons or exact jars');
    assert.ok(r.want <= DAILY_CAP);
  }
});

test('past the pool, the device makes the same solvable daily every time', () => {
  const a = generateDaily('2030-06-15'), b = generateDaily('2030-06-15');
  assert.deepEqual(a, b);
  assert.equal(solve(toState(a), 200000).status, 'solved');
  assert.equal(a.daily, '2030-06-15');
});

const POOL = new URL('../../src/dailies.json', import.meta.url);
test('daily pool: a year of boards, each solvable from the stacks in par, near its weekday target', { skip: !fs.existsSync(POOL) }, () => {
  const pool = JSON.parse(fs.readFileSync(POOL, 'utf8'));
  assert.ok(pool.length >= 365);
  let k = '2026-10-01';
  pool.forEach((raw, i) => {
    const d = dailyFromPool(pool, k);
    assert.equal(d.par, raw.s.flat().length, `daily ${i + 1} par`);
    assert.equal(solve(toState(d), 200000, true).status, 'solved', `daily ${i + 1}`);
    if (i % 15 === 0) {   // a sample of the fail rates, re-measured here with a fresh seed
      const f = failRate(d, mulberry32(i * 7 + 3), 2000);
      assert.ok(f <= DAILY_CAP + 0.04 && Math.abs(f - dailyRecipe(k).want) < 0.09, `daily ${i + 1}: fail ${f}`);
    }
    k = addDays(k, 1);
  });
  assert.equal(dailyFromPool(pool, addDays('2026-10-01', pool.length)), null);
});

import { shareText, sealSquare, shareUrl } from '../../src/meta.mjs';

test('share text: stars, moves against par, one square per seal, streak, link', () => {
  const t = shareText({ title: 'Sum Sort Daily #5', stars: 3, moves: 12, par: 12, seals: [1, 2, 3, 0], streak: 4, url: 'https://x.github.io/sum-sort/' });
  assert.equal(t, 'Sum Sort Daily #5 ⭐⭐⭐\n12 moves, par 12 · no boosters\n🟩🟨🟨🟪\n🔥 4-day streak\nhttps://x.github.io/sum-sort/');
  const u = shareText({ title: 'Sum Sort Level 42', stars: 1, moves: 20, par: 14, boosters: 1 });
  assert.equal(u, 'Sum Sort Level 42 ⭐☆☆\n20 moves, par 14 · 1 booster');
  assert.ok(!/streak/.test(shareText({ title: 'x', stars: 2, moves: 1, par: 1, streak: 1 })), 'a one-day streak is not worth a line');
});

test('share squares and link', () => {
  assert.equal(sealSquare(0), '🟪'); assert.equal(sealSquare(1), '🟩'); assert.equal(sealSquare(5), '🟨');
  assert.equal(shareUrl({ protocol: 'https:', origin: 'https://a.github.io', pathname: '/sum-sort/index.html' }), 'https://a.github.io/sum-sort/');
  assert.equal(shareUrl({ protocol: 'file:', origin: 'null', pathname: '/x/index.html' }), '');
});

import { upNext, stretchOf, MILESTONES } from '../../src/meta.mjs';
import { CHAPTERS } from '../../src/logic.mjs';
import { readFileSync } from 'node:fs';

test('up next: the nearest thing that opens, everything opening at that level named together', () => {
  assert.deepEqual(upNext(3), { at: 11, left: 8, what: 'two-tile jars and the Undo booster' });
  assert.deepEqual(upNext(18), { at: 19, left: 1, what: 'bigger sums and the daily puzzle' });
  assert.equal(upNext(19).what, 'the Split booster');
  assert.equal(upNext(46).what, 'endless mixed levels');
  assert.equal(upNext(47), null);
});

test('milestones agree with the chapters, the booster unlocks and the daily', () => {
  for (const c of CHAPTERS.slice(1)) assert.ok(MILESTONES.some(m => m.at === c.from), `chapter ${c.name} at ${c.from}`);
  const page = readFileSync(new URL('../../src/page.src.html', import.meta.url), 'utf8');
  const unlock = JSON.parse(page.match(/const UNLOCK = (\{[^}]*\})/)[1].replace(/(\w+):/g, '"$1":'));
  for (const [b, at] of Object.entries(unlock)) assert.ok(MILESTONES.some(m => m.at === at && /booster/.test(m.what)), `booster ${b} at ${at}`);
  assert.ok(MILESTONES.some(m => m.at === DAILY_OPENS && /daily/.test(m.what)));
});

test('stretch: a chapter, or a run of ten endless levels', () => {
  const sums = CHAPTERS.find(c => c.id === 'sums'), mix = CHAPTERS.find(c => c.id === 'mix');
  assert.deepEqual(stretchOf(19, sums), { from: 19, to: 30, done: 0, size: 12 });
  assert.deepEqual(stretchOf(30, sums), { from: 19, to: 30, done: 11, size: 12 });
  assert.deepEqual(stretchOf(47, mix), { from: 47, to: 56, done: 0, size: 10 });
  assert.deepEqual(stretchOf(102, mix), { from: 97, to: 106, done: 5, size: 10 });
});

import { THEMES, themeById, themesOwned, nextBox, boxesOpened, boxProgress } from '../../src/meta.mjs';

test('candy boxes: one theme per box, further apart as stars pile up', () => {
  assert.equal(THEMES[0].at, 0, 'the first counter is owned from the start');
  const gaps = THEMES.slice(1).map((t, i) => t.at - THEMES[i].at);
  gaps.forEach((g, i) => { if (i) assert.ok(g >= gaps[i - 1], 'gaps never shrink'); });
  assert.equal(new Set(THEMES.map(t => t.id)).size, THEMES.length);
  assert.ok(THEMES.at(-1).at <= 300, 'every box opens within the 100 stored levels (300 stars)');
});

test('candy boxes: owned, next, opened by a win, progress', () => {
  assert.deepEqual(themesOwned(0).map(t => t.id), ['strawberry']);
  assert.deepEqual(themesOwned(40).map(t => t.id), ['strawberry', 'mint', 'lemon']);
  assert.deepEqual(nextBox(12), { at: 15, left: 3, theme: themeById('mint') });
  assert.equal(nextBox(999), null);
  assert.deepEqual(boxesOpened(13, 16).map(t => t.id), ['mint']);
  assert.deepEqual(boxesOpened(15, 17), [], 'a box opens once');
  assert.equal(boxProgress(15), 0); assert.equal(boxProgress(27.5), 0.5); assert.equal(boxProgress(999), 1);
  assert.equal(themeById('nope').id, 'strawberry');
});

test('every counter is light enough for the ink to keep its contrast', () => {
  const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ink = lum('#3B2747'), soft = lum('#6A5676');
  for (const t of THEMES) for (const hex of [t.stage, ...t.sky]) {
    assert.ok((lum(hex) + 0.05) / (ink + 0.05) >= 7, `${t.id} ${hex} with ink`);
    assert.ok((lum(hex) + 0.05) / (soft + 0.05) >= 4.5, `${t.id} ${hex} with soft ink`);
  }
});

import { RUSH, RUSH_OPENS, rushRecipe, rushBoard, rushTry, RUSH_SALTS, rushSealPoints, rushTimeAfterClear, rushShareText, DAILY_FIRST } from '../../src/meta.mjs';

test('rush attempts: rushBoard is the first good attempt, so spreading attempts over idle moments gives the same board', () => {
  for (const [seed, round] of [[5, 0], [99, 4], [2024, 10]]) {
    let pick = null, any = null;
    for (let salt = 0; salt < RUSH_SALTS && !pick; salt++) { const t = rushTry(seed, round, salt); if (t.good) pick = t.def; any = any || t.def; }
    assert.deepEqual(rushBoard(seed, round), pick || any);
  }
});

test('the daily pool and the numbering start on the same day', () => {
  assert.equal(dailyNumber(DAILY_FIRST), 1);
});

test('sugar rush: opens after the daily and every booster, as a milestone', () => {
  assert.ok(RUSH_OPENS > DAILY_OPENS && RUSH_OPENS > 21);
  assert.equal(upNext(24).what, 'Sugar Rush');
});

test('sugar rush: boards grow with the run, are solvable from the stacks, and come quickly', () => {
  assert.equal(rushRecipe(0).jars, 3); assert.equal(rushRecipe(40).jars, 4);
  for (let round = 0; round < 12; round++) assert.ok(rushRecipe(round).want <= rushRecipe(round + 1).want);
  const t0 = performance.now();
  for (let round = 0; round < 12; round++) {
    const d = rushBoard(12345, round);
    assert.ok(d, `round ${round}`);
    assert.equal(d.jars.length, rushRecipe(round).jars);
    assert.equal(solve(toState(d), 20000, true).status, 'solved', `round ${round} from the stacks`);
  }
  assert.ok(performance.now() - t0 < 3000, 'a whole run of boards in well under a second each');
  assert.deepEqual(rushBoard(777, 3), rushBoard(777, 3), 'the same seed and round, the same board');
});

test('sugar rush: score and clock', () => {
  assert.equal(rushSealPoints(0), RUSH.seal); assert.equal(rushSealPoints(1), RUSH.seal); assert.equal(rushSealPoints(4), 4 * RUSH.seal);
  assert.equal(rushTimeAfterClear(10), 10 + RUSH.perBoard);
  assert.equal(rushTimeAfterClear(RUSH.cap - 1), RUSH.cap);
  assert.equal(rushShareText({ score: 340, boards: 7, newBest: true, url: 'https://x/' }), 'Sum Sort Sugar Rush ⚡ 340\n7 boards in the rush · new best\nhttps://x/');
  assert.equal(rushShareText({ score: 120, boards: 1 }), 'Sum Sort Sugar Rush ⚡ 120\n1 board in the rush');
});
