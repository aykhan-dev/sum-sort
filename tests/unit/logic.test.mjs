// Unit tests for the pure game logic. Run: npm run test:unit   (node's built-in runner, no browser, a few seconds)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canPartition, solve, toState, generate, failRate, mulberry32, chapterOf, CHAPTERS, recipe, TAUGHT, JAR_CAP } from '../../src/logic.mjs';

const LEVELS = JSON.parse(fs.readFileSync(new URL('../../src/levels.json', import.meta.url), 'utf8'));
const defOf = r => ({ jars: r.j, stacks: r.s, par: r.p, locks: r.l || null, hidden: !!r.h, exact: !!r.x, fill: r.f || null });

test('canPartition: exact split, impossible split, jar capacity', () => {
  assert.equal(canPartition([2, 3, 4], [5, 4]), true);
  assert.equal(canPartition([2, 3, 4], [8, 1]), false);           // no subset makes 8, and there is no 1
  assert.equal(canPartition([1, 1, 1, 1, 1], [5]), false);        // five tiles, but a jar holds four
  assert.equal(canPartition([], []), true);
});

test('solve: finds a path that seals every jar, and proves a dead end', () => {
  const r = solve(toState({ jars: [5, 4], stacks: [[2, 3], [4]] }));
  assert.equal(r.status, 'solved');
  assert.equal(r.path.length, 3);
  assert.equal(solve(toState({ jars: [8, 1], stacks: [[2, 3, 4]] })).status, 'dead');
});

test('every stored level is solvable, from the stacks alone, in par moves', () => {
  assert.equal(LEVELS.length, 100);
  LEVELS.forEach((r, i) => {
    const n = i + 1, d = defOf(r);
    const full = solve(toState(d), 200000);
    assert.equal(full.status, 'solved', `level ${n}`);
    if (!TAUGHT[n]) {
      const clean = solve(toState(d), 200000, true);
      assert.equal(clean.status, 'solved', `level ${n} from the stacks`);
      assert.equal(r.p, r.s.flat().length, `level ${n} par is one move per tile`);
    }
    for (const s of r.s) assert.ok(s.length <= JAR_CAP, `level ${n} stack height`);
  });
});

test('chapters cover every level number without gaps', () => {
  for (let n = 1; n <= 300; n++) assert.ok(chapterOf(n), `level ${n}`);
  CHAPTERS.slice(1).forEach((c, i) => assert.equal(c.from, CHAPTERS[i].to + 1));
});

test('chapter one cannot be failed', () => {
  for (let n = 1; n <= 10; n++) assert.equal(failRate(defOf(LEVELS[n - 1]), mulberry32(n), 200), 0, `level ${n}`);
});

test('generate is deterministic: level n is the same level for everyone', () => {
  const opts = { tries: 40, runs: 400, tol: 0.07 };
  const a = generate(131, opts), b = generate(131, opts);
  assert.deepEqual(a, b);
  assert.equal(solve(toState(a), 200000).status, 'solved');
});

test('generated endless levels stay near the chapter fail-rate target', () => {
  for (const n of [101, 117, 150]) {
    const d = generate(n, { tries: 40, runs: 400, tol: 0.07 });
    const fail = failRate(d, mulberry32(n * 31), 1500);
    assert.ok(Math.abs(fail - recipe(n).want) < 0.2, `level ${n}: fail ${fail} want ${recipe(n).want}`);
    assert.ok(fail <= 0.8, `level ${n} capped`);
  }
});
