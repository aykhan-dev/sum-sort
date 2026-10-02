/* ================= game logic (pure, no rendering) ================= */
export const JAR_CAP = 4, STACK_CAP = 4;
export const sumOf = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };

/* seeded random, so level N is the same level for everyone */
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* Can the loose tiles still be split across the open targets (exact sums, at most JAR_CAP per jar)?
   Order and stacking are ignored, so `false` proves a dead end and `true` proves nothing. */
const partCache = new Map();
export function canPartition(tiles, targets) {
  if (sumOf(tiles) !== sumOf(targets)) return false;
  if (!targets.length) return tiles.length === 0;
  const counts = new Array(10).fill(0);
  for (const v of tiles) counts[v]++;
  const ts = targets.slice().sort((a, b) => b - a);
  const key = counts.join('.') + '|' + ts.join(',');
  const hit = partCache.get(key);
  if (hit !== undefined) return hit;
  const rec = ti => ti === ts.length ? counts.every(c => c === 0) : pick(ts[ti], 9, JAR_CAP, ti);
  function pick(rem, maxV, left, ti) {
    if (rem === 0) return rec(ti + 1);
    if (left === 0) return false;
    for (let v = Math.min(maxV, rem); v >= 1; v--) {
      if (!counts[v]) continue;
      counts[v]--; const ok = pick(rem - v, v, left - 1, ti); counts[v]++;
      if (ok) return true;
    }
    return false;
  }
  const res = rec(0);
  if (partCache.size > 20000) partCache.clear();
  partCache.set(key, res);
  return res;
}

/* state: { J: [{ t, tiles, sealed, lock, exact }], S: [[...]] }
   (t null = spare jar, lock = seals needed to untie, exact = the jar only takes the one tile equal to its number)
   returns { status: 'solved' | 'dead' | 'unknown', path } ; a path step is { src: {kind,i}, dst, v, seals } */
export function solve(state, maxNodes = 40000, stackOnly = false) {
  const J = state.J.map(j => ({ t: j.t, lock: j.lock || 0, exact: !!j.exact, sealed: !!j.sealed, tiles: j.tiles.slice(), sum: sumOf(j.tiles) }));
  const S = state.S.map(s => s.slice());
  let sealedCount = J.filter(j => j.sealed).length, nodes = 0, capped = false;
  const seen = new Set(), path = [];
  const done = () => { for (const j of J) if (j.t != null && !j.sealed) return false; return true; };
  const feasible = () => {
    const loose = [], open = [];
    for (const s of S) for (const v of s) loose.push(v);
    for (const j of J) if (!j.sealed) { for (const v of j.tiles) loose.push(v); if (j.t != null) open.push(j.t); }
    return canPartition(loose, open);
  };
  const key = () => S.map(s => s.join(',')).sort().join('/') + '|' +
    J.map(j => (j.t == null ? 'x' : j.t) + (j.sealed ? '#' : ':') + j.lock + ':' + j.tiles.join(',')).sort().join('/');
  if (done()) return { status: 'solved', path: [] };
  if (!feasible()) return { status: 'dead', path: null };
  function dfs() {
    if (done()) return true;
    if (++nodes > maxNodes) { capped = true; return false; }
    const k = key(); if (seen.has(k)) return false; seen.add(k);
    const moves = [];
    const consider = (kind, i, v) => {
      for (let di = 0; di < J.length; di++) {
        const j = J[di];
        if (kind === 'jar' && i === di) continue;
        if (j.sealed || sealedCount < j.lock || j.tiles.length >= JAR_CAP) continue;
        if (j.t != null && (j.sum + v > j.t || (j.exact && v !== j.t))) continue;
        const seals = j.t != null && j.sum + v === j.t;
        // shuffling a lone tile between two empty jars of the same kind changes nothing
        if (kind === 'jar' && J[i].tiles.length === 1 && j.tiles.length === 0 && J[i].t === j.t && J[i].lock === j.lock) continue;
        moves.push({ src: { kind, i }, dst: di, v, seals, score: (seals ? 0 : 2) + (kind === 'jar' ? 3 : 0) + (j.t == null ? 4 : 0) });
      }
    };
    for (let i = 0; i < S.length; i++) if (S[i].length) consider('stack', i, S[i][S[i].length - 1]);
    if (!stackOnly) for (let i = 0; i < J.length; i++) if (!J[i].sealed && J[i].tiles.length) consider('jar', i, J[i].tiles[J[i].tiles.length - 1]);
    moves.sort((a, b) => a.score - b.score);
    for (const m of moves) {
      const from = m.src.kind === 'stack' ? S[m.src.i] : J[m.src.i].tiles;
      from.pop(); if (m.src.kind === 'jar') J[m.src.i].sum -= m.v;
      const d = J[m.dst]; d.tiles.push(m.v); d.sum += m.v;
      if (m.seals) { d.sealed = true; sealedCount++; }
      path.push(m);
      if ((!m.seals || feasible()) && dfs()) return true;
      path.pop();
      if (m.seals) { d.sealed = false; sealedCount--; }
      d.tiles.pop(); d.sum -= m.v;
      from.push(m.v); if (m.src.kind === 'jar') J[m.src.i].sum += m.v;
      if (capped) return false;
    }
    return false;
  }
  if (dfs()) return { status: 'solved', path: path.slice() };
  return { status: capped ? 'unknown' : 'dead', path: null };
}

/* How often a casual player gets stuck: takes a sealing move when one is on offer (most of the time),
   otherwise any legal tile from a stack, and never reshuffles jars. 0 = cannot fail, 1 = always fails. */
export function failRate(def, rng, runs = 80) {
  let fails = 0;
  for (let r = 0; r < runs; r++) {
    const J = def.jars.map((t, i) => ({ t, lock: def.locks ? def.locks[i] : 0, sum: def.fill ? sumOf(def.fill[i]) : 0, n: def.fill ? def.fill[i].length : 0, sealed: false }));
    const S = def.stacks.map(s => s.slice());
    let sealedCount = 0;
    for (;;) {
      if (J.every(j => j.sealed)) break;
      const moves = [];
      S.forEach((s, si) => {
        if (!s.length) return; const v = s[s.length - 1];
        J.forEach((j, di) => {
          if (j.sealed || sealedCount < j.lock || j.n >= JAR_CAP || j.sum + v > j.t || (def.exact && v !== j.t)) return;
          moves.push({ si, di, v, seals: j.sum + v === j.t });
        });
      });
      if (!moves.length) { fails++; break; }
      const sealing = moves.filter(m => m.seals);
      const pool = sealing.length && rng() < 0.8 ? sealing : moves;
      const m = pool[Math.floor(rng() * pool.length)];
      S[m.si].pop(); const j = J[m.di]; j.sum += m.v; j.n++;
      if (m.seals) { j.sealed = true; sealedCount++; }
    }
  }
  return fails / runs;
}

/* ---------------- level recipe per chapter ---------------- */
/* Ramp and targets are decisions recorded in the Sum Sort Taste File:
   ten fail-proof Match levels, then one new rule per chapter, model fail rate capped at 65%. */
export const CHAPTERS = [
  { id: 'match', name: 'Match', from: 1, to: 10, rule: 'Tap a tile, then the jar with the same number.' },
  { id: 'pairs', name: 'Pairs', from: 11, to: 18, rule: 'These jars need two tiles. The badge counts down what is still missing.' },
  { id: 'sums', name: 'Sums', from: 19, to: 30, rule: 'Bigger sums now, and some tiles fit several jars. Think before you drop.' },
  { id: 'frosted', name: 'Frosted', from: 31, to: 38, rule: 'Frosted tiles hide their number until they reach the top.' },
  { id: 'ribbons', name: 'Ribbons', from: 39, to: 46, rule: 'A ribbon ties a jar shut until you seal other jars first.' },
  { id: 'mix', name: 'Mixed', from: 47, to: Infinity, rule: 'Everything at once, and it never runs out.' }
];
export const chapterOf = n => CHAPTERS.find(c => n >= c.from && n <= c.to);
/* Hand-made levels that teach one rule each and cannot be failed. */
export const TAUGHT = {
  12: { jars: [6, 2], stacks: [[6]], fill: [[2], []], par: 2, fail: 0, teach: 'jar',
    rule: 'Tiles in a jar can move too. Tap the jar holding the 2, then the jar that needs 2.' }
};
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
export function recipe(n) {
  const c = chapterOf(n), ch = c.id, k = c.to === Infinity ? (n - c.from) / 4 : (n - c.from) / (c.to - c.from);
  if (ch === 'match') return { ch, exact: true, distinct: true, parts: [1, 1], minT: 1, maxT: 9, want: 0,
    jars: [3, 3, 4, 4, 5, 5, 5, 6, 6, 6][n - 1], stacks: [2, 2, 2, 3, 3, 3, 3, 4, 4, 4][n - 1] };
  if (ch === 'pairs') return { ch, jars: n < 15 ? 3 : 4, stacks: 3, parts: [2, 2], singles: n < 15 ? 1 : 0, minT: 5, maxT: 11, want: lerp(0.10, 0.25, k) };
  if (ch === 'sums') return { ch, jars: n < 25 ? 4 : 5, stacks: n < 25 ? 3 : 4, parts: [2, 3], minT: 6, maxT: 13, want: lerp(0.25, 0.40, k) };
  if (ch === 'frosted') return { ch, jars: n < 35 ? 4 : 5, stacks: n < 35 ? 3 : 4, parts: [2, 3], minT: 6, maxT: 14, want: lerp(0.35, 0.50, k), hidden: true };
  if (ch === 'ribbons') return { ch, jars: 5, stacks: 4, parts: [2, 3], minT: 6, maxT: 15, want: lerp(0.40, 0.55, k), locks: n < 43 ? 1 : 2, hidden: n >= 44 };
  return { ch, jars: n % 3 === 0 ? 6 : 5, stacks: n % 3 === 0 ? 5 : 4, parts: [2, n % 2 ? 3 : 4], minT: 7, maxT: 17,
    want: lerp(0.50, 0.65, k), locks: n % 4 === 1 ? 2 : n % 2 === 0 ? 1 : 0, hidden: n % 3 !== 1 };
}

function splitTarget(t, k, rng) {
  // prefer parts of 2 or more: a board full of 1s is fiddly, not hard
  const lo = t >= 2 * k && rng() < 0.75 ? 2 : 1;
  for (let tries = 0; tries < 40; tries++) {
    const parts = []; let left = t;
    for (let i = 0; i < k - 1; i++) {
      const hi = Math.min(9, left - lo * (k - 1 - i)); if (hi < lo) break;
      const p = lo + Math.floor(rng() * (hi - lo + 1)); parts.push(p); left -= p;
    }
    parts.push(left);
    if (parts.length === k && parts.every(p => p >= lo && p <= 9)) return parts;
  }
  return null;
}
function candidate(r, rng) {
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const targets = [], tiles = [];
  for (let i = 0; i < r.jars; i++) {
    let t, tries = 0;
    do { t = ri(r.minT, r.maxT); } while (r.distinct && targets.includes(t) && ++tries < 50);
    const k = i < (r.singles || 0) ? 1 : Math.min(ri(r.parts[0], r.parts[1]), t);
    if (k === 1 && t > 9) t = ri(3, 9);
    const parts = splitTarget(t, t < 4 ? 1 : k, rng); if (!parts) return null;
    targets.push(t); tiles.push(...parts);
  }
  if (!r.distinct && new Set(targets).size < Math.min(3, r.jars)) return null;
  if (tiles.length > r.stacks * STACK_CAP) return null;
  if (!r.exact && tiles.filter(v => v === 1).length > 2) return null;   // at most two 1-tiles per level
  for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
  const stacks = Array.from({ length: r.stacks }, () => []);
  tiles.forEach((v, i) => {
    if (i < r.stacks) { stacks[i].push(v); return; }
    const open = stacks.filter(s => s.length < STACK_CAP); open[Math.floor(rng() * open.length)].push(v);
  });
  const def = { jars: targets, stacks };
  if (r.locks) {
    def.locks = targets.map(() => 0);
    const order = targets.map((_, i) => i);   // seeded shuffle, the same on every JavaScript engine
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (let i = 0; i < r.locks; i++) def.locks[order[i]] = i === 0 ? 1 : 2;
  }
  if (r.hidden) def.hidden = true;
  if (r.exact) def.exact = true;
  return def;
}
export const toState = def => ({
  J: def.jars.map((t, i) => ({ t, tiles: def.fill ? def.fill[i].slice() : [], sealed: false, lock: def.locks ? def.locks[i] : 0, exact: !!def.exact })),
  S: def.stacks.map(s => s.slice())
});
/* Build level n. A candidate must be clearable straight from the stacks (so par is one move per tile), and is
   accepted only when 2,000 simulated plays land within `tol` of the chapter's target fail rate. `near` is the
   previous level's measured rate: the curve may not move more than 10 points between neighbours. */
export function generate(n, opts = {}) {
  if (TAUGHT[n]) return TAUGHT[n];
  return generateWith(recipe(n), mulberry32(0x5EED + n * 7919), opts);
}
/* The same search for any recipe and seeded random source (the daily puzzle brings its own). */
export function generateWith(r, rng, { tries = 400, tol = 0.05, near = null, runs = 2000, maxJump = 0.10 } = {}) {
  let best = null, bestGap = Infinity;
  for (let i = 0; i < tries; i++) {
    const def = candidate(r, rng); if (!def) continue;
    if (solve(toState(def), 6000, true).status !== 'solved') continue;
    def.par = sumOf(def.stacks.map(s => s.length));
    if (r.exact) { def.fail = 0; return def; }
    const rough = failRate(def, rng, 150);
    if (Math.abs(rough - r.want) > tol + 0.07) continue;
    def.fail = failRate(def, rng, runs);
    const gap = Math.abs(def.fail - r.want), jump = near == null ? 0 : Math.abs(def.fail - near);
    if (gap <= tol && jump <= maxJump) return def;
    if (gap + Math.max(0, jump - maxJump) < bestGap) { best = def; bestGap = gap + Math.max(0, jump - maxJump); }
  }
  return best;
}
