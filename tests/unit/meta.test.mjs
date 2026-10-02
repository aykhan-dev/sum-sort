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
