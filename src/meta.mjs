/* ================= meta game (pure, no rendering): combos, daily puzzle, streaks, sharing ================= */
import { generateWith, mulberry32 } from './logic.mjs';

/* Combo: jars sealed in a row with no wasted move between them. A tile from a stack into a numbered jar keeps the
   chain going, because that is the only kind of move a par game is made of. Anything else (a jar-to-jar move, the
   spare jar, an undo, a split) ends it. The first seal is its own reward; from the second on, a word rises from the
   jar, and the words climb with the chain. */
export const COMBO_WORDS = ['', '', 'Sweet!', 'Tasty!', 'Yummy!', 'Delicious!', 'Sugar rush!'];
export const comboWord = n => n < 2 ? '' : COMBO_WORDS[Math.min(n, COMBO_WORDS.length - 1)];
/* the chain after one move; `clean` = stack to numbered jar, `seals` = the move sealed that jar */
export const comboStep = (chain, { clean, seals }) => !clean ? 0 : seals ? chain + 1 : chain;

/* ---------------- daily puzzle ----------------
   One board per calendar day, the same for everyone who opens it on that date, wherever they are: the board is
   seeded from the date's text ("2026-10-03"), not from a clock. Monday is gentle and the week climbs to Sunday,
   the way newspaper puzzles do. Only rules every player has learned by the time the daily opens: sums, no frosted
   tiles, no ribbons. The model fail rate stays under the game's 65% cap. */
export const DAILY_OPENS = 19;            // the first Sums level: everything a daily asks for has been taught
const DAILY_EPOCH = Date.UTC(2026, 9, 1);  // daily #1
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAILY_RECIPES = [   // Monday first; `want` is the model fail rate, measured offline (scripts/generate-dailies.mjs)
  { level: 'Easy', jars: 4, stacks: 3, parts: [2, 2], minT: 5, maxT: 11, want: 0.20 },
  { level: 'Easy', jars: 4, stacks: 3, parts: [2, 3], minT: 6, maxT: 12, want: 0.28 },
  { level: 'Medium', jars: 5, stacks: 4, parts: [2, 3], minT: 6, maxT: 14, want: 0.36 },
  { level: 'Medium', jars: 5, stacks: 4, parts: [2, 3], minT: 7, maxT: 15, want: 0.42 },
  { level: 'Tricky', jars: 5, stacks: 4, parts: [2, 3], minT: 7, maxT: 16, want: 0.48 },
  { level: 'Hard', jars: 6, stacks: 5, parts: [2, 3], minT: 7, maxT: 16, want: 0.54 },
  { level: 'Hard', jars: 6, stacks: 5, parts: [2, 3], minT: 7, maxT: 17, want: 0.60 }
];
export const DAILY_CAP = 0.65;
const pad2 = n => String(n).padStart(2, '0');
/* the player's own calendar date, as text */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const keyUTC = key => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const addDays = (key, n) => { const d = new Date(keyUTC(key) + n * 86400000); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; };
export const dailyNumber = key => Math.round((keyUTC(key) - DAILY_EPOCH) / 86400000) + 1;
export const weekdayOf = key => (new Date(keyUTC(key)).getUTCDay() + 6) % 7;   // 0 = Monday
export const dailyLabel = key => { const d = new Date(keyUTC(key)); return `${WEEKDAYS[weekdayOf(key)]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
export const dailyRecipe = key => ({ ch: 'daily', ...DAILY_RECIPES[weekdayOf(key)] });
/* FNV-1a over the date text: a different, stable seed for every day */
export function dailySeed(key) {
  let h = 0x811C9DC5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/* Dailies come from a pool made offline and checked by the solver (src/dailies.json, one per day from daily #1).
   Past the end of the pool the device makes its own: the same seed on every device, cheaper settings. */
export function dailyFromPool(pool, key) {
  const raw = pool[dailyNumber(key) - 1];
  return raw ? { jars: raw.j, stacks: raw.s, par: raw.p, daily: key } : null;
}
export function generateDaily(key, opts = { tries: 60, runs: 400, tol: 0.06 }) {
  const r = dailyRecipe(key), seed = dailySeed(key);
  let def = null;
  for (let salt = 0; salt < 8 && !(def && def.fail <= DAILY_CAP - 0.05); salt++) {
    const d = generateWith(r, mulberry32(seed + salt * 0x9E3779B1), opts);
    if (d && (!def || Math.abs(d.fail - r.want) < Math.abs(def.fail - r.want))) def = d;
  }
  return def && { ...def, daily: key };
}
/* Streak: dailies finished on consecutive days. Finishing today's again changes nothing; a missed day starts over. */
export function streakAfter(streak, key) {
  const s = { count: 0, best: 0, last: null, ...(streak || {}) };
  if (s.last === key) return s;
  const count = s.last === addDays(key, -1) ? s.count + 1 : 1;
  return { count, best: Math.max(s.best, count), last: key };
}
/* the streak as it stands today: still alive if the last daily was today or yesterday */
export const streakNow = (streak, today) => streak && (streak.last === today || streak.last === addDays(today, -1)) ? streak.count : 0;
export const msToNextDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) - d;

/* ---------------- sharing ----------------
   A result anyone can paste anywhere, with nothing given away about the board: stars, moves against par, one square
   per jar in the order it sealed (green: a clean seal, yellow: part of a combo, purple: sealed after a reshuffle),
   the streak, and the link. */
export const SEAL_SQUARES = { clean: '🟩', combo: '🟨', messy: '🟪' };
export const sealSquare = chainAtSeal => chainAtSeal >= 2 ? SEAL_SQUARES.combo : chainAtSeal === 1 ? SEAL_SQUARES.clean : SEAL_SQUARES.messy;
export function shareText({ title, stars, moves, par, seals = [], boosters = 0, streak = 0, url = '' }) {
  const lines = [`${title} ${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}`];
  lines.push(`${moves} moves, par ${par}${boosters ? ` · ${boosters} booster${boosters === 1 ? '' : 's'}` : ' · no boosters'}`);
  if (seals.length) lines.push(seals.map(sealSquare).join(''));
  if (streak > 1) lines.push(`🔥 ${streak}-day streak`);
  if (url) lines.push(url);
  return lines.join('\n');
}
/* the page's own address, fit for sharing: no query, no hash, nothing for a local file */
export const shareUrl = loc => loc && /^https?:$/.test(loc.protocol) ? loc.origin + loc.pathname.replace(/index\.html$/, '') : '';

/* ---------------- the journey ----------------
   Near goals pull harder than far ones, so home always names the next thing a player is working towards:
   where they stand in the chapter, and what opens next (a booster, a new rule, the daily) and how far it is. */
export const MILESTONES = [
  { at: 11, what: 'two-tile jars' }, { at: 11, what: 'the Undo booster' }, { at: 13, what: 'the Hint booster' },
  { at: 15, what: 'the +1 Jar booster' }, { at: 19, what: 'bigger sums' }, { at: 19, what: 'the daily puzzle' },
  { at: 21, what: 'the Split booster' }, { at: 31, what: 'frosted tiles' }, { at: 39, what: 'ribbon-tied jars' },
  { at: 47, what: 'endless mixed levels' }
];
/* what opens next for a player about to play level n: { at, left, what } with everything opening at that level, or null */
export function upNext(n, list = MILESTONES) {
  const ahead = list.filter(m => m.at > n);
  if (!ahead.length) return null;
  const at = Math.min(...ahead.map(m => m.at)), what = ahead.filter(m => m.at === at).map(m => m.what);
  return { at, left: at - n, what: what.length > 1 ? what.slice(0, -1).join(', ') + ' and ' + what.at(-1) : what[0] };
}
/* where level n sits in its stretch of the journey: a chapter, or a run of ten in the endless levels */
export function stretchOf(n, chapter) {
  if (chapter.to !== Infinity) return { from: chapter.from, to: chapter.to, done: n - chapter.from, size: chapter.to - chapter.from + 1 };
  const from = chapter.from + Math.floor((n - chapter.from) / 10) * 10;
  return { from, to: from + 9, done: n - from, size: 10 };
}
