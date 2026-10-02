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
export const DAILY_FIRST = '2026-10-01';   // daily #1; the pool in src/dailies.json starts here
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
const DAILY_EPOCH = keyUTC(DAILY_FIRST);
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
  { at: 21, what: 'the Split booster' }, { at: 25, what: 'Sugar Rush' }, { at: 31, what: 'frosted tiles' }, { at: 39, what: 'ribbon-tied jars' },
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

/* ---------------- candy boxes ----------------
   Stars buy nothing in a shop; they open boxes. Each box holds a new counter for the candy shop: the room around the
   board changes colour. Boxes come further apart as the stars pile up, about one every ten levels at first.
   Every counter is a light pastel, so ink keeps its contrast on all of them. */
export const THEMES = [
  { id: 'strawberry', name: 'Strawberry', at: 0, sky: ['#E9DCFF', '#FFE0D2', '#FFD3C2'], counter: '#F6D8CF', stage: '#F7DAD0', wash: 'rgba(250,225,216,.66)' },
  { id: 'mint', name: 'Mint Parlour', at: 15, sky: ['#D6F2EA', '#E6F6EE', '#C7ECDF'], counter: '#CBEADF', stage: '#D0EDE2', wash: 'rgba(212,238,228,.7)' },
  { id: 'lemon', name: 'Lemon Drop', at: 40, sky: ['#FFF4C7', '#FFEFD5', '#FAE0A8'], counter: '#F6E4B2', stage: '#F8E8BA', wash: 'rgba(250,238,198,.7)' },
  { id: 'blueberry', name: 'Blueberry Milk', at: 70, sky: ['#D9E3FF', '#E6EBFF', '#C9D6F6'], counter: '#CFDAF4', stage: '#D3DDF5', wash: 'rgba(218,226,248,.7)' },
  { id: 'cotton', name: 'Cotton Candy', at: 105, sky: ['#FFD6EC', '#E8DFFF', '#D3E5FF'], counter: '#F0D3E8', stage: '#F0D7EA', wash: 'rgba(244,220,236,.7)' },
  { id: 'caramel', name: 'Salted Caramel', at: 145, sky: ['#FBE4CF', '#F5DAC1', '#F2D5B9'], counter: '#EACFB2', stage: '#ECD3BA', wash: 'rgba(240,218,196,.7)' },
  { id: 'grape', name: 'Grape Soda', at: 190, sky: ['#E4D7FF', '#EDE2FF', '#DED2F7'], counter: '#D9CAF2', stage: '#E2D6F6', wash: 'rgba(226,216,246,.7)' },
  { id: 'peach', name: 'Peach Fizz', at: 240, sky: ['#FFE1D3', '#FFEADB', '#FFCDB4'], counter: '#F9D0BA', stage: '#FAD5C2', wash: 'rgba(250,224,210,.7)' }
];
export const themeById = id => THEMES.find(t => t.id === id) || THEMES[0];
export const themesOwned = stars => THEMES.filter(t => stars >= t.at);
/* the next box: { at, left, theme } or null once every box is open */
export function nextBox(stars) {
  const t = THEMES.find(x => x.at > stars);
  return t ? { at: t.at, left: t.at - stars, theme: t } : null;
}
/* boxes a win just opened: the themes between the star totals before and after it */
export const boxesOpened = (before, after) => THEMES.filter(t => t.at > before && t.at <= after);
/* how far the stars are from the last box to the next, 0..1, for the progress ring */
export function boxProgress(stars) {
  const n = nextBox(stars); if (!n) return 1;
  const prev = [...THEMES].reverse().find(t => t.at <= stars);
  return (stars - prev.at) / (n.at - prev.at);
}

/* ---------------- Sugar Rush ----------------
   A timed run of small boards, for when one level at a time is not enough. A minute on the clock; every board
   cleared adds time back. A seal scores more inside a combo, so clean play beats fast mistakes. Boards grow as the run
   goes on, and every run is new. It opens once the daily and every booster are known, and uses no boosters. */
export const RUSH_OPENS = 25;
export const RUSH = { start: 60, perBoard: 8, cap: 90, seal: 10, clear: 25, skip: 5 };
const RUSH_STEPS = [   // [from round, recipe]: small and kind first, a little bigger as the run goes on
  [0, { jars: 3, stacks: 3, parts: [2, 2], minT: 5, maxT: 11, want: 0.20 }],
  [2, { jars: 3, stacks: 3, parts: [2, 3], minT: 5, maxT: 12, want: 0.25 }],
  [5, { jars: 4, stacks: 3, parts: [2, 2], minT: 5, maxT: 12, want: 0.30 }],
  [9, { jars: 4, stacks: 4, parts: [2, 3], minT: 6, maxT: 13, want: 0.35 }]
];
export const rushRecipe = round => ({ ch: 'rush', ...RUSH_STEPS.filter(([from]) => round >= from).at(-1)[1] });
/* One attempt at a board for this run, round and salt: { def, good } where good = within 10 points of the target.
   An attempt takes a few ms, rarely a quarter second, so the page can spread attempts over idle moments. */
export const RUSH_SALTS = 8;
export function rushTry(seed, round, salt) {
  const r = rushRecipe(round), def = generateWith(r, mulberry32((seed + round * 7919 + salt * 104729) >>> 0), { tries: 80, runs: 120, tol: 0.08 });
  return { def, good: !!def && Math.abs(def.fail - r.want) <= 0.1 };
}
/* a board for this run and round, all at once: the first good attempt, or failing that the first board made */
export function rushBoard(seed, round) {
  let any = null;
  for (let salt = 0; salt < RUSH_SALTS; salt++) {
    const { def, good } = rushTry(seed, round, salt);
    if (good) return def;
    any = any || def;
  }
  return any;
}
export const rushSealPoints = chain => RUSH.seal * Math.max(1, chain);
/* seconds on the clock after a board is cleared, never past the cap */
export const rushTimeAfterClear = left => Math.min(RUSH.cap, left + RUSH.perBoard);
export function rushShareText({ score, boards, newBest = false, url = '' }) {
  const lines = [`Sum Sort Sugar Rush ⚡ ${score}`, `${boards} board${boards === 1 ? '' : 's'} in the rush${newBest ? ' · new best' : ''}`];
  if (url) lines.push(url);
  return lines.join('\n');
}
